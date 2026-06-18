import json

REQUIRED_KEYS = ("device_id", "ts", "volts", "watts", "state")


def parse_reading(line, ts_iso):
    line = line.strip()
    if not line:
        return None
    try:
        data = json.loads(line)
    except (ValueError, TypeError):
        return None
    if not isinstance(data, dict):
        return None
    if any(k not in data for k in REQUIRED_KEYS):
        return None
    return {
        "device_id": data["device_id"],
        "ts_iso": ts_iso,
        "uptime_ms": data["ts"],
        "volts": data["volts"],
        "watts": data["watts"],
        "state": data["state"],
    }


def format_tick(elapsed_seconds):
    if elapsed_seconds < 60:
        return f"{elapsed_seconds}s"
    minutes, seconds = divmod(elapsed_seconds, 60)
    return f"{minutes}m{seconds:02d}s"


def is_overuse(record, threshold_watts):
    """True when a reading's power draw exceeds the overuse threshold."""
    return record["watts"] > threshold_watts


def format_alert(label, watts):
    """Human-readable overuse alert, e.g. 'kettle is overusing electricity (2180W)'."""
    return f"{label} is overusing electricity ({watts}W)"
