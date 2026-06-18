from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.mock_data import TECHNICIANS, JOBS, METERS, ALERTS, now_sast

router = APIRouter()


DISPATCHER_REPORTS = [
    {
        "report_id": "DREP-001",
        "dispatcher_id": "DISP-001",
        "job_id": "JOB-001",
        "meter_id": "NXM-003-TZN",
        "title": "Critical meter investigation report",
        "summary": "Technician dispatched to investigate abnormal load spike.",
        "status": "SUBMITTED",
        "created_at": now_sast(),
    }
]


class DispatcherReportCreate(BaseModel):
    dispatcher_id: str
    job_id: str
    title: str
    summary: str
    notes: Optional[str] = None


@router.get("/dashboard/{dispatcher_id}")
def get_dispatcher_dashboard(dispatcher_id: str):
    active_jobs = [
        job for job in JOBS.values()
        if job["status"] != "RESOLVED"
    ]

    urgent_jobs = [
        job for job in active_jobs
        if job["priority"] == "URGENT"
    ]

    return {
        "dispatcher_id": dispatcher_id,
        "generated_at": now_sast(),
        "summary": {
            "active_jobs": len(active_jobs),
            "urgent_jobs": len(urgent_jobs),
            "available_technicians": len(
                [tech for tech in TECHNICIANS.values() if tech["status"] == "AVAILABLE"]
            ),
            "open_alerts": len([alert for alert in ALERTS if alert["status"] == "OPEN"]),
        },
        "active_jobs": active_jobs,
        "technicians": list(TECHNICIANS.values()),
    }


@router.get("/calendar/{dispatcher_id}")
def get_dispatcher_calendar(dispatcher_id: str):
    events = []

    for job in JOBS.values():
        meter = METERS.get(job["meter_id"])
        technician = TECHNICIANS.get(job["technician_id"])

        events.append(
            {
                "event_id": f"CAL-{job['job_id']}",
                "job_id": job["job_id"],
                "title": f"{job['priority']} inspection · {job['meter_id']}",
                "meter_id": job["meter_id"],
                "address": meter["address"] if meter else "Unknown address",
                "technician": technician["name"] if technician else "Unassigned",
                "status": job["status"],
                "scheduled_time": job["assigned_at"],
            }
        )

    return {
        "dispatcher_id": dispatcher_id,
        "generated_at": now_sast(),
        "events": events,
    }


@router.get("/reports/{dispatcher_id}")
def get_dispatcher_reports(dispatcher_id: str):
    reports = [
        report for report in DISPATCHER_REPORTS
        if report["dispatcher_id"] == dispatcher_id
    ]

    return {
        "dispatcher_id": dispatcher_id,
        "reports": reports,
    }


@router.post("/reports")
def create_dispatcher_report(payload: DispatcherReportCreate):
    if payload.job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")

    job = JOBS[payload.job_id]

    report = {
        "report_id": f"DREP-{len(DISPATCHER_REPORTS) + 1:03d}",
        "dispatcher_id": payload.dispatcher_id,
        "job_id": payload.job_id,
        "meter_id": job["meter_id"],
        "title": payload.title,
        "summary": payload.summary,
        "notes": payload.notes,
        "status": "SUBMITTED",
        "created_at": now_sast(),
    }

    DISPATCHER_REPORTS.insert(0, report)

    return {
        "message": "Dispatcher report submitted",
        "report": report,
    }
