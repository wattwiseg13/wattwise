import json
import os
import time
from typing import Any, Dict, Optional

import requests
import serial


SERIAL_PORT = os.getenv("SERIAL_PORT", "COM4")
BAUD_RATE = int(os.getenv("BAUD_RATE", "9600"))
API_URL = os.getenv("API_URL", "http://localhost:8000/api/readings/ingest")


def parse_arduino_line(line: str) -> Optional[Dict[str, Any]]:
    """
    Preferred Arduino output format:
    {"meter_id":"NXM-001-TZN","watts":850,"voltage":230,"pulse_count":42,"source":"ARDUINO"}

    This function also tries to support simple fallback formats like:
    watts=850,voltage=230,pulse_count=42
    """

    line = line.strip()

    if not line:
        return None

    # Best case: Arduino sends valid JSON
    try:
        data = json.loads(line)

        if "meter_id" not in data:
            data["meter_id"] = "NXM-001-TZN"

        if "source" not in data:
            data["source"] = "ARDUINO"

        return data

    except json.JSONDecodeError:
        pass

    # Fallback: Arduino sends comma-separated key=value pairs
    try:
        data: Dict[str, Any] = {
            "meter_id": "NXM-001-TZN",
            "voltage": 230,
            "source": "ARDUINO",
        }

        parts = line.split(",")

        for part in parts:
            key, value = part.split("=")
            key = key.strip()
            value = value.strip()

            if key in {"watts", "voltage", "current_amps"}:
                data[key] = float(value)
            elif key in {"pulse_count"}:
                data[key] = int(value)
            else:
                data[key] = value

        if "watts" not in data:
            print("Line ignored: no watts value found")
            return None

        return data

    except Exception:
        print(f"Could not parse Arduino line: {line}")
        return None


def post_reading_to_backend(reading: Dict[str, Any]) -> None:
    try:
        response = requests.post(API_URL, json=reading, timeout=5)

        print(f"POST {API_URL} -> {response.status_code}")

        if response.status_code >= 400:
            print(response.text)

    except requests.RequestException as error:
        print(f"Could not send reading to backend: {error}")


def main() -> None:
    print("WattWise Serial Bridge")
    print(f"Serial port: {SERIAL_PORT}")
    print(f"Baud rate: {BAUD_RATE}")
    print(f"Backend API: {API_URL}")
    print("-" * 50)

    try:
        arduino = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        time.sleep(2)
        print("Connected to Arduino. Listening for readings...")
    except serial.SerialException as error:
        print(f"Could not connect to Arduino: {error}")
        print("Check Arduino IDE → Tools → Port")
        return

    while True:
        try:
            raw_line = arduino.readline().decode("utf-8", errors="ignore").strip()

            if not raw_line:
                continue

            print(f"Arduino: {raw_line}")

            reading = parse_arduino_line(raw_line)

            if reading is None:
                continue

            print(f"Parsed reading: {reading}")

            post_reading_to_backend(reading)

        except KeyboardInterrupt:
            print("\nStopping WattWise serial bridge...")
            break


if __name__ == "__main__":
    main()
