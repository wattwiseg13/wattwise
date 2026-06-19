from bridge.protocol import parse_reading, format_tick, is_overuse, format_alert


def test_parse_valid_line():
    line = '{"device_id":"uno1","ts":12345,"volts":231,"watts":0,"state":"on"}'
    rec = parse_reading(line, "2026-06-18T12:46:00Z")
    assert rec == {
        "device_id": "uno1",
        "ts_iso": "2026-06-18T12:46:00Z",
        "uptime_ms": 12345,
        "volts": 231,
        "watts": 0,
        "state": "on",
    }


def test_parse_blank_line_returns_none():
    assert parse_reading("", "2026-06-18T12:46:00Z") is None
    assert parse_reading("   \r\n", "2026-06-18T12:46:00Z") is None


def test_parse_garbled_line_returns_none():
    assert parse_reading("{not json", "2026-06-18T12:46:00Z") is None
    assert parse_reading("hello world", "2026-06-18T12:46:00Z") is None


def test_parse_missing_key_returns_none():
    line = '{"device_id":"uno1","ts":12345}'
    assert parse_reading(line, "2026-06-18T12:46:00Z") is None


def test_format_tick_under_minute():
    assert format_tick(30) == "30s"
    assert format_tick(45) == "45s"


def test_format_tick_over_minute():
    assert format_tick(60) == "1m00s"
    assert format_tick(135) == "2m15s"


def test_is_overuse_above_and_below_threshold():
    assert is_overuse({"watts": 2180}, 2000) is True
    assert is_overuse({"watts": 2000}, 2000) is False  # exactly at threshold = not over
    assert is_overuse({"watts": 350}, 2000) is False


def test_format_alert_message():
    assert format_alert("kettle", 2180) == "kettle is overusing electricity (2180W)"
