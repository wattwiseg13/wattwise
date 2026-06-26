import os
import sys
import time
from datetime import datetime, timezone

import serial

try:
    import msvcrt  # Windows: lets us check for a keypress without blocking
except ImportError:  # pragma: no cover - non-Windows fallback
    msvcrt = None

from bridge.protocol import parse_reading, format_tick, is_overuse, format_alert
from bridge.storage import Storage
from bridge.serial_io import open_port, describe_ports
from bridge.predict import accumulate_kwh, build_live_message
from bridge.server import LiveServer
from bridge.backend_client import API_URL, PERSIST_TO_BACKEND, post_reading_to_backend


# --- Config ---
# --- Config ---
PORT = os.environ.get("SERIAL_PORT", "COM3")
BAUD = int(os.environ.get("BAUD", "115200"))

# 0 means "run until Ctrl+C / STOP / OFF".
MAX_SECONDS = int(os.environ.get("MAX_SECONDS", "0"))

TICK_SECONDS = int(os.environ.get("TICK_SECONDS", "15"))
WATTS_THRESHOLD = int(os.environ.get("WATTS_THRESHOLD", "1500"))
DEVICE_LABEL = os.environ.get("DEVICE_LABEL", "Kitchen")
DATA_DIR = os.environ.get("DATA_DIR", "bridge/data")

# Live data + heuristics
WS_HOST = os.environ.get("WS_HOST", "0.0.0.0")
WS_PORT = int(os.environ.get("WS_PORT", "8765"))
WS_PUBLIC_URL = os.environ.get("WS_PUBLIC_URL", f"ws://127.0.0.1:{WS_PORT}")
RATE_PER_KWH = float(os.environ.get("RATE_PER_KWH", "3.90"))
STARTING_BALANCE = float(os.environ.get("STARTING_BALANCE", "100.0"))
# Live data + heuristics
WS_HOST = os.environ.get("WS_HOST", "localhost")
WS_PORT = int(os.environ.get("WS_PORT", "8765"))
RATE_PER_KWH = float(os.environ.get("RATE_PER_KWH", "3.90"))
STARTING_BALANCE = float(os.environ.get("STARTING_BALANCE", "100.0"))


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def switch_off(ser):
    """Tell the Arduino to cut the appliance."""
    try:
        ser.write(b"OFF\n")
    except serial.SerialException:
        pass


def off_key_pressed():
    """True if the user pressed 'o'. Windows only; safe elsewhere."""
    if msvcrt is None:
        return False

    if msvcrt.kbhit():
        return msvcrt.getch().lower() == b"o"

    return False


