import json
from bridge.storage import Storage

REC = {
    "device_id": "uno1",
    "ts_iso": "2026-06-18T12:46:00Z",
    "uptime_ms": 12345,
    "volts": 231,
    "watts": 0,
    "state": "on",
}


def test_write_creates_files(tmp_path):
    s = Storage(str(tmp_path))
    s.write(REC)
    assert (tmp_path / "readings.jsonl").exists()
    assert (tmp_path / "readings.csv").exists()


def test_jsonl_roundtrip(tmp_path):
    s = Storage(str(tmp_path))
    s.write(REC)
    line = (tmp_path / "readings.jsonl").read_text().strip()
    assert json.loads(line) == REC


def test_csv_header_and_row(tmp_path):
    s = Storage(str(tmp_path))
    s.write(REC)
    lines = (tmp_path / "readings.csv").read_text().splitlines()
    assert lines[0] == "device_id,ts_iso,uptime_ms,volts,watts,state"
    assert lines[1] == "uno1,2026-06-18T12:46:00Z,12345,231,0,on"


def test_count_and_append(tmp_path):
    s = Storage(str(tmp_path))
    s.write(REC)
    s.write(REC)
    assert s.count == 2
    csv_lines = (tmp_path / "readings.csv").read_text().splitlines()
    assert len(csv_lines) == 3  # header + 2 rows
