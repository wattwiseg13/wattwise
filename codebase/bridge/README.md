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
