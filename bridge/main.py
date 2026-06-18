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
