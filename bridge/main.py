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
from bridge.serial_io import open_port, describe_ports, find_arduino_port
from bridge.predict import accumulate_kwh, build_live_message
from bridge.server import LiveServer
from bridge.backend_client import (
    API_URL,
    PERSIST_TO_BACKEND,
    post_reading_to_backend,
    post_live_message_to_backend,
    poll_backend_commands,
)


# --- Config ---
# "auto" (the default) scans for the Arduino so a fixed COM number never has to
# be right. Set SERIAL_PORT=COM5 to force a specific port.
PORT = os.environ.get("SERIAL_PORT", "auto")
BAUD = int(os.environ.get("BAUD", "9600"))
MAX_SECONDS = int(os.environ.get("MAX_SECONDS", "180"))
TICK_SECONDS = int(os.environ.get("TICK_SECONDS", "15"))
WATTS_THRESHOLD = int(os.environ.get("WATTS_THRESHOLD", "1500"))
DEVICE_LABEL = os.environ.get("DEVICE_LABEL", "Kitchen")
DATA_DIR = os.environ.get("DATA_DIR", "bridge/data")

# Live data + heuristics
WS_HOST = os.environ.get("WS_HOST", "localhost")
WS_PORT = int(os.environ.get("WS_PORT", "8765"))
# Local WebSocket server is legacy/optional now that the backend relays live data.
# Disable it (e.g. inside Docker) to avoid binding a port no browser connects to.
ENABLE_LOCAL_WS = os.environ.get("ENABLE_LOCAL_WS", "true").lower() not in {
    "0",
    "false",
    "no",
    "off",
}
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


def resolve_port():
    """Figure out which COM port to open.

    - SERIAL_PORT=auto (default): scan for the board.
    - SERIAL_PORT=COM5: try it; if it isn't there, fall back to a scan so a
      stale COM number doesn't stop a demo.
    Returns a device name or None if nothing was found.
    """
    if PORT.strip().lower() == "auto":
        found = find_arduino_port()
        if found:
            print(f"Auto-detected Arduino on {found}.")
        return found

    if PORT in (None, ""):
        return find_arduino_port()

    # A specific port was requested. Honour it if present, else auto-detect.
    from bridge.serial_io import available_ports

    if PORT in available_ports():
        return PORT

    fallback = find_arduino_port()
    if fallback:
        print(f"'{PORT}' not found; using auto-detected {fallback} instead.")
    return fallback


def run():
    port = resolve_port()

    if port is None:
        print("No Arduino found. Available ports:")
        print(describe_ports())
        print("Plug the board in, or set SERIAL_PORT=COMx and retry.")
        sys.exit(1)

    try:
        ser = open_port(port, BAUD)
    except serial.SerialException:
        print(f"Could not open port '{port}'. Available ports:")
        print(describe_ports())
        sys.exit(1)

    storage = Storage(DATA_DIR)

    server = None
    if ENABLE_LOCAL_WS:
        server = LiveServer(WS_HOST, WS_PORT)
        server.start()
        print(f"Local live data on ws://{WS_HOST}:{WS_PORT}")
    else:
        print("Local WS server disabled; live data relayed via backend.")

    print(f"FastAPI persistence: {'enabled' if PERSIST_TO_BACKEND else 'disabled'}")
    print(f"FastAPI ingest URL: {API_URL}")

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

            if elapsed >= MAX_SECONDS:
                break

            if elapsed >= next_tick:
                print(f"{format_tick(int(elapsed))}...")
                next_tick += TICK_SECONDS

            # Commands coming back from the dashboard, from the local WS server
            # (legacy) and/or the hosted backend relay.
            commands = poll_backend_commands()
            if server is not None:
                commands += server.poll_commands()
            for cmd in commands:
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

            raw = ser.readline().decode("utf-8", errors="replace")
            rec = parse_reading(raw, now_iso())

            if rec is None:
                continue

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

            # 1. Push instantly to frontend dashboard (local WS + backend relay).
            if server is not None:
                server.publish(live_message)
            post_live_message_to_backend(live_message)

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
