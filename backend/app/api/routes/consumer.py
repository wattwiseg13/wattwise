from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.mock_data import METERS, LATEST_READINGS, READING_HISTORY, ALERTS, now_sast

router = APIRouter()


CONSUMER_SETTINGS = {
    "USER-001": {
        "user_id": "USER-001",
        "meter_id": "NXM-001-TZN",
        "notifications_enabled": True,
        "sms_alerts_enabled": True,
        "email_alerts_enabled": False,
        "daily_usage_limit_kwh": 12,
        "monthly_budget_limit": 900,
        "critical_alert_threshold_watts": 1500,
        "preferred_contact_method": "SMS",
        "updated_at": now_sast(),
    }
}


class ConsumerSettingsUpdate(BaseModel):
    notifications_enabled: Optional[bool] = None
    sms_alerts_enabled: Optional[bool] = None
    email_alerts_enabled: Optional[bool] = None
    daily_usage_limit_kwh: Optional[float] = None
    monthly_budget_limit: Optional[float] = None
    critical_alert_threshold_watts: Optional[float] = None
    preferred_contact_method: Optional[str] = None


@router.get("/dashboard/{meter_id}")
def get_consumer_dashboard(meter_id: str):
    meter = METERS.get(meter_id)
    reading = LATEST_READINGS.get(meter_id)

    if not meter or not reading:
        raise HTTPException(status_code=404, detail="Consumer dashboard data not found")

    current_watts = reading["watts"]

    if current_watts >= 1500:
        friendly_status = "Critical usage spike detected"
        status_message = "Your electricity use is very high right now. Check heavy appliances or possible meter issues."
    elif current_watts >= 800:
        friendly_status = "High usage detected"
        status_message = "You are using more electricity than usual. Your units may run out earlier."
    else:
        friendly_status = "Usage looks normal"
        status_message = "Your electricity usage is currently within a normal range."

    return {
        "meter": meter,
        "latest_reading": reading,
        "summary": {
            "units_remaining": 38.4,
            "estimated_days_left": 5,
            "cost_today": reading["estimated_cost_today"],
            "usage_today_kwh": reading["kwh_today"],
            "current_power_draw_watts": reading["watts"],
            "status": reading["status"],
            "friendly_status": friendly_status,
            "status_message": status_message,
            "source": reading["source"],
            "last_updated": reading["timestamp"],
        },
        "history": READING_HISTORY.get(meter_id, [])[-60:],
        "appliance_breakdown": [
            {"name": "Geyser", "kwh": 6.52, "cost": 18.26, "percentage": 35},
            {"name": "Kitchen", "kwh": 4.10, "cost": 11.48, "percentage": 22},
            {"name": "Lighting", "kwh": 3.36, "cost": 7.62, "percentage": 18},
            {"name": "Appliances", "kwh": 2.80, "cost": 6.36, "percentage": 15},
            {"name": "Other", "kwh": 1.86, "cost": 4.00, "percentage": 10},
        ],
        "quick_actions": [
            {"label": "Buy Electricity", "action": "BUY_ELECTRICITY"},
            {"label": "View Usage History", "action": "VIEW_HISTORY"},
            {"label": "Saving Tips", "action": "VIEW_TIPS"},
            {"label": "Report an Issue", "action": "REPORT_ISSUE"},
        ],
    }


@router.get("/recommendations/{meter_id}")
def get_consumer_recommendations(meter_id: str):
    meter = METERS.get(meter_id)
    reading = LATEST_READINGS.get(meter_id)

    if not meter or not reading:
        raise HTTPException(status_code=404, detail="Recommendation data not found")

    return {
        "meter_id": meter_id,
        "generated_at": now_sast(),
        "headline": "Your geyser is likely the biggest cost today.",
        "summary": "Your current usage is higher than your normal pattern. Reducing heavy appliance usage during peak hours can help you save money.",
        "estimated_monthly_saving": 180,
        "recommendations": [
            {
                "title": "Reduce geyser runtime",
                "description": "Switch your geyser off 1 hour earlier each day.",
                "estimated_saving": 180,
                "difficulty": "Easy",
            },
            {
                "title": "Avoid peak-hour heater use",
                "description": "Avoid running heaters between 18:00 and 21:00 where possible.",
                "estimated_saving": 120,
                "difficulty": "Medium",
            },
            {
                "title": "Switch off standby devices",
                "description": "Turn off TVs, chargers, and appliances at the plug overnight.",
                "estimated_saving": 50,
                "difficulty": "Easy",
            },
        ],
    }


@router.get("/reports/{meter_id}")
def get_consumer_reports(meter_id: str):
    meter = METERS.get(meter_id)

    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")

    return {
        "meter_id": meter_id,
        "report_period": "Current month",
        "total_kwh": 312.4,
        "estimated_total_cost": 1218.36,
        "average_daily_usage_kwh": 10.4,
        "highest_usage_day": "2026-06-14",
        "biggest_cost_driver": "Geyser",
        "estimated_savings_available": 260,
        "download_options": ["PDF", "CSV"],
        "generated_at": now_sast(),
    }


@router.get("/settings/{user_id}")
def get_consumer_settings(user_id: str):
    settings = CONSUMER_SETTINGS.get(user_id)

    if not settings:
        raise HTTPException(status_code=404, detail="Consumer settings not found")

    return settings


@router.patch("/settings/{user_id}")
def update_consumer_settings(user_id: str, payload: ConsumerSettingsUpdate):
    settings = CONSUMER_SETTINGS.get(user_id)

    if not settings:
        raise HTTPException(status_code=404, detail="Consumer settings not found")

    updates = payload.model_dump(exclude_unset=True)

    for key, value in updates.items():
        settings[key] = value

    settings["updated_at"] = now_sast()

    return {
        "message": "Consumer settings updated",
        "settings": settings,
    }
