import os
import queue
import threading
import time
from typing import Any, Dict

import requests


API_URL = os.environ.get(
    "API_URL",
    "http://localhost:8000/api/readings/ingest",
)

METER_ID = os.environ.get("METER_ID", "NXM-001-TZN")

# Demo-safe default:
# Live WebSocket should work even if FastAPI/Postgres is not running.
PERSIST_TO_BACKEND = os.environ.get(
    "PERSIST_TO_BACKEND",
    "false",
).lower() not in {"0", "false", "no", "off"}

REQUEST_TIMEOUT_SECONDS = float(
    os.environ.get("REQUEST_TIMEOUT_SECONDS", "0.5")
)

BACKEND_QUEUE_MAXSIZE = int(
    os.environ.get("BACKEND_QUEUE_MAXSIZE", "5000")
)

_BACKEND_QUEUE: queue.Queue[Dict[str, Any]] = queue.Queue(maxsize=BACKEND_QUEUE_MAXSIZE)
_WORKER_STARTED = False
_WORKER_LOCK = threading.Lock()
_SESSION = requests.Session()

_last_failure_log = 0.0


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


def _log_backend_failure(message: str):
    """
    Rate-limit backend failure logs so the bridge console does not get spammed.
    """
    global _last_failure_log

    now = time.monotonic()

    if now - _last_failure_log >= 10:
        _last_failure_log = now
        print(f"  !! Backend persistence warning: {message}")


def _backend_worker():
    """
    Background worker.

    This prevents FastAPI/Postgres from slowing down the live Arduino/WebSocket loop.
    """
    while True:
        payload = _BACKEND_QUEUE.get()

        try:
            response = _SESSION.post(
                API_URL,
                json=payload,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )

            if not response.ok:
                _log_backend_failure(
                    f"POST failed with HTTP {response.status_code}: {response.text[:200]}"
                )

        except requests.RequestException as error:
            _log_backend_failure(str(error))

        finally:
            _BACKEND_QUEUE.task_done()


def _ensure_worker_started():
    global _WORKER_STARTED

    if _WORKER_STARTED:
        return

    with _WORKER_LOCK:
        if _WORKER_STARTED:
            return

        thread = threading.Thread(
            target=_backend_worker,
            name="backend-persistence-worker",
            daemon=True,
        )
        thread.start()
        _WORKER_STARTED = True


def post_reading_to_backend(
    record: Dict[str, Any],
    source: str = "ARDUINO_UNO_BRIDGE",
) -> Dict[str, Any]:
    """
    Queue a bridge reading for FastAPI persistence.

    Important:
    This function is intentionally non-blocking for demo reliability.
    The live dashboard should keep working even if FastAPI/Postgres is down.
    """

    if not PERSIST_TO_BACKEND:
        return {
            "ok": True,
            "skipped": True,
            "queued": False,
            "message": "Backend persistence disabled",
        }

    payload = build_backend_payload(record, source=source)
    _ensure_worker_started()

    try:
        _BACKEND_QUEUE.put_nowait(payload)
    except queue.Full:
        return {
            "ok": False,
            "skipped": False,
            "queued": False,
            "dropped": True,
            "message": "Backend persistence queue full; reading dropped",
            "payload": payload,
        }

    return {
        "ok": True,
        "skipped": False,
        "queued": True,
        "message": "Queued for backend persistence",
        "payload": payload,
        "queue_size": _BACKEND_QUEUE.qsize(),
    }
