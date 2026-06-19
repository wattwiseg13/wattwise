from datetime import datetime, timezone, timedelta

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text

from app.database import Base

SAST = timezone(timedelta(hours=2))


def now_sast():
    return datetime.now(SAST)


class MeterDB(Base):
    __tablename__ = "meters"

    id = Column(Integer, primary_key=True, index=True)
    meter_id = Column(String, unique=True, index=True, nullable=False)

    address = Column(String, nullable=False)
    area = Column(String, nullable=True)
    municipality = Column(String, nullable=True)

    consumer_name = Column(String, nullable=True)
    consumer_phone = Column(String, nullable=True)

    status = Column(String, default="NORMAL")
    current_draw = Column(Float, default=0)
    baseline_watts = Column(Float, default=650)
    deviation_threshold = Column(Float, default=45)
    tamper_events = Column(Integer, default=0)

    hardware_version = Column(String, nullable=True)
    firmware_version = Column(String, nullable=True)

    last_seen = Column(DateTime(timezone=True), default=now_sast)
    created_at = Column(DateTime(timezone=True), default=now_sast)
    updated_at = Column(DateTime(timezone=True), default=now_sast, onupdate=now_sast)


class ReadingDB(Base):
    __tablename__ = "readings"

    id = Column(Integer, primary_key=True, index=True)

    meter_id = Column(String, ForeignKey("meters.meter_id"), index=True, nullable=False)

    watts = Column(Float, nullable=False)
    voltage = Column(Float, default=230)
    current_amps = Column(Float, nullable=True)
    kwh_today = Column(Float, default=0)
    estimated_cost_today = Column(Float, default=0)
    pulse_count = Column(Integer, default=0)

    status = Column(String, default="NORMAL")
    source = Column(String, default="ARDUINO")

    created_at = Column(DateTime(timezone=True), default=now_sast, index=True)


class AlertDB(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)

    alert_id = Column(String, unique=True, index=True, nullable=False)
    meter_id = Column(String, ForeignKey("meters.meter_id"), index=True, nullable=False)

    address = Column(String, nullable=True)
    alert_type = Column(String, nullable=False)
    severity = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    deviation_percentage = Column(Float, nullable=True)

    status = Column(String, default="OPEN")
    assigned_to = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), default=now_sast)
    resolved_at = Column(DateTime(timezone=True), nullable=True)


class TechnicianDB(Base):
    __tablename__ = "technicians"

    id = Column(Integer, primary_key=True, index=True)

    technician_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    area = Column(String, nullable=True)
    status = Column(String, default="AVAILABLE")
    active_job_count = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), default=now_sast)


class JobDB(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)

    job_id = Column(String, unique=True, index=True, nullable=False)
    job_code = Column(String, unique=True, index=True, nullable=False)

    meter_id = Column(String, ForeignKey("meters.meter_id"), nullable=False)
    technician_id = Column(String, nullable=False)
    alert_id = Column(String, nullable=True)

    priority = Column(String, default="NORMAL")
    status = Column(String, default="ASSIGNED")
    notes = Column(Text, nullable=True)

    assigned_at = Column(DateTime(timezone=True), default=now_sast)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_note = Column(Text, nullable=True)


class ConsumerSettingsDB(Base):
    __tablename__ = "consumer_settings"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(String, unique=True, index=True, nullable=False)
    meter_id = Column(String, nullable=False)

    notifications_enabled = Column(Boolean, default=True)
    sms_alerts_enabled = Column(Boolean, default=True)
    email_alerts_enabled = Column(Boolean, default=False)

    daily_usage_limit_kwh = Column(Float, default=12)
    monthly_budget_limit = Column(Float, default=900)
    critical_alert_threshold_watts = Column(Float, default=1500)

    preferred_contact_method = Column(String, default="SMS")

    updated_at = Column(DateTime(timezone=True), default=now_sast, onupdate=now_sast)
