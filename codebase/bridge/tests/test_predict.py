from bridge.predict import (
    accumulate_kwh,
    cost_rand,
    project_runout_seconds,
    format_duration,
    build_live_message,
)


def test_accumulate_kwh_one_hour_at_1kw():
    # 1000W for 3600s = 1.0 kWh added
    assert accumulate_kwh(0.0, 1000, 3600) == 1.0


def test_accumulate_kwh_adds_to_previous():
    assert accumulate_kwh(2.0, 1000, 3600) == 3.0


def test_cost_rand_rounds_to_cents():
    assert cost_rand(1.0, 2.5) == 2.5
    assert cost_rand(0.123, 2.5) == 0.31


def test_project_runout_none_when_no_draw():
    assert project_runout_seconds(100, 0, 2.5) is None


def test_project_runout_positive_when_drawing():
    # drawing power against a positive balance => finite seconds
    secs = project_runout_seconds(100, 1000, 2.5)
    assert secs is not None and secs > 0


def test_format_duration_buckets():
    assert format_duration(None) == "—"
    assert format_duration(90) == "~1m"
    assert format_duration(3 * 3600 + 10 * 60) == "~3h 10m"
    assert format_duration(2 * 86400 + 5 * 3600) == "~2d 5h"


def test_build_live_message_shape():
    rec = {
        "device_id": "uno1",
        "ts_iso": "2026-06-18T12:46:00Z",
        "volts": 230,
        "watts": 1800,
        "state": "normal",
    }
    msg = build_live_message(rec, kwh=0.5, balance_rand=100.0, rate_per_kwh=2.5, overuse_count=2)
    assert msg["device_id"] == "uno1"
    assert msg["watts"] == 1800
    assert msg["kwh"] == 0.5
    assert msg["cost_rand"] == 1.25
    assert msg["balance_rand"] == 100.0
    assert msg["overuse_count"] == 2
    assert isinstance(msg["runout_eta"], str)
