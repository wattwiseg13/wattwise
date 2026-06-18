import serial
from serial.tools.list_ports import comports


def available_ports():
    return [p.device for p in comports()]


def describe_ports():
    ports = list(comports())
    if not ports:
        return "  (no serial ports found)"
    return "\n".join(f"  {p.device} - {p.description}" for p in ports)


def open_port(port, baud):
    return serial.Serial(port, baud, timeout=1)
