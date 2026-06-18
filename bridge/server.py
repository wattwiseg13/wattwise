"""A tiny WebSocket server the UI connects to for live readings.

The bridge's serial loop is synchronous, so the server runs its asyncio event
loop on a background thread. Call publish(dict) from the serial loop and every
connected browser receives the JSON immediately.
"""

import asyncio
import json
import queue
import threading

import websockets


class LiveServer:
    def __init__(self, host="localhost", port=8765):
        self.host = host
        self.port = port
        self.clients = set()
        self.loop = None
        self._thread = None
        self._latest = None  # last message, sent to clients on connect
        self._inbox = queue.Queue()  # commands from clients (e.g. "MUTE", "OFF")

    async def _handler(self, ws):
        self.clients.add(ws)
        if self._latest is not None:
            try:
                await ws.send(self._latest)
            except websockets.WebSocketException:
                pass
        try:
            # Receive client commands until they disconnect. The synchronous
            # serial loop drains them via poll_commands().
            async for message in ws:
                self._inbox.put(message)
        except websockets.WebSocketException:
            pass
        finally:
            self.clients.discard(ws)

    def poll_commands(self):
        """Thread-safe: return any commands received from clients since last call."""
        cmds = []
        while True:
            try:
                cmds.append(self._inbox.get_nowait())
            except queue.Empty:
                break
        return cmds

    async def _serve(self):
        async with websockets.serve(self._handler, self.host, self.port):
            await asyncio.Future()  # run forever

    def start(self):
        """Launch the server on a daemon thread. Returns once it's listening."""
        ready = threading.Event()

        def run():
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)
            self.loop.call_soon(ready.set)
            self.loop.run_until_complete(self._serve())

        self._thread = threading.Thread(target=run, daemon=True)
        self._thread.start()
        ready.wait(timeout=5)

    def publish(self, message):
        """Thread-safe: schedule a broadcast of `message` (a dict) to all clients."""
        if self.loop is None:
            return
        data = json.dumps(message)
        self._latest = data
        asyncio.run_coroutine_threadsafe(self._broadcast(data), self.loop)

    async def _broadcast(self, data):
        for ws in list(self.clients):
            try:
                await ws.send(data)
            except websockets.WebSocketException:
                self.clients.discard(ws)
