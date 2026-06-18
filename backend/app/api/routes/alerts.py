from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.mock_data import ALERTS, METERS, now_sast

router = APIRouter()


class CreateAlertRequest(BaseModel):
    meter_id: str
    alert_type: str
    severity: str
    description: str
    deviation_percentage: Optional[float] = None


@router.get("")
def get_alerts(status: Optional[str] = None, severity: Optional[str] = None):
    results = ALERTS

    if status:
        results = [alert for alert in results if alert["status"] == status]

    if severity:
        results = [alert for alert in results if alert["severity"] == severity]

    return results


@router.post("")
def create_alert(payload: CreateAlertRequest):
    meter = METERS.get(payload.meter_id)

    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")

    alert = {
        "alert_id": f"ALT-{len(ALERTS) + 1:03d}",
        "meter_id": payload.meter_id,
        "address": meter["address"],
        "alert_type": payload.alert_type,
        "severity": payload.severity,
        "description": payload.description,
        "deviation_percentage": payload.deviation_percentage,
        "status": "OPEN",
        "assigned_to": None,
        "timestamp": now_sast(),
    }

    ALERTS.insert(0, alert)

    return {
        "message": "Alert created",
        "alert": alert,
    }


@router.patch("/{alert_id}/resolve")
def resolve_alert(alert_id: str):
    for alert in ALERTS:
        if alert["alert_id"] == alert_id:
            alert["status"] = "RESOLVED"
            alert["resolved_at"] = now_sast()
            return {
                "message": "Alert resolved",
                "alert": alert,
            }

    raise HTTPException(status_code=404, detail="Alert not found")
