"""Live WebSocket relay endpoints.

  - WS   /api/live/ws        browsers connect here for live readings
  - POST /api/live/publish   bridge/simulator push a live message to fan out
  - GET  /api/live/commands  bridge polls dashboard commands ("MUTE"/"OFF")

The publish + commands HTTP endpoints let the (possibly remote) serial bridge
drive the hosted backend without needing a persistent socket of its own.
"""

from typing import Any, Dict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.live import hub

router = APIRouter()


@router.websocket("/ws")
async def live_ws(websocket: WebSocket):
    await hub.connect(websocket)
    try:
        while True:
            # Browser -> bridge commands (e.g. "MUTE", "OFF").
            message = await websocket.receive_text()
            hub.queue_command(message)
    except WebSocketDisconnect:
        await hub.disconnect(websocket)
    except Exception:
        await hub.disconnect(websocket)


@router.post("/publish")
async def live_publish(message: Dict[str, Any]):
    """Receive a live message from the bridge/simulator and broadcast it."""
    await hub.publish(message)
    return {"ok": True, "clients": len(hub._clients)}


@router.get("/commands")
def live_commands():
    """Drain dashboard commands queued for the bridge."""
    return {"commands": hub.drain_commands()}
