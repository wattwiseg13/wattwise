import os

import serial
from serial.tools.list_ports import comports


DEFAULT_SERIAL_TIMEOUT_SECONDS = float(
    os.environ.get("SERIAL_TIMEOUT_SECONDS", "0.05")
)

DEFAULT_SERIAL_WRITE_TIMEOUT_SECONDS = float(
    os.environ.get("SERIAL_WRITE_TIMEOUT_SECONDS", "0.2")
)

ARDUINO_KEYWORDS = (
    "arduino",
    "uno",
    "ch340",
    "wch",
    "usb serial",
    "usb2.0-serial",
    "usb-serial",
    "cp210",
    "silicon labs",
)


def available_ports():
    return [p.device for p in comports()]


def describe_ports():
    ports = list(comports())

    if not ports:
        return "  (no serial ports found)"

    return "\n".join(
        f"  {p.device} - {p.description}"
        for p in ports
    )


def find_arduino_port():
    """
    Try to auto-detect the Arduino/USB serial port.

    Why:
    - Hardcoding COM3 breaks when COM3 is occupied.
    - Different laptops may use COM4, COM5, /dev/ttyACM0, etc.
    - This keeps the demo plug-and-play.

    Returns:
    - port.device if exactly one likely Arduino is found
    - first available port if only one serial device exists
    - None if detection is ambiguous or no ports exist
    """

    ports = list(comports())

    if not ports:
        return None

    likely_ports = []

    for port in ports:
        searchable = " ".join(
            str(value or "").lower()
            for value in (
                port.device,
                port.description,
                port.manufacturer,
                port.product,
                port.hwid,
            )
        )

        if any(keyword in searchable for keyword in ARDUINO_KEYWORDS):
            likely_ports.append(port.device)

    if len(likely_ports) == 1:
        return likely_ports[0]

    # Safe fallback: if only one serial device exists, use it.
    if len(ports) == 1:
        return ports[0].device

    # Multiple possible devices: do not guess.
    return None


def resolve_port(preferred_port=None):
    """
    Decide which serial port to use.

    Priority:
    1. preferred_port argument
    2. SERIAL_PORT environment variable
    3. auto-detected Arduino/USB serial port
    4. helpful error if detection fails
    """

    if preferred_port:
        return preferred_port

    env_port = os.environ.get("SERIAL_PORT")

    if env_port:
        return env_port

    detected_port = find_arduino_port()

    if detected_port:
        return detected_port

    raise serial.SerialException(
        "Could not auto-detect Arduino serial port. "
        "Set SERIAL_PORT manually.\n"
        f"Available ports:\n{describe_ports()}"
    )


def open_port(port=None, baud=115200, timeout=None):
    """
    Open the Arduino serial port.

    If port is None, try to auto-detect it.
    """

    resolved_port = resolve_port(port)

    return serial.Serial(
        port=resolved_port,
        baudrate=baud,
        timeout=DEFAULT_SERIAL_TIMEOUT_SECONDS if timeout is None else timeout,
        write_timeout=DEFAULT_SERIAL_WRITE_TIMEOUT_SECONDS,
    )
