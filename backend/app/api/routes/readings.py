from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.mock_data import (
    LATEST_READINGS,
    READING_HISTORY,
    METERS,
    ALERTS,
    now_sast,
)

router = APIRouter()

TARIFF_PER_KWH = 3.90


class ReadingIngestRequest(BaseModel):
    meter_id: str
    watts: float
    voltage: float = 230
    current_amps: Optional[float] = None
    pulse_count: int = 0
    source: str = "ARDUINO"


@router.get("/{meter_id}/latest")
def get_latest_reading(meter_id: str):
    reading = LATEST_READINGS.get(meter_id)

    if not reading:
        raise HTTPException(status_code=404, detail="Reading not found for meter")

    return reading


@router.get("/{meter_id}/history")
def get_reading_history(meter_id: str, limit: int = 60):
    history = READING_HISTORY.get(meter_id)

    if history is None:
        raise HTTPException(status_code=404, detail="History not found for meter")

    return history[-limit:]


@router.post("/ingest")
def ingest_reading(payload: ReadingIngestRequest):
    if payload.meter_id not in METERS:
        raise HTTPException(status_code=404, detail="Meter not found")

    current_amps = payload.current_amps
    if current_amps is None and payload.voltage > 0:
        current_amps = round(payload.watts / payload.voltage, 2)

    kwh_today = round(payload.watts / 1000 * 6, 2)
    estimated_cost_today = round(kwh_today * TARIFF_PER_KWH, 2)

    if payload.watts >= 1500:
        status = "CRITICAL"
    elif payload.watts >= 800:
        status = "WARNING"
    else:
        status = "NORMAL"

    reading = {
        "meter_id": payload.meter_id,
        "watts": payload.watts,
        "voltage": payload.voltage,
        "current_amps": current_amps,
        "kwh_today": kwh_today,
        "estimated_cost_today": estimated_cost_today,
        "pulse_count": payload.pulse_count,
        "status": status,
        "source": payload.source,
        "timestamp": now_sast(),
    }

    LATEST_READINGS[payload.meter_id] = reading

    READING_HISTORY.setdefault(payload.meter_id, [])
    READING_HISTORY[payload.meter_id].append(
        {
            "meter_id": payload.meter_id,
            "time": reading["timestamp"][11:19],
            "watts": payload.watts,
            "timestamp": reading["timestamp"],
        }
    )

    READING_HISTORY[payload.meter_id] = READING_HISTORY[payload.meter_id][-120:]

    METERS[payload.meter_id]["current_draw"] = payload.watts
    METERS[payload.meter_id]["status"] = status
    METERS[payload.meter_id]["last_seen"] = reading["timestamp"]

    if status == "CRITICAL":
        alert = {
            "alert_id": f"ALT-{len(ALERTS) + 1:03d}",
            "meter_id": payload.meter_id,
            "address": METERS[payload.meter_id]["address"],
            "alert_type": "LOAD_ANOMALY",
            "severity": "CRITICAL",
            "description": "Critical usage spike detected from live Arduino reading.",
            "deviation_percentage": 100,
            "status": "OPEN",
            "assigned_to": None,
            "timestamp": now_sast(),
        }
        ALERTS.insert(0, alert)

    return {
        "message": "Reading ingested successfully",
        "reading": reading,
    }
