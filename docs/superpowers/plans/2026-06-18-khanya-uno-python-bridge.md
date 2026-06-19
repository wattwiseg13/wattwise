# Khanya UNO ↔ Python Serial Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python service that triggers an Arduino UNO (LED on), reads streamed voltage JSON over USB serial for up to 3 minutes with a progress ticker, and stores readings to local CSV + JSON-lines.

**Architecture:** Two halves speaking a line-based 9600-baud serial protocol. The Arduino sketch (`khanya_uno.ino`) responds to `START`/`STOP` commands, blinks an LED, and emits one JSON reading per second. The Python bridge sends `START`, parses each line with pure functions (easy to unit-test), appends to storage, prints elapsed-time ticks, and sends `STOP` at the 3-minute cap. Serial I/O is isolated in `main.py`; all logic lives in pure, tested modules.

**Tech Stack:** Python 3, `pyserial`, `pytest`; Arduino C++ (Arduino IDE).

## Global Constraints

- Serial: line-based, `9600` baud, `\n`-terminated, one message per line.
- Commands Python→Arduino: `START`, `STOP`. Data Arduino→Python: one JSON object per line.
- Reading JSON shape (Arduino): `{"device_id":"uno1","ts":<millis>,"volts":<int>,"watts":0,"state":"on"}`.
- Arduino `ts` = `millis()` (ms since boot); Python adds real ISO timestamp on receipt.
- Stored record fields, in this exact order: `device_id, ts_iso, uptime_ms, volts, watts, state`.
- Config constants live at top of `bridge/main.py`: `PORT`, `BAUD = 9600`, `MAX_SECONDS = 180`, `TICK_SECONDS = 15`.
- All bridge files live under `bridge/`. Storage output goes to `bridge/data/`.

---

### Task 1: Project scaffold + protocol parsing

**Files:**
- Create: `bridge/requirements.txt`
- Create: `bridge/protocol.py`
- Create: `bridge/tests/__init__.py` (empty)
- Test: `bridge/tests/test_protocol.py`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `parse_reading(line: str, ts_iso: str) -> dict | None` — parses one raw serial line into a storage record dict with keys `device_id, ts_iso, uptime_ms, volts, watts, state`; returns `None` for blank/garbled/non-JSON lines or JSON missing required keys. `uptime_ms` comes from the line's `ts`; `ts_iso` is the passed-in argument.
  - `format_tick(elapsed_seconds: int) -> str` — formats elapsed seconds as `"30s"`, `"45s"`, `"1m00s"`, `"2m15s"` (under 60s → `"<n>s"`; 60s+ → `"<m>m<ss>s"` zero-padded seconds).

- [ ] **Step 1: Create requirements file**

`bridge/requirements.txt`:
```
pyserial==3.5
pytest==8.2.0
```

- [ ] **Step 2: Write the failing tests**

`bridge/tests/test_protocol.py`:
```python
from bridge.protocol import parse_reading, format_tick


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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd bridge && python -m pytest tests/test_protocol.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'bridge.protocol'`

- [ ] **Step 4: Write minimal implementation**

`bridge/protocol.py`:
```python
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
```

Create empty `bridge/tests/__init__.py`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd bridge && python -m pytest tests/test_protocol.py -v`
Expected: PASS (6 passed)

- [ ] **Step 6: Commit**

```bash
git add bridge/requirements.txt bridge/protocol.py bridge/tests/
git commit -m "feat: add serial line protocol parsing for Khanya bridge"
```

---

### Task 2: Local storage (CSV + JSON-lines)

**Files:**
- Create: `bridge/storage.py`
- Test: `bridge/tests/test_storage.py`

**Interfaces:**
- Consumes: record dicts from `parse_reading` (keys `device_id, ts_iso, uptime_ms, volts, watts, state`).
- Produces:
  - `Storage(data_dir: str)` — constructor creates `data_dir` if missing, writes the CSV header row once on first `write`.
  - `Storage.write(record: dict) -> None` — appends one line to `<data_dir>/readings.jsonl` (compact JSON) and one row to `<data_dir>/readings.csv`, fields in order `device_id, ts_iso, uptime_ms, volts, watts, state`.
  - `Storage.count: int` — number of records written so far.

- [ ] **Step 1: Write the failing tests**

`bridge/tests/test_storage.py`:
```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd bridge && python -m pytest tests/test_storage.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'bridge.storage'`

- [ ] **Step 3: Write minimal implementation**

`bridge/storage.py`:
```python
import csv
import json
import os

FIELDS = ["device_id", "ts_iso", "uptime_ms", "volts", "watts", "state"]


