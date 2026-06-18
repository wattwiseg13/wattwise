"""Hardware-free simulator: broadcasts the same live messages as the real bridge.

Run this instead of `main` when you have no Arduino plugged in. The UI connects
to the exact same ws://<host>:<port> and receives the exact same JSON shape, so
the frontend team can build and demo against it.

    python -m bridge.simulate
"""

import math
import os
import time
from datetime import datetime, timezone

from bridge.server import LiveServer
from bridge.predict import accumulate_kwh, build_live_message
from bridge.protocol import is_overuse
from bridge.backend_client import API_URL, PERSIST_TO_BACKEND, post_reading_to_backend


WS_HOST = os.environ.get("WS_HOST", "localhost")
WS_PORT = int(os.environ.get("WS_PORT", "8765"))
WATTS_THRESHOLD = int(os.environ.get("WATTS_THRESHOLD", "1500"))
RATE_PER_KWH = float(os.environ.get("RATE_PER_KWH", "3.90"))
STARTING_BALANCE = float(os.environ.get("STARTING_BALANCE", "100.0"))
PERIOD_S = int(os.environ.get("PERIOD_S", "30"))


def sim_watts(elapsed_seconds):
    """Synthetic power sweeping ~200..2600W, crossing the alert line each cycle."""
    watts = 1400 + 1200 * math.sin(2 * math.pi * elapsed_seconds / PERIOD_S)
    return max(0, int(watts))


def run():
    server = LiveServer(WS_HOST, WS_PORT)
    server.start()

    print(f"SIMULATOR live on ws://{WS_HOST}:{WS_PORT} (no hardware). Ctrl+C to stop.")
    print(f"FastAPI persistence: {'enabled' if PERSIST_TO_BACKEND else 'disabled'}")
    print(f"FastAPI ingest URL: {API_URL}")

    start = time.monotonic()
    last = start
    kwh = 0.0
    overuse_count = 0
    backend_warning_printed = False

    try:
        while True:
            now = time.monotonic()
            watts = sim_watts(now - start)

            rec = {
                "device_id": "sim1",
                "ts_iso": datetime.now(timezone.utc).isoformat(),
                "uptime_ms": int((now - start) * 1000),
                "volts": 230,
                "watts": watts,
                "state": "alert" if watts > WATTS_THRESHOLD else "normal",
            }

            kwh = accumulate_kwh(kwh, watts, now - last)
            last = now

            if is_overuse(rec, WATTS_THRESHOLD):
                overuse_count += 1

            balance = STARTING_BALANCE - kwh * RATE_PER_KWH

            live_message = build_live_message(
                rec,
                kwh,
                balance,
                RATE_PER_KWH,
                overuse_count,
            )

            # 1. Push instantly to frontend dashboard.
            server.publish(live_message)

            # 2. Persist simulator data to FastAPI/PostgreSQL too.
            backend_result = post_reading_to_backend(
                rec,
                source="SIMULATOR_BRIDGE",
            )

            if not backend_result["ok"] and not backend_warning_printed:
                backend_warning_printed = True
                print(
                    "  !! Backend persistence failed. "
                    "Live simulator will still work, but readings may not save."
                )
                print(f"     {backend_result['message']}")

            if backend_result["ok"] and backend_warning_printed:
                backend_warning_printed = False
                print("  --> Backend persistence recovered.")

            print(f"  {watts}W  state={rec['state']}")

            time.sleep(1)

    except KeyboardInterrupt:
        print("\nSimulator stopped.")


if __name__ == "__main__":
    run()
