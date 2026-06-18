"""Simple electricity heuristics for the local demo (no ML, no backend).

All functions are pure so they're easy to test. The bridge accumulates kWh as
readings arrive, derives cost from a flat tariff, and projects when the prepaid
balance runs out at the current rate of draw.
"""


def accumulate_kwh(prev_kwh, watts, dt_seconds):
    """Add the energy used since the last reading. kWh = kW * hours."""
    return prev_kwh + (watts / 1000.0) * (dt_seconds / 3600.0)


def cost_rand(kwh, rate_per_kwh):
    """Cost of the energy used so far, in Rand."""
    return round(kwh * rate_per_kwh, 2)


def project_runout_seconds(balance_rand, watts, rate_per_kwh):
    """Seconds until the prepaid balance hits zero at the current draw.

    Returns None when nothing is being drawn (would never run out).
    """
    if watts <= 0 or rate_per_kwh <= 0:
        return None
    rand_per_second = (watts / 1000.0) / 3600.0 * rate_per_kwh
    if rand_per_second <= 0:
        return None
    return balance_rand / rand_per_second


def format_duration(seconds):
    """Human-friendly countdown, e.g. '~2d 5h', '~3h 10m', '~12m'."""
    if seconds is None:
        return "—"
    seconds = int(seconds)
    days, rem = divmod(seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes = rem // 60
    if days > 0:
        return f"~{days}d {hours}h"
    if hours > 0:
        return f"~{hours}h {minutes}m"
    return f"~{minutes}m"


def build_live_message(rec, kwh, balance_rand, rate_per_kwh, overuse_count):
    """Combine a raw reading with the derived heuristics into one UI message."""
    runout = project_runout_seconds(balance_rand, rec["watts"], rate_per_kwh)
    return {
        "device_id": rec["device_id"],
        "ts_iso": rec["ts_iso"],
        "volts": rec["volts"],
        "watts": rec["watts"],
        "state": rec["state"],
        "kwh": round(kwh, 4),
        "cost_rand": cost_rand(kwh, rate_per_kwh),
        "balance_rand": round(balance_rand, 2),
        "runout_eta": format_duration(runout),
        "overuse_count": overuse_count,
    }