class Storage:
    def __init__(self, data_dir):
        os.makedirs(data_dir, exist_ok=True)
        self.jsonl_path = os.path.join(data_dir, "readings.jsonl")
        self.csv_path = os.path.join(data_dir, "readings.csv")
        self.count = 0
        if not os.path.exists(self.csv_path):
            with open(self.csv_path, "w", newline="", encoding="utf-8") as f:
                csv.writer(f).writerow(FIELDS)

    def write(self, record):
        with open(self.jsonl_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")
        with open(self.csv_path, "a", newline="", encoding="utf-8") as f:
            csv.writer(f).writerow([record[k] for k in FIELDS])
        self.count += 1
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd bridge && python -m pytest tests/test_storage.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add bridge/storage.py bridge/tests/test_storage.py
git commit -m "feat: add local CSV + JSONL storage for readings"
```

---

### Task 3: Serial port helper (list ports + open)

**Files:**
- Create: `bridge/serial_io.py`
- Test: `bridge/tests/test_serial_io.py`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `available_ports() -> list[str]` — returns device names of all serial ports (wraps `serial.tools.list_ports.comports`).
  - `describe_ports() -> str` — human-readable multi-line listing of ports for error messages; returns `"  (no serial ports found)"` when empty.
  - `open_port(port: str, baud: int) -> serial.Serial` — opens the port with a 1-second read timeout.

- [ ] **Step 1: Write the failing tests**

`bridge/tests/test_serial_io.py`:
```python
from unittest import mock
from bridge import serial_io


class FakePort:
    def __init__(self, device):
        self.device = device
        self.description = device + " desc"


def test_available_ports_lists_devices():
    with mock.patch.object(
        serial_io, "comports", return_value=[FakePort("COM3"), FakePort("COM4")]
    ):
        assert serial_io.available_ports() == ["COM3", "COM4"]


def test_describe_ports_empty():
    with mock.patch.object(serial_io, "comports", return_value=[]):
        assert serial_io.describe_ports() == "  (no serial ports found)"


def test_describe_ports_lists_entries():
    with mock.patch.object(serial_io, "comports", return_value=[FakePort("COM3")]):
        out = serial_io.describe_ports()
    assert "COM3" in out
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd bridge && python -m pytest tests/test_serial_io.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'bridge.serial_io'`

- [ ] **Step 3: Install dependency, write minimal implementation**

Run: `cd bridge && python -m pip install -r requirements.txt`

`bridge/serial_io.py`:
```python
import serial
from serial.tools.list_ports import comports


def available_ports():
    return [p.device for p in comports()]


def describe_ports():
    ports = list(comports())
    if not ports:
        return "  (no serial ports found)"
    return "\n".join(f"  {p.device} - {p.description}" for p in ports)


def open_port(port, baud):
    return serial.Serial(port, baud, timeout=1)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd bridge && python -m pytest tests/test_serial_io.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add bridge/serial_io.py bridge/tests/test_serial_io.py
git commit -m "feat: add serial port discovery and open helper"
```

---

### Task 4: Main bridge loop (wiring + manual hardware test)

**Files:**
- Create: `bridge/main.py`
- Create: `bridge/__init__.py` (empty, makes `bridge` a package)

**Interfaces:**
- Consumes: `protocol.parse_reading`, `protocol.format_tick`, `storage.Storage`, `serial_io.open_port`, `serial_io.describe_ports`.
- Produces: a runnable `python -m bridge.main` entry point. No new functions other tasks depend on.

- [ ] **Step 1: Create package marker**

Create empty `bridge/__init__.py`.

- [ ] **Step 2: Write the main module**

`bridge/main.py`:
```python
import sys
import time
from datetime import datetime, timezone

import serial

from bridge.protocol import parse_reading, format_tick
from bridge.storage import Storage
from bridge.serial_io import open_port, describe_ports

# --- Config ---
PORT = "COM3"          # change to your Arduino's port (see error message if wrong)
BAUD = 9600
MAX_SECONDS = 180      # 3-minute cap
TICK_SECONDS = 15      # progress print interval
DATA_DIR = "bridge/data"


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def run():
    try:
        ser = open_port(PORT, BAUD)
    except serial.SerialException:
        print(f"Could not open port '{PORT}'. Available ports:")
        print(describe_ports())
        sys.exit(1)

    storage = Storage(DATA_DIR)
    time.sleep(2)  # let the UNO reset after the port opens
    ser.reset_input_buffer()
    ser.write(b"START\n")
    print(f"Sent START. Collecting for up to {MAX_SECONDS}s (Ctrl+C to stop early)...")

    start = time.monotonic()
    next_tick = TICK_SECONDS
    try:
        while True:
            elapsed = time.monotonic() - start
            if elapsed >= MAX_SECONDS:
                break
            if elapsed >= next_tick:
                print(f"{format_tick(int(elapsed))}...")
                next_tick += TICK_SECONDS

            raw = ser.readline().decode("utf-8", errors="replace")
            rec = parse_reading(raw, now_iso())
            if rec is not None:
                storage.write(rec)
                print(f"  {rec['volts']}V  state={rec['state']}")
    except KeyboardInterrupt:
        print("\nStopped early by user.")
    finally:
        try:
            ser.write(b"STOP\n")
        except serial.SerialException:
            pass
        ser.close()
        print(
            f"Done. Collected {storage.count} readings -> "
            f"{storage.jsonl_path} and {storage.csv_path}"
        )


if __name__ == "__main__":
    run()
```

- [ ] **Step 3: Verify the module imports cleanly (no hardware needed)**

Run: `cd bridge && python -c "import bridge.main"` (from the repo root: `python -c "import bridge.main"`)
Expected: no output, exit code 0 (imports succeed).

- [ ] **Step 4: Run the full test suite**

Run: `cd bridge && python -m pytest -v`
Expected: PASS (all 13 tests pass).

- [ ] **Step 5: Commit**

```bash
git add bridge/__init__.py bridge/main.py
git commit -m "feat: add main serial bridge loop with timer and progress ticks"
```

---

### Task 5: Arduino sketch

**Files:**
- Create: `bridge/arduino/khanya_uno/khanya_uno.ino`

(Arduino IDE requires the `.ino` file to live in a folder of the same name.)

**Interfaces:**
- Consumes: `START` / `STOP` commands over serial.
- Produces: one JSON line per second matching the reading contract when streaming.

- [ ] **Step 1: Write the sketch**

`bridge/arduino/khanya_uno/khanya_uno.ino`:
```cpp
// Khanya UNO demo: LED on/off + simulated voltage stream over serial.
const int LED_PIN = LED_BUILTIN;
const unsigned long INTERVAL_MS = 1000;

bool streaming = false;
unsigned long lastSend = 0;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  Serial.begin(9600);
}

