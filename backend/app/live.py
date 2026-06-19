"""In-process live broadcast hub for the hosted backend.

The serial bridge used to run its own WebSocket server, which only worked on the
machine the bridge ran on. Now the bridge POSTs each live message to the backend
and the backend fans it out to every connected browser. That means any browser,
anywhere, connects to the hosted backend instead of the laptop running the bridge.

Two directions of traffic:
  - downstream: bridge/simulator -> publish() -> all connected browsers
  - upstream:   browser commands ("MUTE"/"OFF") -> queue -> drain_commands()

The bridge polls drain_commands() (via GET /api/live/commands) to pick up
dashboard commands, mirroring the old LiveServer.poll_commands() behaviour.
"""

import asyncio
import json
from collections import deque
from typing import Any, Deque, Dict, List, Set

from fastapi import WebSocket


class LiveHub:
    def __init__(self) -> None:
        self._clients: Set[WebSocket] = set()
        self._latest: str | None = None  # last message, sent to clients on connect
        self._commands: Deque[str] = deque(maxlen=100)  # browser -> bridge
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._clients.add(ws)
        if self._latest is not None:
            try:
                await ws.send_text(self._latest)
            except Exception:
                pass

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._clients.discard(ws)

    def queue_command(self, command: str) -> None:
        command = command.strip()
        if command:
            self._commands.append(command)

    def drain_commands(self) -> List[str]:
        """Return and clear all commands queued by browsers since the last call."""
        commands: List[str] = []
        while self._commands:
            commands.append(self._commands.popleft())
        return commands

    async def publish(self, message: Dict[str, Any]) -> None:
        """Broadcast a live message (a dict) to every connected browser."""
        data = json.dumps(message)
        self._latest = data
        async with self._lock:
            targets = list(self._clients)
        dead: List[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self._clients.discard(ws)


# Single shared hub for the process.
hub = LiveHub()
