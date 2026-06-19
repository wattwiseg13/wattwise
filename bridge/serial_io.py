import serial
from serial.tools.list_ports import comports


# USB vendor IDs for boards we recognise as "an Arduino" without the user
# telling us which COM number it landed on. Covers genuine boards and the
# common UNO clones (CH340, FTDI, Silicon Labs) found on cheap kits.
ARDUINO_VIDS = {
    0x2341,  # Arduino LLC (genuine UNO, Mega, etc.)
    0x2A03,  # Arduino SRL
    0x1A86,  # WCH CH340 / CH341 (most clones)
    0x0403,  # FTDI
    0x10C4,  # Silicon Labs CP210x
    0x1B4F,  # SparkFun
}

# Substrings we treat as a likely board when the VID is unknown.
ARDUINO_HINTS = ("arduino", "ch340", "ch341", "usb-serial", "usb serial", "cp210", "ftdi", "wch")


def available_ports():
    return [p.device for p in comports()]


def describe_ports():
    ports = list(comports())
    if not ports:
        return "  (no serial ports found)"
    return "\n".join(f"  {p.device} - {p.description}" for p in ports)


def find_arduino_port():
    """Best guess at which COM port the Arduino is on.

    Returns the device name (e.g. "COM5") or None if nothing looks like a
    board. Prefers a VID match, then a description hint. If exactly one serial
    port exists, we assume that's it.
    """
    ports = list(comports())
    if not ports:
        return None

    # 1. Known USB vendor ID — the most reliable signal.
    for p in ports:
        if p.vid in ARDUINO_VIDS:
            return p.device

    # 2. Description / manufacturer hint (handles odd clones).
    for p in ports:
        text = f"{p.description} {p.manufacturer or ''}".lower()
        if any(hint in text for hint in ARDUINO_HINTS):
            return p.device

    # 3. Only one port plugged in — almost certainly the board.
    if len(ports) == 1:
        return ports[0].device

    return None


def open_port(port, baud):
    return serial.Serial(port, baud, timeout=1)