void handleCommand(String cmd) {
  cmd.trim();
  if (cmd == "START") {
    streaming = true;
    digitalWrite(LED_PIN, HIGH);
  } else if (cmd == "STOP") {
    streaming = false;
    digitalWrite(LED_PIN, LOW);
  }
}

void loop() {
  if (Serial.available() > 0) {
    handleCommand(Serial.readStringUntil('\n'));
  }

  if (streaming && millis() - lastSend >= INTERVAL_MS) {
    lastSend = millis();
    // Simulated voltage wobbling around 230 (swap for analogRead later).
    int volts = 230 + (int)(random(-5, 6));
    Serial.print("{\"device_id\":\"uno1\",\"ts\":");
    Serial.print(millis());
    Serial.print(",\"volts\":");
    Serial.print(volts);
    Serial.print(",\"watts\":0,\"state\":\"on\"}");
    Serial.print("\n");
  }
}
```

- [ ] **Step 2: Manual hardware verification**

1. Open `khanya_uno.ino` in Arduino IDE, select board **Arduino Uno** and the correct port, click **Upload**.
2. Note the port shown in the IDE; set `PORT` in `bridge/main.py` to match (e.g. `COM3`).
3. Close the Arduino IDE Serial Monitor (only one program can hold the port).
4. From the repo root run: `python -m bridge.main`
Expected: the onboard LED turns on; lines like `230V state=on` print; ticks `15s... 30s...` appear; after 3 min (or Ctrl+C) the LED turns off and a summary prints. `bridge/data/readings.csv` and `readings.jsonl` contain the readings.

- [ ] **Step 3: Commit**

```bash
git add bridge/arduino/khanya_uno/khanya_uno.ino
git commit -m "feat: add Arduino UNO sketch for LED + simulated voltage stream"
```

---

### Task 6: README

**Files:**
- Create: `bridge/README.md`

- [ ] **Step 1: Write the README**

`bridge/README.md`:
```markdown
# Khanya UNO ↔ Python Bridge (demo path)

Triggers an Arduino UNO to turn on an LED and stream simulated voltage readings
over USB serial. Python collects them for up to 3 minutes and saves to local
CSV + JSON-lines. Local now; Postgres later (same JSON shape).

## Setup

1. Install Python deps: `pip install -r requirements.txt`
2. Upload the sketch: open `arduino/khanya_uno/khanya_uno.ino` in Arduino IDE,
   pick board **Arduino Uno** + the right port, click **Upload**.
3. Set `PORT` in `main.py` to your Arduino's port (e.g. `COM3`). If unsure, run
   the bridge — a wrong port prints the list of available ports.

## Run

From the repo root:
```
python -m bridge.main
```
Press Ctrl+C to stop early. Output is written to `bridge/data/`.

## Tests

```
cd bridge && python -m pytest -v
```

## Data contract

Each reading row: `device_id, ts_iso, uptime_ms, volts, watts, state`.
`ts_iso` is the laptop's real UTC time; `uptime_ms` is the Arduino's `millis()`.
`watts` is 0 in the LED demo — swap the sketch's simulated `volts` for a real
sensor reading when the hardware arrives.
```

- [ ] **Step 2: Commit**

```bash
git add bridge/README.md
git commit -m "docs: add bridge README with setup and run instructions"
```

---

## Self-Review

- **Spec coverage:** A (protocol)→Tasks 1,5; B (Arduino sketch)→Task 5; C (Python bridge: START, timer, ticker, STOP, summary)→Task 4; D (CSV+JSONL storage, field order)→Task 2; E (error handling: bad port lists ports→Task 4; garbled line skipped→Task 1; Ctrl+C clean stop→Task 4). All covered.
- **Placeholder scan:** none — all steps contain full code/commands.
- **Type consistency:** `parse_reading`/`format_tick`/`Storage`/`open_port`/`describe_ports` signatures used in Task 4 match their definitions in Tasks 1–3. Field order `device_id, ts_iso, uptime_ms, volts, watts, state` consistent across spec, storage, and tests.
```
