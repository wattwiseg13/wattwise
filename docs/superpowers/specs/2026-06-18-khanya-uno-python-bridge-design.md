# Khanya — UNO ↔ Python Serial Bridge (demo path)

**Date:** 2026-06-18
**Owner:** Hardware/Backend (Mike's side)
**Status:** Approved design, ready for implementation plan

## Goal

Build the "UNO + laptop USB bridge" demo path from the Khanya architecture. When
triggered, a Python service tells an Arduino UNO to turn on an LED (standing in
for "appliance drawing power"), the UNO streams voltage readings as JSON over
USB serial, and Python catches, timestamps, and stores those readings locally.
Runs for a maximum of 3 minutes, printing a progress ticker as it goes.

Local file storage now; Postgres later (backend team). The JSON shape matches
the locked Khanya data contract so the handoff is clean.

## Scope

In scope:
- Arduino C++ sketch (`khanya_uno.ino`)
- Python bridge service (`bridge.py`)
- Local storage to `data/readings.jsonl` and `data/readings.csv`

Out of scope (later): real voltage sensor wiring, Supabase/Postgres POST,
USSD/WhatsApp, dashboard.

## A. Serial protocol

- USB serial, **9600 baud**, line-based (one message per line, `\n` terminated).
- **Python → Arduino** (commands): `START\n`, `STOP\n`
- **Arduino → Python** (data): one JSON object per line:

```json
{"device_id":"uno1","ts":12345,"volts":231,"watts":0,"state":"on"}
```

- `ts` from the Arduino = **milliseconds since boot** (`millis()`); the UNO has
  no real clock. Python adds the real wall-clock ISO timestamp on receipt.
- `watts` / `kwh` stay `0` for the LED demo; fields exist so nothing breaks when
  a real sensor is added.

## B. Arduino sketch (`khanya_uno.ino`)

1. On boot: LED off, listen on serial.
2. Receive `START` → LED **on**, send one JSON line **every 1 second**.
3. `volts` = simulated placeholder wobbling around 230 (swap one line for a real
   `analogRead(...)` conversion when the sensor arrives).
4. Receive `STOP` → LED **off**, stop sending.

LED on = "appliance drawing power" (demo metaphor).

## C. Python bridge (`bridge.py`)

Flow on start:
1. Open serial port, send `START`.
2. Loop reading lines until the **3-minute max timer** elapses (or Ctrl+C).
3. Each valid JSON line → add real ISO timestamp → append to storage → optional print.
4. **Progress ticker** prints elapsed time (e.g. `30s... 45s... 1m00s...`) up to the cap.
5. On timeout → send `STOP`, close port, print summary (count + file paths).

Config constants at top of file:
- `PORT` (e.g. `COM3` on Windows)
- `BAUD = 9600`
- `MAX_SECONDS = 180`
- `TICK_SECONDS = 15`

Dependency: `pyserial`.

## D. Storage (local, Postgres-ready)

Append each reading to a `data/` folder in two formats:
- `readings.jsonl` — one JSON object per line (bulk-insert ready for Postgres).
- `readings.csv` — same data in columns for easy eyeballing.

Columns/fields: `device_id, ts_iso, uptime_ms, volts, watts, state`.

## E. Error handling

- Port won't open / wrong COM port → clear message listing available ports.
- Garbled/partial JSON line → skip it, keep going (no crash).
- Ctrl+C → send `STOP`, close cleanly, save what we have.
