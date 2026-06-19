import os
from typing import Any, Dict

import requests


# A single API_BASE override points the WHOLE bridge (ingest + live relay) at
# the right backend. Through Docker that's the proxy, e.g.
# API_BASE=http://localhost:8080/api — everything else derives from it.
API_BASE = os.environ.get("API_BASE", "http://localhost:8000/api")

API_URL = os.environ.get("API_URL", f"{API_BASE}/readings/ingest")

# Live relay endpoints on the backend, also derived from API_BASE.
LIVE_PUBLISH_URL = os.environ.get("LIVE_PUBLISH_URL", f"{API_BASE}/live/publish")
LIVE_COMMANDS_URL = os.environ.get("LIVE_COMMANDS_URL", f"{API_BASE}/live/commands")

METER_ID = os.environ.get("METER_ID", "NXM-001-TZN")

PERSIST_TO_BACKEND = os.environ.get(
    "PERSIST_TO_BACKEND",
    "true",
).lower() not in {"0", "false", "no", "off"}

REQUEST_TIMEOUT_SECONDS = float(
    os.environ.get("REQUEST_TIMEOUT_SECONDS", "1.5")
)


def build_backend_payload(record: Dict[str, Any], source: str = "ARDUINO_UNO_BRIDGE") -> Dict[str, Any]:
    """
    Converts the Uno bridge reading shape into the FastAPI backend ingest shape.

    Bridge reading shape:
    {
      "device_id": "uno1",
      "ts_iso": "...",
      "uptime_ms": 1234,
      "volts": 230,
      "watts": 850,
      "state": "normal"
    }

    Backend ingest shape:
    {
      "meter_id": "NXM-001-TZN",
      "watts": 850,
      "voltage": 230,
      "pulse_count": 1234,
      "source": "ARDUINO_UNO_BRIDGE"
    }
    """

    return {
        "meter_id": METER_ID,
        "watts": float(record.get("watts", 0)),
        "voltage": float(record.get("volts", 230)),
        "pulse_count": int(record.get("uptime_ms", 0)),
        "source": source,
    }


def post_reading_to_backend(
    record: Dict[str, Any],
    source: str = "ARDUINO_UNO_BRIDGE",
) -> Dict[str, Any]:
    """
    Sends a bridge reading to FastAPI.

    This is intentionally fail-safe:
    - If FastAPI is down, the live WebSocket demo still continues.
    - If persistence is disabled, it quietly skips.
    """

    if not PERSIST_TO_BACKEND:
        return {
            "ok": True,
            "skipped": True,
            "message": "Backend persistence disabled",
        }

    payload = build_backend_payload(record, source=source)

    try:
        response = requests.post(
            API_URL,
            json=payload,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

        return {
            "ok": response.ok,
            "skipped": False,
            "status_code": response.status_code,
            "message": response.text[:300],
            "payload": payload,
        }

    except requests.RequestException as error:
        return {
            "ok": False,
            "skipped": False,
            "status_code": None,
            "message": str(error),
            "payload": payload,
        }


def post_live_message_to_backend(message: Dict[str, Any]) -> Dict[str, Any]:
    """
    Push a live UI message to the backend relay so it fans out to every browser.

    Fail-safe: if the backend is unreachable the bridge keeps running. The live
    dashboard simply won't update until the backend is back.
    """

    try:
        response = requests.post(
            LIVE_PUBLISH_URL,
            json=message,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        return {"ok": response.ok, "message": response.text[:300]}
    except requests.RequestException as error:
        return {"ok": False, "message": str(error)}


def poll_backend_commands() -> list:
    """
    Fetch dashboard commands the backend has queued for the bridge.

    Returns an empty list on any failure so the serial loop never blocks.
    """

    try:
        response = requests.get(LIVE_COMMANDS_URL, timeout=REQUEST_TIMEOUT_SECONDS)
        if response.ok:
            return response.json().get("commands", [])
    except requests.RequestException:
        pass
    return []