def run():
    try:
        ser = open_port(PORT, BAUD)
    except serial.SerialException:
        print(f"Could not open port '{PORT}'. Available ports:")
        print(describe_ports())
        sys.exit(1)

    storage = Storage(DATA_DIR)

    server = LiveServer(WS_HOST, WS_PORT)
    server.start()

    print("=" * 72)
    print("WattWise Arduino Bridge")
    print("=" * 72)
    print(f"Serial port: {PORT}")
    print(f"Baud rate: {BAUD}")
    print(f"WebSocket bind: ws://{WS_HOST}:{WS_PORT}")
    print(f"Frontend should connect to: {WS_PUBLIC_URL}")
    print(f"FastAPI persistence: {'enabled' if PERSIST_TO_BACKEND else 'disabled'}")
    print(f"FastAPI ingest URL: {API_URL}")
    print(f"Run duration: {'until stopped' if MAX_SECONDS <= 0 else f'{MAX_SECONDS}s'}")
    print("=" * 72)

    time.sleep(2)  # let the UNO reset after the port opens
    ser.reset_input_buffer()
    ser.write(b"START\n")

    print(
        f"Sent START. Monitoring for up to {MAX_SECONDS}s. "
        f"Press 'o' to switch off when an alert fires (Ctrl+C to stop early)..."
    )

    start = time.monotonic()
    next_tick = TICK_SECONDS
    in_alert = False
    switched_off = False
    kwh = 0.0
    overuse_count = 0
    last_time = time.monotonic()
    backend_warning_printed = False

    try:
        while True:
            elapsed = time.monotonic() - start

            if MAX_SECONDS > 0 and elapsed >= MAX_SECONDS:
                break
                
            if elapsed >= next_tick:
                print(f"{format_tick(int(elapsed))}...")
                next_tick += TICK_SECONDS

            # Commands coming back from the dashboard (over the WebSocket).
            for cmd in server.poll_commands():
                cmd = cmd.strip().upper()
                if cmd == "MUTE":
                    try:
                        ser.write(b"MUTE\n")
                    except serial.SerialException:
                        pass
                    print("  --> Alarm muted by user (usage unchanged).")
                elif cmd == "OFF":
                    switch_off(ser)
                    switched_off = True
                    print(f"  --> Switched OFF {DEVICE_LABEL} from the dashboard.")
                    break
            if switched_off:
                break

            # Let the user switch off the overusing appliance.
            if off_key_pressed():
                switch_off(ser)
                switched_off = True
                print(f"  --> Switched OFF {DEVICE_LABEL}. Appliance cut.")
                break

           try:
    raw_bytes = ser.readline()
except serial.SerialException as error:
    print(f"  !! Serial read failed: {error}")
    time.sleep(0.2)
    continue

if not raw_bytes:
    # Short serial timeout means no data is normal.
    # Sleep very briefly to avoid a busy CPU loop.
    time.sleep(0.005)
    continue

raw = raw_bytes.decode("utf-8", errors="replace")
rec = parse_reading(raw, now_iso())

if rec is None:
    continue

reading_count += 1

            storage.write(rec)

            if rec["state"] == "off":
                switched_off = True
                print(f"  --> {DEVICE_LABEL} was switched off at the device.")
                break

            # Accumulate energy + cost since the last reading.
            now = time.monotonic()
            kwh = accumulate_kwh(kwh, rec["watts"], now - last_time)
            last_time = now

            overuse = is_overuse(rec, WATTS_THRESHOLD)

            if overuse:
                overuse_count += 1

            balance = STARTING_BALANCE - (kwh * RATE_PER_KWH)

            live_message = build_live_message(
                rec,
                kwh,
                balance,
                RATE_PER_KWH,
                overuse_count,
            )

            # 1. Push instantly to frontend dashboard.
            server.publish(live_message)

            # 2. Persist the same reading to FastAPI/PostgreSQL.
            backend_result = post_reading_to_backend(rec)

            if not backend_result["ok"] and not backend_warning_printed:
                backend_warning_printed = True
                print(
                    "  !! Backend persistence failed. "
                    "Live dashboard will still work, but readings may not save."
                )
                print(f"     {backend_result['message']}")

            if backend_result["ok"] and backend_warning_printed:
                backend_warning_printed = False
                reading_count = 0
                last_status_log = time.monotonic()
                print("  --> Backend persistence recovered.")

            if overuse:
                if not in_alert:
                    in_alert = True
                    print(f"  !! ALERT: {format_alert(DEVICE_LABEL, rec['watts'])}")
                    print("     Press 'o' to switch it off.")
                else:
                    print(f"  !! {rec['watts']}W (still overusing)")
            else:
                in_alert = False
                print(f"  {rec['watts']}W  {rec['volts']}V  state={rec['state']}")

    except KeyboardInterrupt:
        print("\nStopped early by user.")

    finally:
        try:
            ser.write(b"STOP\n")
        except serial.SerialException:
            pass

        ser.close()

        status = "switched off" if switched_off else "stopped"

        print(
            f"Done ({status}). Collected {storage.count} readings -> "
            f"{storage.jsonl_path} and {storage.csv_path}"
        )


if __name__ == "__main__":
    run()
