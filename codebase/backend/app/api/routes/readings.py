from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from app.database import get_db
from app.db_models import MeterDB, ReadingDB, AlertDB, now_sast
from app.mock_data import (
    LATEST_READINGS,
    READING_HISTORY,
    METERS,
    ALERTS,
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


def reading_to_response(reading: ReadingDB):
    return {
        "meter_id": reading.meter_id,
        "watts": reading.watts,
        "voltage": reading.voltage,
        "current_amps": reading.current_amps,
        "kwh_today": reading.kwh_today,
        "estimated_cost_today": reading.estimated_cost_today,
        "pulse_count": reading.pulse_count,
        "status": reading.status,
        "source": reading.source,
        "timestamp": reading.created_at.isoformat(),
    }


@router.get("/{meter_id}/latest")
def get_latest_reading(meter_id: str, db: Session = Depends(get_db)):
    db_reading = (
        db.query(ReadingDB)
        .filter(ReadingDB.meter_id == meter_id)
        .order_by(ReadingDB.created_at.desc())
        .first()
    )

    if db_reading:
        return reading_to_response(db_reading)

    fallback_reading = LATEST_READINGS.get(meter_id)

    if not fallback_reading:
        raise HTTPException(status_code=404, detail="Reading not found for meter")

    return fallback_reading


@router.get("/{meter_id}/history")
def get_reading_history(
    meter_id: str,
    limit: int = 60,
    db: Session = Depends(get_db),
):
    db_readings = (
        db.query(ReadingDB)
        .filter(ReadingDB.meter_id == meter_id)
        .order_by(ReadingDB.created_at.desc())
        .limit(limit)
        .all()
    )

    if db_readings:
        ordered_readings = list(reversed(db_readings))

        return [
            {
                "meter_id": reading.meter_id,
                "time": reading.created_at.strftime("%H:%M:%S"),
                "watts": reading.watts,
                "timestamp": reading.created_at.isoformat(),
            }
            for reading in ordered_readings
        ]

    fallback_history = READING_HISTORY.get(meter_id)

    if fallback_history is None:
        raise HTTPException(status_code=404, detail="History not found for meter")

    return fallback_history[-limit:]


@router.post("/ingest")
def ingest_reading(payload: ReadingIngestRequest, db: Session = Depends(get_db)):
    meter = db.query(MeterDB).filter(MeterDB.meter_id == payload.meter_id).first()

    if not meter:
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

    db_reading = ReadingDB(
        meter_id=payload.meter_id,
        watts=payload.watts,
        voltage=payload.voltage,
        current_amps=current_amps,
        kwh_today=kwh_today,
        estimated_cost_today=estimated_cost_today,
        pulse_count=payload.pulse_count,
        status=status,
        source=payload.source,
    )

    db.add(db_reading)

    meter.current_draw = payload.watts
    meter.status = status
    meter.last_seen = now_sast()

    db.commit()
    db.refresh(db_reading)

    reading = reading_to_response(db_reading)

    # Keep mock memory updated so existing dashboard routes still reflect live data.
    LATEST_READINGS[payload.meter_id] = reading

    READING_HISTORY.setdefault(payload.meter_id, [])
    READING_HISTORY[payload.meter_id].append(
        {
            "meter_id": payload.meter_id,
            "time": db_reading.created_at.strftime("%H:%M:%S"),
            "watts": payload.watts,
            "timestamp": db_reading.created_at.isoformat(),
        }
    )
    READING_HISTORY[payload.meter_id] = READING_HISTORY[payload.meter_id][-120:]

    if payload.meter_id in METERS:
        METERS[payload.meter_id]["current_draw"] = payload.watts
        METERS[payload.meter_id]["status"] = status
        METERS[payload.meter_id]["last_seen"] = reading["timestamp"]

    created_alert = None

    if status == "CRITICAL":
        alert_id = f"ALT-{len(ALERTS) + 1:03d}"

        db_alert = AlertDB(
            alert_id=alert_id,
            meter_id=payload.meter_id,
            address=meter.address,
            alert_type="LOAD_ANOMALY",
            severity="CRITICAL",
            description="Critical usage spike detected from live Arduino reading.",
            deviation_percentage=100,
            status="OPEN",
            assigned_to=None,
        )

        db.add(db_alert)
        db.commit()
        db.refresh(db_alert)

        created_alert = {
            "alert_id": db_alert.alert_id,
            "meter_id": db_alert.meter_id,
            "address": db_alert.address,
            "alert_type": db_alert.alert_type,
            "severity": db_alert.severity,
            "description": db_alert.description,
            "deviation_percentage": db_alert.deviation_percentage,
            "status": db_alert.status,
            "assigned_to": db_alert.assigned_to,
            "timestamp": db_alert.created_at.isoformat(),
        }

        ALERTS.insert(0, created_alert)

    return {
        "message": "Reading ingested and stored successfully",
        "reading": reading,
        "alert_created": created_alert,
    }
