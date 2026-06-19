# WattWise

**Smart electricity monitoring and civic reporting for South African households and municipalities.**

WattWise gives ordinary residents a clear picture of how much power they're using
(and what it's costing them), and gives municipalities a live map of their meter
network so they can spot faults, tampering, and outages — then dispatch a
technician to fix them. There's even a USSD (`*130#`-style) flow so people without
smartphones can take part.

This README is a **map for judges**. It explains what's in each folder in plain
language, so you can find what you want without digging through code.

---

## 📸 See it first (no setup required)

The fastest way to understand WattWise is to look at the screenshots in
[`photos/`](photos/). Each one is a real screen from the running app:

| Screenshot                                                                | What it shows                                        |
| ------------------------------------------------------------------------- | ---------------------------------------------------- |
| [`Login_screen.png`](photos/Login_screen.png)                             | How users sign in                                    |
| [`Dashboard_customer.png`](photos/Dashboard_customer.png)                 | A household's live usage & cost dashboard            |
| [`Consumer_reports.png`](photos/Consumer_reports.png)                     | Usage reports and history for a resident             |
| [`Municipality_alerts_screen.png`](photos/Municipality_alerts_screen.png) | The municipality's view of alerts across the network |
| [`Technician_Jobs.png`](photos/Technician_Jobs.png)                       | The job list a field technician works through        |

For the story and the "why," see the pitch deck in [`slides/`](slides/)
([PDF](slides/WattWise_Pitch_Condensed.pdf) /
[PowerPoint](slides/WattWise_Pitch_Condensed.pptx)).

---

## The big picture: three folders at the root

```
wattwise/
├── photos/      → Screenshots of the working app  (start here)
├── slides/      → The pitch deck (PDF + PowerPoint)
└── codebase/    → All the actual software
```

Everything technical lives inside [`codebase/`](codebase/). The rest of this guide
walks through it.

---

## How the system fits together

WattWise has **four moving parts**. You don't need all of them to appreciate the
project — the web app alone tells most of the story.

```
   ┌─────────────┐   readings    ┌──────────────┐   API calls   ┌──────────────┐
   │  Hardware   │ ────────────► │   Bridge     │ ────────────► │   Backend    │
   │ (Arduino    │   over USB    │  (Python)    │   over HTTP   │  (FastAPI)   │
   │  meter)     │               │              │               │   + Postgres │
   └─────────────┘               └──────────────┘               └──────┬───────┘
                                                                        │ API
                                                                        ▼
                                                                ┌──────────────┐
                                                                │  Web App     │
                                                                │ (React UI)   │
                                                                │  what users  │
                                                                │  actually see│
                                                                └──────────────┘
```

1. **Hardware** — a physical Arduino "smart meter" that measures electricity and
   sends readings over a USB cable.
2. **Bridge** — a small Python program that listens to the Arduino and forwards
   the readings.
3. **Backend** — the server and database that store readings, alerts, jobs, etc.,
   and serve them through an API.
4. **Web app** — the React website that residents, municipalities, and technicians
   actually use.

For the demo, the web app can run on **mock data** alone — so it works even
without the hardware plugged in.

---

## Inside `codebase/` — folder by folder

### `codebase/src/` — the Web App (the part everyone sees)

This is the React + TypeScript website. The most useful subfolders:

| Folder                                                      | What's in it                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------- |
| [`src/routes/`](codebase/src/routes/)                       | **The actual pages.** One file = one page (see table below).        |
| [`src/components/`](codebase/src/components/)               | Reusable building blocks: charts, maps, layout, and UI widgets.     |
| [`src/components/charts/`](codebase/src/components/charts/) | The usage graphs (bar, pie, waveform).                              |
| [`src/components/maps/`](codebase/src/components/maps/)     | Google-Maps views of the meter network and technician jobs.         |
| [`src/store/`](codebase/src/store/)                         | App "memory" — who's logged in, live readings, active alerts.       |
| [`src/mock/`](codebase/src/mock/)                           | Fake-but-realistic data so the app runs without hardware.           |
| [`src/lib/`](codebase/src/lib/)                             | Small helpers (formatting numbers, locations, etc.).                |
| [`src/types/`](codebase/src/types/)                         | Shared definitions of what a "meter," "alert," or "job" looks like. |

**The pages** (in [`src/routes/`](codebase/src/routes/)):

| Page file                                                      | What the user does there                        |
| -------------------------------------------------------------- | ----------------------------------------------- |
| [`index.tsx`](codebase/src/routes/index.tsx)                   | Landing / home page                             |
| [`login.tsx`](codebase/src/routes/login.tsx)                   | Sign in                                         |
| [`dashboard.tsx`](codebase/src/routes/dashboard.tsx)           | A household's live usage & cost dashboard       |
| [`reports.tsx`](codebase/src/routes/reports.tsx)               | Detailed usage reports & history                |
| [`meter.$meterId.tsx`](codebase/src/routes/meter.$meterId.tsx) | Drill into one specific meter                   |
| [`municipality.tsx`](codebase/src/routes/municipality.tsx)     | Municipality's network-wide control view        |
| [`alerts.tsx`](codebase/src/routes/alerts.tsx)                 | List of faults / tampering / outage alerts      |
| [`technician.tsx`](codebase/src/routes/technician.tsx)         | A field technician's job queue                  |
| [`ussd.tsx`](codebase/src/routes/ussd.tsx)                     | The `*120#`-style flow for non-smartphone users |
| [`settings.tsx`](codebase/src/routes/settings.tsx)             | Account settings                                |

### 🛠️ `codebase/backend/` — the Server & Database

A Python [FastAPI](https://fastapi.tiangolo.com/) server that stores data and
serves it to the web app. The endpoints (in
[`backend/app/api/routes/`](codebase/backend/app/api/routes/)) mirror the app's
features: `consumer`, `municipality`, `dispatcher`, `jobs`, `meters`, `readings`,
`alerts`, `ussd`, and a `health` check. It seeds itself with demo data on startup,
so there's something to look at immediately.

### 🔌 `codebase/bridge/` — Hardware ↔ Software Connector

The Python program that talks to the real Arduino meter over USB, collects
readings, and saves/forwards them. Its [`README`](codebase/bridge/README.md)
explains how to flash the Arduino and run the bridge. The Arduino sketch itself
lives in [`bridge/arduino/khanya_uno/`](codebase/bridge/arduino/khanya_uno/).
(`services/serial_bridge/` is a related helper for the same job.)

### `codebase/local-postgres/` — Throwaway Test Database

A one-command Docker setup for a local PostgreSQL database used in development.
See its [`README`](codebase/local-postgres/README.md). Not for production.

### `codebase/docs/` — Design Notes

Planning and design write-ups for the hardware bridge — useful if you want to see
_how_ a feature was thought through, not just the result.

---

## Want to run it yourself?

You don't have to — the screenshots and slides tell the whole story. But if you'd
like to:

**Web app (the visual demo):**

```bash
cd codebase
npm install        # or: bun install
npm run dev        # opens at http://localhost:5173
```

**Backend (optional — needed only for live data):**

```bash
cd codebase/backend
pip install -r requirements.txt
uvicorn app.main:app --reload   # API docs at http://localhost:8000/docs
```

The web app falls back to the mock data in [`src/mock/`](codebase/src/mock/), so
it looks complete even if the backend isn't running.

---

## TL;DR for judges

- **Just want to see it?** → [`photos/`](photos/) and [`slides/`](slides/).
- **Want the user experience?** → [`codebase/src/routes/`](codebase/src/routes/).
- **Want the server logic?** → [`codebase/backend/`](codebase/backend/).
- **Want the hardware story?** → [`codebase/bridge/`](codebase/bridge/).

Built for the G13 Hackathon. ⚡
</content>
</invoke>
