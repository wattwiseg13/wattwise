from sqlalchemy.orm import Session

from app.db_models import MeterDB, TechnicianDB, ConsumerSettingsDB
from app.mock_data import METERS, TECHNICIANS


def seed_database(db: Session):
    seed_meters(db)
    seed_technicians(db)
    seed_consumer_settings(db)


def seed_meters(db: Session):
    existing_meter = db.query(MeterDB).first()

    if existing_meter:
        return

    for meter in METERS.values():
        db_meter = MeterDB(
            meter_id=meter["meter_id"],
            address=meter["address"],
            area=meter.get("area"),
            municipality=meter.get("municipality"),
            consumer_name=meter.get("consumer_name"),
            consumer_phone=meter.get("consumer_phone"),
            status=meter.get("status", "NORMAL"),
            current_draw=meter.get("current_draw", 0),
            baseline_watts=meter.get("baseline_watts", 650),
            deviation_threshold=meter.get("deviation_threshold", 45),
            tamper_events=meter.get("tamper_events", 0),
            hardware_version=meter.get("hardware_version"),
            firmware_version=meter.get("firmware_version"),
        )

        db.add(db_meter)

    db.commit()


def seed_technicians(db: Session):
    existing_technician = db.query(TechnicianDB).first()

    if existing_technician:
        return

    for technician in TECHNICIANS.values():
        db_technician = TechnicianDB(
            technician_id=technician["technician_id"],
            name=technician["name"],
            phone=technician.get("phone"),
            area=technician.get("area"),
            status=technician.get("status", "AVAILABLE"),
            active_job_count=technician.get("active_job_count", 0),
        )

        db.add(db_technician)

    db.commit()


def seed_consumer_settings(db: Session):
    existing_settings = db.query(ConsumerSettingsDB).first()

    if existing_settings:
        return

    settings = ConsumerSettingsDB(
        user_id="USER-001",
        meter_id="NXM-001-TZN",
        notifications_enabled=True,
        sms_alerts_enabled=True,
        email_alerts_enabled=False,
        daily_usage_limit_kwh=12,
        monthly_budget_limit=900,
        critical_alert_threshold_watts=1500,
        preferred_contact_method="SMS",
    )

    db.add(settings)
    db.commit()
