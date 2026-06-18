from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any
import random

SAST = timezone(timedelta(hours=2))


def now_sast() -> str:
    return datetime.now(SAST).isoformat()


METERS: Dict[str, Dict[str, Any]] = {
    "NXM-001-TZN": {
        "meter_id": "NXM-001-TZN",
        "address": "42 Nkowankowa Street, Tzaneen, Limpopo",
        "area": "Tzaneen North",
        "municipality": "Greater Tzaneen Municipality",
        "consumer_name": "Casious Mookamedi",
        "consumer_phone": "+27 71 000 1001",
        "status": "WARNING",
        "current_draw": 850,
        "baseline_watts": 650,
        "deviation_threshold": 45,
        "tamper_events": 1,
        "hardware_version": "UNO-DEMO-v1",
        "firmware_version": "0.1.0",
        "last_seen": now_sast(),
    },
    "NXM-002-TZN": {
        "meter_id": "NXM-002-TZN",
        "address": "18 Modjadji Road, Tzaneen, Limpopo",
        "area": "Tzaneen North",
        "municipality": "Greater Tzaneen Municipality",
        "consumer_name": "Lerato Maseko",
        "consumer_phone": "+27 72 000 1002",
        "status": "NORMAL",
        "current_draw": 420,
        "baseline_watts": 500,
        "deviation_threshold": 45,
        "tamper_events": 0,
        "hardware_version": "UNO-DEMO-v1",
        "firmware_version": "0.1.0",
        "last_seen": now_sast(),
    },
    "NXM-003-TZN": {
        "meter_id": "NXM-003-TZN",
        "address": "7 Market Street, Tzaneen, Limpopo",
        "area": "Tzaneen CBD",
        "municipality": "Greater Tzaneen Municipality",
        "consumer_name": "Thabo Khumalo",
        "consumer_phone": "+27 73 000 1003",
        "status": "CRITICAL",
        "current_draw": 1950,
        "baseline_watts": 700,
        "deviation_threshold": 45,
        "tamper_events": 3,
        "hardware_version": "UNO-DEMO-v1",
        "firmware_version": "0.1.0",
        "last_seen": now_sast(),
    },
}

LATEST_READINGS: Dict[str, Dict[str, Any]] = {
    "NXM-001-TZN": {
        "meter_id": "NXM-001-TZN",
        "watts": 850,
        "voltage": 230,
        "current_amps": 3.7,
        "kwh_today": 4.8,
        "estimated_cost_today": 18.75,
        "pulse_count": 42,
        "status": "WARNING",
        "source": "MOCK",
        "timestamp": now_sast(),
    },
    "NXM-002-TZN": {
        "meter_id": "NXM-002-TZN",
        "watts": 420,
        "voltage": 230,
        "current_amps": 1.8,
        "kwh_today": 2.2,
        "estimated_cost_today": 8.58,
        "pulse_count": 20,
        "status": "NORMAL",
        "source": "MOCK",
        "timestamp": now_sast(),
    },
    "NXM-003-TZN": {
        "meter_id": "NXM-003-TZN",
        "watts": 1950,
        "voltage": 230,
        "current_amps": 8.5,
        "kwh_today": 9.6,
        "estimated_cost_today": 37.44,
        "pulse_count": 95,
        "status": "CRITICAL",
        "source": "MOCK",
        "timestamp": now_sast(),
    },
}


def generate_history(meter_id: str, base_watts: int, points: int = 60) -> List[Dict[str, Any]]:
    history = []
    current_time = datetime.now(SAST)

    for i in range(points):
        timestamp = current_time - timedelta(seconds=(points - i) * 5)
        noise = random.randint(-60, 60)
        watts = max(0, base_watts + noise)

        history.append(
            {
                "meter_id": meter_id,
                "time": timestamp.strftime("%H:%M:%S"),
                "watts": watts,
                "timestamp": timestamp.isoformat(),
            }
        )

    return history


READING_HISTORY: Dict[str, List[Dict[str, Any]]] = {
    "NXM-001-TZN": generate_history("NXM-001-TZN", 850),
    "NXM-002-TZN": generate_history("NXM-002-TZN", 420),
    "NXM-003-TZN": generate_history("NXM-003-TZN", 1950),
}

ALERTS: List[Dict[str, Any]] = [
    {
        "alert_id": "ALT-001",
        "meter_id": "NXM-003-TZN",
        "address": "7 Market Street, Tzaneen, Limpopo",
        "alert_type": "LOAD_ANOMALY",
        "severity": "CRITICAL",
        "description": "Load anomaly detected — 178% above baseline. Possible illegal connection or overload.",
        "deviation_percentage": 178,
        "status": "OPEN",
        "assigned_to": "TECH-001",
        "timestamp": now_sast(),
    },
    {
        "alert_id": "ALT-002",
        "meter_id": "NXM-001-TZN",
        "address": "42 Nkowankowa Street, Tzaneen, Limpopo",
        "alert_type": "HIGH_USAGE",
        "severity": "WARNING",
        "description": "Usage is 68% above normal household baseline.",
        "deviation_percentage": 68,
        "status": "IN_PROGRESS",
        "assigned_to": "TECH-002",
        "timestamp": now_sast(),
    },
]

TECHNICIANS: Dict[str, Dict[str, Any]] = {
    "TECH-001": {
        "technician_id": "TECH-001",
        "name": "Mpho Dlamini",
        "phone": "+27 74 000 2001",
        "area": "Tzaneen CBD",
        "status": "AVAILABLE",
        "active_job_count": 1,
    },
    "TECH-002": {
        "technician_id": "TECH-002",
        "name": "Ayanda Molefe",
        "phone": "+27 74 000 2002",
        "area": "Tzaneen North",
        "status": "ON_SITE",
        "active_job_count": 1,
    },
    "TECH-003": {
        "technician_id": "TECH-003",
        "name": "Sipho Baloyi",
        "phone": "+27 74 000 2003",
        "area": "Tzaneen South",
        "status": "AVAILABLE",
        "active_job_count": 0,
    },
}

JOBS: Dict[str, Dict[str, Any]] = {
    "JOB-001": {
        "job_id": "JOB-001",
        "job_code": "NXM-2026-0047",
        "meter_id": "NXM-003-TZN",
        "technician_id": "TECH-001",
        "priority": "URGENT",
        "status": "ASSIGNED",
        "notes": "Investigate critical load anomaly.",
        "assigned_at": now_sast(),
        "resolved_at": None,
    },
    "JOB-002": {
        "job_id": "JOB-002",
        "job_code": "NXM-2026-0048",
        "meter_id": "NXM-001-TZN",
        "technician_id": "TECH-002",
        "priority": "NORMAL",
        "status": "ON_SITE",
        "notes": "Check household high usage warning.",
        "assigned_at": now_sast(),
        "resolved_at": None,
    },
}
