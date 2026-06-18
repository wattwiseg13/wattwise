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

# --- Config ---
PORT = "COM3"            # change to your Arduino's port (see error message if wrong)
BAUD = 9600
MAX_SECONDS = 180        # 3-minute cap
TICK_SECONDS = 15        # progress print interval
WATTS_THRESHOLD = 2000   # alert when power draw goes above this (watts)
DEVICE_LABEL = "kettle"  # friendly name used in the alert message
DATA_DIR = "bridge/data"


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def switch_off(ser):
    """Tell the Arduino to cut the appliance (LED off, stop streaming)."""
    try:
        ser.write(b"OFF\n")
    except serial.SerialException:
        pass


def off_key_pressed():
    """True if the user pressed 'o' (the switch-off key). Windows only; safe elsewhere."""
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
    time.sleep(2)  # let the UNO reset after the port opens
    ser.reset_input_buffer()
    ser.write(b"START\n")
    print(
        f"Sent START. Monitoring for up to {MAX_SECONDS}s. "
        f"Press 'o' to switch off when an alert fires (Ctrl+C to stop early)..."
    )

    start = time.monotonic()
    next_tick = TICK_SECONDS
    in_alert = False        # track so we print the alert only once per spike
    switched_off = False
    try:
        while True:
            elapsed = time.monotonic() - start
            if elapsed >= MAX_SECONDS:
                break
            if elapsed >= next_tick:
                print(f"{format_tick(int(elapsed))}...")
                next_tick += TICK_SECONDS

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

            if is_overuse(rec, WATTS_THRESHOLD):
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
