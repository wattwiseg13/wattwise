from unittest import mock
from bridge import serial_io


class FakePort:
    def __init__(self, device):
        self.device = device
        self.description = device + " desc"


def test_available_ports_lists_devices():
    with mock.patch.object(
        serial_io, "comports", return_value=[FakePort("COM3"), FakePort("COM4")]
    ):
        assert serial_io.available_ports() == ["COM3", "COM4"]


def test_describe_ports_empty():
    with mock.patch.object(serial_io, "comports", return_value=[]):
        assert serial_io.describe_ports() == "  (no serial ports found)"


def test_describe_ports_lists_entries():
    with mock.patch.object(serial_io, "comports", return_value=[FakePort("COM3")]):
        out = serial_io.describe_ports()
    assert "COM3" in out
