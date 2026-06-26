import json


VALID_STATES = {"normal", "alert", "off"}


def parse_reading(line, ts_iso):
    """
    Parse one JSON line from the Arduino.

    Expected Arduino shape:
    {
      "device_id": "uno1",
      "ts": 1234,
      "volts": 230,
      "watts": 850,
      "state": "normal"
    }

    This parser is intentionally defensive for demo reliability.
    Bad lines return None instead of crashing the bridge.
    """
    if isinstance(line, bytes):
        line = line.decode("utf-8", errors="replace")

    line = str(line).strip()

    if not line:
        return None

    try:
        data = json.loads(line)
    except (ValueError, TypeError):
        return None

    if not isinstance(data, dict):
        return None

    try:
        device_id = str(data.get("device_id") or data.get("meter_id") or "unknown")
        uptime_ms = int(data.get("ts", data.get("uptime_ms", 0)))
        volts = float(data.get("volts", data.get("voltage", 230)))
        watts = float(data.get("watts", 0))
        state = str(data.get("state", "normal")).lower().strip()
    except (TypeError, ValueError):
        return None

    if watts < 0:
        return None

    if state not in VALID_STATES:
        state = "normal"

    return {
        "device_id": device_id,
        "ts_iso": ts_iso,
        "uptime_ms": uptime_ms,
        "volts": volts,
        "watts": watts,
        "state": state,
    }


def format_tick(elapsed_seconds):
    if elapsed_seconds < 60:
        return f"{elapsed_seconds}s"
    minutes, seconds = divmod(elapsed_seconds, 60)
    return f"{minutes}m{seconds:02d}s"


def is_overuse(record, threshold_watts):
    """True when a reading's power draw exceeds the overuse threshold."""
    try:
        return float(record["watts"]) > float(threshold_watts)
    except (KeyError, TypeError, ValueError):
        return False


def format_alert(label, watts):
    """Human-readable overuse alert, e.g. 'kettle is overusing electricity (2180W)'."""
    return f"{label} is overusing electricity ({watts}W)"
