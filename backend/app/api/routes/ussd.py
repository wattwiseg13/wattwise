from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.mock_data import METERS, LATEST_READINGS, ALERTS

router = APIRouter()


class USSDRequest(BaseModel):
    session_id: str
    input: str
    meter_id: Optional[str] = "NXM-001-TZN"
    phone_number: Optional[str] = None


@router.post("/session")
def handle_ussd_session(payload: USSDRequest):
    meter = METERS.get(payload.meter_id)
    reading = LATEST_READINGS.get(payload.meter_id)

    if not meter or not reading:
        raise HTTPException(status_code=404, detail="Meter not found for USSD session")

    user_input = payload.input.strip()

    if user_input == "*130#" or user_input == "":
        message = (
            "WattWise USSD\n"
            "1. Balance & units\n"
            "2. Current usage\n"
            "3. Power alerts\n"
            "4. Saving tips"
        )

    elif user_input == "1":
        message = (
            f"Meter: {payload.meter_id}\n"
            f"Today's usage: {reading['kwh_today']} kWh\n"
            f"Estimated cost today: R {reading['estimated_cost_today']}\n"
            f"Status: {reading['status']}"
        )

    elif user_input == "2":
        message = (
            f"Current usage: {reading['watts']} W\n"
            f"Voltage: {reading['voltage']} V\n"
            f"Current: {reading['current_amps']} A"
        )

    elif user_input == "3":
        meter_alerts = [
            alert for alert in ALERTS
            if alert["meter_id"] == payload.meter_id and alert["status"] != "RESOLVED"
        ]

        if meter_alerts:
            latest_alert = meter_alerts[0]
            message = (
                f"Alert: {latest_alert['severity']}\n"
                f"{latest_alert['description']}"
            )
        else:
            message = "No active power alerts for your meter."

    elif user_input == "4":
        message = (
            "Saving tips:\n"
            "1. Reduce geyser use.\n"
            "2. Avoid heaters at peak time.\n"
            "3. Switch off standby devices."
        )

    else:
        message = (
            "Invalid option.\n"
            "Dial *130# or choose 1, 2, 3, or 4."
        )

    return {
        "session_id": payload.session_id,
        "meter_id": payload.meter_id,
        "message": message,
    }
