from fastapi import APIRouter, HTTPException

from app.mock_data import (
    METERS,
    LATEST_READINGS,
    READING_HISTORY,
    ALERTS,
    TECHNICIANS,
    JOBS,
)

router = APIRouter()


@router.get("/consumer/{meter_id}")
def get_consumer_dashboard(meter_id: str):
    meter = METERS.get(meter_id)
    reading = LATEST_READINGS.get(meter_id)

    if not meter or not reading:
        raise HTTPException(status_code=404, detail="Consumer dashboard data not found")

    return {
        "meter": meter,
        "latest_reading": reading,
        "history": READING_HISTORY.get(meter_id, [])[-60:],
        "load_shedding": {
            "stage": 2,
            "area": "Group 7 — Tzaneen North",
            "scheduled_time": "Today 18:00 – 20:30",
            "tip": "Charge devices and avoid heavy appliance use before 17:45.",
            "source": "Demo schedule",
        },
        "ussd_shortcut": "*130#",
        "saving_tip": "Your usage is above normal. Reduce geyser/heater use during peak hours to save money.",
    }


@router.get("/municipality")
def get_municipality_dashboard():
    meters = list(METERS.values())
    active_alerts = [alert for alert in ALERTS if alert["status"] != "RESOLVED"]
    critical_alerts = [alert for alert in active_alerts if alert["severity"] == "CRITICAL"]

    total_kwh_today = sum(
        reading["kwh_today"] for reading in LATEST_READINGS.values()
    )

    estimated_revenue_at_risk = len(critical_alerts) * 1250

    return {
        "kpis": {
            "total_active_meters_online": len(meters),
            "meters_with_active_tamper_alerts": len(critical_alerts),
            "illegal_connection_suspects_this_week": len(critical_alerts),
            "total_kwh_consumed_today": round(total_kwh_today, 2),
            "estimated_revenue_at_risk": estimated_revenue_at_risk,
        },
        "meters": meters,
        "alerts": ALERTS,
        "zones": [
            {
                "name": "Tzaneen North",
                "status": "WARNING",
                "issue": "High evening load detected",
                "recommendation": "Send energy-saving alert and monitor transformer load.",
            },
            {
                "name": "Tzaneen CBD",
                "status": "CRITICAL",
                "issue": "Possible illegal connection cluster",
                "recommendation": "Dispatch technician team for inspection.",
            },
            {
                "name": "Nkowankowa",
                "status": "NORMAL",
                "issue": "Stable consumption",
                "recommendation": "No action required.",
            },
        ],
    }


@router.get("/technician/{technician_id}")
def get_technician_dashboard(technician_id: str):
    technician = TECHNICIANS.get(technician_id)

    if not technician:
        raise HTTPException(status_code=404, detail="Technician not found")

    jobs = [
        job for job in JOBS.values()
        if job["technician_id"] == technician_id
    ]

    return {
        "technician": technician,
        "active_jobs": jobs,
        "resolved_today": [
            job for job in jobs
            if job["status"] == "RESOLVED"
        ],
    }
