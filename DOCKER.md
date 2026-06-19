# Running WattWise with Docker

Setup once, run everywhere. **One published port.** A reverse proxy sits in front
of everything, so the browser only ever talks to a single URL — no `:8000`, no
per-environment config. The only thing you ever change is the Arduino bridge.

| Service     | What it is                          | Published? |
|-------------|-------------------------------------|------------|
| `proxy`     | Caddy — the single entry point      | **yes — `APP_PORT` (default 8080)** |
| `frontend`  | Vite dev server (the dashboard)     | internal   |
| `backend`   | FastAPI API + **live WS relay**     | internal   |
| `simulator` | Hardware-free reading generator     | internal   |
| `postgres`  | Database                            | internal   |

Everything is reached through the proxy on one port:

- `http://localhost:8080/`            → the dashboard
- `http://localhost:8080/api/...`     → the backend API
- `ws://localhost:8080/api/live/ws`   → the live WebSocket

Because the browser uses the **same origin** it was served from, nothing is
hardcoded. The same image works on `localhost`, a LAN IP, or a real domain.

## Run it

```bash
cp .env.example .env        # optional; defaults work
docker compose up --build
```

Open <http://localhost:8080>. The simulator feeds the dashboard immediately — no
Arduino required.

Want a different port? Set one value:

```bash
APP_PORT=9000 PUBLIC_URL=http://localhost:9000 docker compose up --build
# → http://localhost:9000
```

## Use real hardware (Arduino UNO) — the only thing that changes

The UNO has no network, so the serial bridge runs on the laptop it's plugged into.
Everything else stays exactly as-is.

```bash
docker compose stop simulator        # free the live feed
# on the laptop, in the repo:
pip install -r bridge/requirements.txt
API_BASE=http://localhost:8080/api SERIAL_PORT=COM3 python -m bridge.main
```

That's it. Same port, same URL. The bridge POSTs readings + live messages to the
proxy, the backend fans them out, and the dashboard updates for everyone.

If the stack runs on another machine, point the bridge at it — the *one* change:

```bash
API_BASE=http://<host>:8080/api SERIAL_PORT=COM3 python -m bridge.main
```

## How it connects

```
Arduino UNO ─USB serial→ bridge ─┬─ POST /api/readings/ingest ─→ backend ─→ Postgres
                                 └─ POST /api/live/publish ────→ backend
                                                                    │ LiveHub fan-out
                                            proxy :8080  ◀──────────┘
   Browser ── ws://<host>:8080/api/live/ws ──→ proxy ──→ backend  (live readings)
   Browser ── "MUTE"/"OFF" over same socket ─→ backend ─→ bridge polls /api/live/commands
```

The bridge **publishes**, the browser **subscribes**, the backend is the **broker**
in the middle — all behind one port.

## Useful commands

```bash
docker compose up --build          # build + run everything
docker compose logs -f backend     # tail a service
docker compose stop simulator      # free the live feed for the real bridge
docker compose down                # stop (keeps the postgres volume)
docker compose down -v             # stop + wipe the database
```

## Deploying behind HTTPS

Front the proxy with TLS (or let Caddy terminate it) and set
`PUBLIC_URL=https://your-host`. The frontend auto-switches to `wss://` because it
derives the scheme from the page — still zero frontend config.
