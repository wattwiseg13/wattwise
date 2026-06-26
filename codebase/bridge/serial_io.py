import os

import serial
from serial.tools.list_ports import comports


DEFAULT_SERIAL_TIMEOUT_SECONDS = float(
    os.environ.get("SERIAL_TIMEOUT_SECONDS", "0.05")
)

DEFAULT_SERIAL_WRITE_TIMEOUT_SECONDS = float(
    os.environ.get("SERIAL_WRITE_TIMEOUT_SECONDS", "0.2")
)


def available_ports():
    return [p.device for p in comports()]


def describe_ports():
    ports = list(comports())
    if not ports:
        return "  (no serial ports found)"
    return "\n".join(f"  {p.device} - {p.description}" for p in ports)


def open_port(port, baud, timeout=None):
    """
    Open the Arduino serial port with a short timeout.

    Why:
    - timeout=1 blocks the live loop for up to one second.
    - timeout=0.05 lets Python keep checking WebSocket commands and readings quickly.
    """
    ser = serial.Serial(
        port=port,
        baudrate=baud,
        timeout=DEFAULT_SERIAL_TIMEOUT_SECONDS if timeout is None else timeout,
        write_timeout=DEFAULT_SERIAL_WRITE_TIMEOUT_SECONDS,
    )

    return ser
