"""A tiny WebSocket server the UI connects to for live readings.

The bridge's serial loop is synchronous, so the server runs its asyncio event
loop on a background thread. Call publish(dict) from the serial loop and every
connected browser receives the JSON immediately.
"""

import asyncio
import json
import queue
import threading
from typing import Any, Dict

import websockets


class LiveServer:
    def __init__(self, host="0.0.0.0", port=8765):
        self.host = host
        self.port = port
        self.clients = set()
        self.loop = None
        self._thread = None
        self._latest = None  # last message, sent to clients on connect
        self._inbox = queue.Queue()  # commands from clients, e.g. "MUTE", "OFF"

    async def _handler(self, ws, path=None):
        self.clients.add(ws)
        print(f"[ws] client connected. clients={len(self.clients)}")

        if self._latest is not None:
            try:
                await ws.send(self._latest)
            except websockets.WebSocketException:
                pass

        try:
            async for message in ws:
                self._inbox.put(message)
        except websockets.WebSocketException:
            pass
        finally:
            self.clients.discard(ws)
            print(f"[ws] client disconnected. clients={len(self.clients)}")

    def poll_commands(self):
        """Thread-safe: return any commands received from clients since last call."""
        cmds = []

        while True:
            try:
                cmds.append(self._inbox.get_nowait())
            except queue.Empty:
                break

        return cmds

    async def _serve(self, ready: threading.Event):
        async with websockets.serve(
            self._handler,
            self.host,
            self.port,
            ping_interval=20,
            ping_timeout=20,
        ):
            print(f"[ws] listening on ws://{self.host}:{self.port}")
            ready.set()
            await asyncio.Future()  # run forever

    def start(self):
        """Launch the server on a daemon thread. Returns once it is listening."""
        ready = threading.Event()
        failed: Dict[str, Any] = {}

        def run():
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)

            try:
                self.loop.run_until_complete(self._serve(ready))
            except Exception as error:
                failed["error"] = error
                ready.set()

        self._thread = threading.Thread(
            target=run,
            name="wattwise-live-websocket",
            daemon=True,
        )
        self._thread.start()

        ready.wait(timeout=5)

        if "error" in failed:
            raise RuntimeError(f"WebSocket server failed to start: {failed['error']}")

        if not ready.is_set():
            raise TimeoutError("WebSocket server did not become ready within 5 seconds")

    def publish(self, message):
        """Thread-safe: schedule a broadcast of `message` to all clients."""
        if self.loop is None or not self.loop.is_running():
            return False

        data = json.dumps(message)
        self._latest = data

        asyncio.run_coroutine_threadsafe(self._broadcast(data), self.loop)
        return True

    async def _broadcast(self, data):
        if not self.clients:
            return

        for ws in list(self.clients):
            try:
                await ws.send(data)
            except websockets.WebSocketException:
                self.clients.discard(ws)

    def client_count(self):
        return len(self.clients)
