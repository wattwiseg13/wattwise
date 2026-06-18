from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.mock_data import METERS, LATEST_READINGS, ALERTS, TECHNICIANS, JOBS, now_sast

router = APIRouter()


MUNICIPALITY_SETTINGS = {
    "municipality_name": "Greater Tzaneen Municipality",
    "default_deviation_threshold": 45,
    "critical_watts_threshold": 1500,
    "auto_dispatch_enabled": False,
    "ussd_broadcast_enabled": True,
    "grid_alert_frequency": "IMMEDIATE",
    "updated_at": now_sast(),
}


GRID_ASSETS = [
    {
        "asset_id": "TRF-001",
        "asset_type": "Transformer",
        "area": "Tzaneen North",
        "status": "WARNING",
        "load_percentage": 82,
        "connected_meters": 128,
        "last_inspection": "2026-06-01",
    },
    {
        "asset_id": "TRF-002",
        "asset_type": "Transformer",
        "area": "Tzaneen CBD",
        "status": "CRITICAL",
        "load_percentage": 104,
        "connected_meters": 96,
        "last_inspection": "2026-05-19",
    },
    {
        "asset_id": "FDR-001",
        "asset_type": "Feeder Line",
        "area": "Nkowankowa",
        "status": "NORMAL",
        "load_percentage": 61,
        "connected_meters": 210,
        "last_inspection": "2026-06-10",
    },
]


class DispatchRequest(BaseModel):
    meter_id: str
    technician_id: str
    alert_id: Optional[str] = None
    priority: str = "NORMAL"
    notes: Optional[str] = None


class MunicipalitySettingsUpdate(BaseModel):
    default_deviation_threshold: Optional[float] = None
    critical_watts_threshold: Optional[float] = None
    auto_dispatch_enabled: Optional[bool] = None
    ussd_broadcast_enabled: Optional[bool] = None
    grid_alert_frequency: Optional[str] = None


@router.get("/theft-map")
def get_theft_detection_map():
    map_points = []

    fake_locations = {
        "NXM-001-TZN": {"lat": -23.8332, "lng": 30.1635},
        "NXM-002-TZN": {"lat": -23.8295, "lng": 30.1702},
        "NXM-003-TZN": {"lat": -23.8240, "lng": 30.1559},
    }

    for meter_id, meter in METERS.items():
        active_alerts = [
            alert for alert in ALERTS
            if alert["meter_id"] == meter_id and alert["status"] != "RESOLVED"
        ]

        risk_score = min(100, len(active_alerts) * 35 + meter.get("tamper_events", 0) * 15)

        if meter["status"] == "CRITICAL":
            risk_label = "HIGH_RISK"
        elif meter["status"] == "WARNING":
            risk_label = "MEDIUM_RISK"
        else:
            risk_label = "LOW_RISK"

        location = fake_locations.get(meter_id, {"lat": -23.8332, "lng": 30.1635})

        map_points.append(
            {
                "meter_id": meter_id,
                "address": meter["address"],
                "area": meter["area"],
                "status": meter["status"],
                "risk_label": risk_label,
                "risk_score": risk_score,
                "lat": location["lat"],
                "lng": location["lng"],
                "active_alert_count": len(active_alerts),
                "last_seen": meter["last_seen"],
            }
        )

    return {
        "municipality": "Greater Tzaneen Municipality",
        "generated_at": now_sast(),
        "summary": {
            "total_meters": len(METERS),
            "high_risk_meters": len([point for point in map_points if point["risk_label"] == "HIGH_RISK"]),
            "medium_risk_meters": len([point for point in map_points if point["risk_label"] == "MEDIUM_RISK"]),
            "low_risk_meters": len([point for point in map_points if point["risk_label"] == "LOW_RISK"]),
        },
        "map_points": map_points,
    }


@router.get("/assets")
def get_grid_assets():
    return {
        "municipality": "Greater Tzaneen Municipality",
        "generated_at": now_sast(),
        "assets": GRID_ASSETS,
    }


@router.get("/ai-logs")
def get_ai_grid_analysis_logs():
    return {
        "generated_at": now_sast(),
        "logs": [
            {
                "log_id": "AI-LOG-001",
                "severity": "CRITICAL",
                "area": "Tzaneen CBD",
                "title": "Possible illegal connection cluster",
                "summary": "Multiple meters show abnormal night-time load increases above baseline.",
                "recommendation": "Dispatch inspection team and compare transformer load against billed meter consumption.",
                "created_at": now_sast(),
            },
            {
                "log_id": "AI-LOG-002",
                "severity": "WARNING",
                "area": "Tzaneen North",
                "title": "Transformer load approaching safe limit",
                "summary": "Evening demand is rising and may overload the transformer during peak hours.",
                "recommendation": "Send USSD energy-saving broadcast to affected households.",
                "created_at": now_sast(),
            },
            {
                "log_id": "AI-LOG-003",
                "severity": "INFO",
                "area": "Nkowankowa",
                "title": "Stable grid behaviour",
                "summary": "Consumption patterns are within expected range.",
                "recommendation": "No immediate action required.",
                "created_at": now_sast(),
            },
        ],
    }


@router.get("/dispatch")
def get_municipality_dispatch_data():
    open_alerts = [alert for alert in ALERTS if alert["status"] != "RESOLVED"]

    return {
        "generated_at": now_sast(),
        "open_alerts": open_alerts,
        "technicians": list(TECHNICIANS.values()),
        "jobs": list(JOBS.values()),
    }


@router.post("/dispatch")
def create_dispatch(payload: DispatchRequest):
    if payload.meter_id not in METERS:
        raise HTTPException(status_code=404, detail="Meter not found")

    if payload.technician_id not in TECHNICIANS:
        raise HTTPException(status_code=404, detail="Technician not found")

    job_number = len(JOBS) + 1
    job_id = f"JOB-{job_number:03d}"

    job = {
        "job_id": job_id,
        "job_code": f"NXM-2026-{47 + job_number:04d}",
        "meter_id": payload.meter_id,
        "technician_id": payload.technician_id,
        "alert_id": payload.alert_id,
        "priority": payload.priority,
        "status": "ASSIGNED",
        "notes": payload.notes or "Municipality dispatch created from grid dashboard.",
        "assigned_at": now_sast(),
        "resolved_at": None,
    }

    JOBS[job_id] = job
    TECHNICIANS[payload.technician_id]["active_job_count"] += 1

    if payload.alert_id:
        for alert in ALERTS:
            if alert["alert_id"] == payload.alert_id:
                alert["assigned_to"] = payload.technician_id
                alert["status"] = "IN_PROGRESS"

    return {
        "message": f"Technician dispatched · Job #{job['job_code']} created",
        "job": job,
    }


@router.get("/settings")
def get_municipality_settings():
    return MUNICIPALITY_SETTINGS


@router.patch("/settings")
def update_municipality_settings(payload: MunicipalitySettingsUpdate):
    updates = payload.model_dump(exclude_unset=True)

    for key, value in updates.items():
        MUNICIPALITY_SETTINGS[key] = value

    MUNICIPALITY_SETTINGS["updated_at"] = now_sast()

    return {
        "message": "Municipality settings updated",
        "settings": MUNICIPALITY_SETTINGS,
    }
