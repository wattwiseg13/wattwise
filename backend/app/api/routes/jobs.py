from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.mock_data import JOBS, METERS, TECHNICIANS, ALERTS, now_sast

router = APIRouter()


class DispatchJobRequest(BaseModel):
    meter_id: str
    technician_id: str
    alert_id: Optional[str] = None
    priority: str = "NORMAL"
    notes: Optional[str] = None


class UpdateJobStatusRequest(BaseModel):
    status: str
    resolution_note: Optional[str] = None


@router.get("")
def get_jobs():
    return list(JOBS.values())


@router.post("/dispatch")
def dispatch_job(payload: DispatchJobRequest):
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
        "notes": payload.notes,
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


@router.patch("/{job_id}/status")
def update_job_status(job_id: str, payload: UpdateJobStatusRequest):
    job = JOBS.get(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job["status"] = payload.status

    if payload.status == "RESOLVED":
        job["resolved_at"] = now_sast()
        job["resolution_note"] = payload.resolution_note

    return {
        "message": "Job status updated",
        "job": job,
    }
