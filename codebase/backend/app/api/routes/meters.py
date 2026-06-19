from fastapi import APIRouter, HTTPException
from app.mock_data import METERS

router = APIRouter()


@router.get("")
def get_meters():
    return list(METERS.values())


@router.get("/{meter_id}")
def get_meter(meter_id: str):
    meter = METERS.get(meter_id)

    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")

    return meter
