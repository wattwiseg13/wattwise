"""Hardware-free simulator: broadcasts the same live messages as the real bridge.

Run this instead of `main` when you have no Arduino plugged in. The UI connects
to the exact same ws://<host>:<port> and receives the exact same JSON shape, so
the frontend team can build and demo against it. Power sweeps up and down through
the alert line every cycle, so you see normal -> alert -> normal automatically.

    python -m bridge.simulate
"""

import math
import os
import time
from datetime import datetime, timezone

from bridge.server import LiveServer
from bridge.predict import accumulate_kwh, build_live_message
from bridge.protocol import is_overuse

WS_HOST = os.environ.get("WS_HOST", "localhost")
WS_PORT = int(os.environ.get("WS_PORT", "8765"))
WATTS_THRESHOLD = 2000
RATE_PER_KWH = 2.50
STARTING_BALANCE = 100.0
PERIOD_S = 30  # one normal -> alert -> normal sweep takes this many seconds


def sim_watts(elapsed_seconds):
    """Synthetic power sweeping ~200..2600W, crossing the alert line each cycle."""
    w = 1400 + 1200 * math.sin(2 * math.pi * elapsed_seconds / PERIOD_S)
    return max(0, int(w))


def run():
    server = LiveServer(WS_HOST, WS_PORT)
    server.start()
    print(f"SIMULATOR live on ws://{WS_HOST}:{WS_PORT} (no hardware). Ctrl+C to stop.")

    start = time.monotonic()
    last = start
    kwh = 0.0
    overuse_count = 0
    try:
        while True:
            now = time.monotonic()
            watts = sim_watts(now - start)
            rec = {
                "device_id": "sim1",
                "ts_iso": datetime.now(timezone.utc).isoformat(),
                "volts": 230,
                "watts": watts,
                "state": "alert" if watts > WATTS_THRESHOLD else "normal",
            }
            kwh = accumulate_kwh(kwh, watts, now - last)
            last = now
            if is_overuse(rec, WATTS_THRESHOLD):
                overuse_count += 1
            balance = STARTING_BALANCE - kwh * RATE_PER_KWH
            server.publish(build_live_message(rec, kwh, balance, RATE_PER_KWH, overuse_count))
            print(f"  {watts}W  state={rec['state']}")
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nSimulator stopped.")


if __name__ == "__main__":
    run()
