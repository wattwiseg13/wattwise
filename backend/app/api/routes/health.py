from fastapi import APIRouter
from app.mock_data import now_sast

router = APIRouter()


@router.get("")
def health_check():
    return {
        "status": "ok",
        "service": "WattWise API",
        "timestamp": now_sast(),
    }
