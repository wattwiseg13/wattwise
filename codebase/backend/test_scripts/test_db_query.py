#!/usr/bin/env python3
"""
test_db_query.py — WattWise local PostgreSQL connectivity & query test.

Simulates the kind of SQL queries the backend will run against the local
Docker Postgres instance (see ../../local-postgres/docker-compose.yml).

It is SELF-BOOTSTRAPPING: it creates its own tables in a dedicated
`test_harness` schema, seeds them with the same sample data the backend
currently mocks (app/mock_data.py), runs a few representative queries with
assertions, prints the results, then cleans up after itself.

Run it to confirm:
  1. The Docker Postgres container is up and reachable.
  2. Credentials / DATABASE_URL are correct.
  3. SQL queries (DDL, INSERT, SELECT, JOIN, aggregate) work end-to-end.

Usage:
    # 1. Start the database
    cd local-postgres && cp .env.example .env && docker compose up -d

    # 2. Install the driver (once)
    pip install "psycopg[binary]"        # psycopg v3  (preferred)
    #   or:  pip install psycopg2-binary  # psycopg v2  (also supported)

    # 3. Run the test
    python backend/scripts/test_db_query.py

    # Optional flags:
    python backend/scripts/test_db_query.py --keep   # don't drop the test schema
    python backend/scripts/test_db_query.py --dsn postgresql://user:pw@host:5432/db

Environment:
    DATABASE_URL is read if present, else assembled from POSTGRES_* vars,
    else falls back to the local-postgres defaults. A .env file in
    local-postgres/ (or backend/) is loaded automatically if python-dotenv
    is installed.

Exit code is 0 on success, non-zero on any failure (CI-friendly).
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# --------------------------------------------------------------------------- #
# Driver import — support both psycopg v3 and psycopg2 transparently.
# --------------------------------------------------------------------------- #
_DRIVER = None
try:
    import psycopg  # psycopg v3

    _DRIVER = "psycopg3"
except ImportError:
    try:
        import psycopg2 as psycopg  # type: ignore  # psycopg v2

        _DRIVER = "psycopg2"
    except ImportError:
        sys.stderr.write(
            "ERROR: No PostgreSQL driver found.\n"
            '       Install one with:  pip install "psycopg[binary]"\n'
            "                       or:  pip install psycopg2-binary\n"
        )
        sys.exit(2)


# --------------------------------------------------------------------------- #
# Config / connection string resolution.
# --------------------------------------------------------------------------- #
def _load_dotenv_files() -> None:
    """Best-effort load of .env files so DATABASE_URL / POSTGRES_* are picked up."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    here = Path(__file__).resolve()
    repo_root = here.parents[2]  # .../wattwise
    for candidate in (
        repo_root / "local-postgres" / ".env",
        repo_root / "backend" / ".env",
        repo_root / ".env",
    ):
        try:
            if candidate.is_file():
                load_dotenv(candidate, override=False)
        except OSError:
            # A .env that stats as present but can't be read should never
            # crash the test — just skip it and fall back to env/defaults.
            continue


def resolve_dsn(cli_dsn: str | None) -> str:
    if cli_dsn:
        return cli_dsn
    if os.getenv("DATABASE_URL"):
        return os.environ["DATABASE_URL"]

    user = os.getenv("POSTGRES_USER", "wattwise")
    password = os.getenv("POSTGRES_PASSWORD", "change_me")
    db = os.getenv("POSTGRES_DB", "wattwise_test")
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    return f"postgresql://{user}:{password}@{host}:{port}/{db}"


def _redact(dsn: str) -> str:
    """Hide the password when printing the DSN."""
    if "@" not in dsn or "://" not in dsn:
        return dsn
    scheme, rest = dsn.split("://", 1)
    creds, tail = rest.split("@", 1)
    if ":" in creds:
        user = creds.split(":", 1)[0]
        creds = f"{user}:****"
    return f"{scheme}://{creds}@{tail}"


# --------------------------------------------------------------------------- #
# Sample data — mirrors backend/app/mock_data.py so the test reflects reality.
# --------------------------------------------------------------------------- #
SCHEMA = "test_harness"

METERS = [
    # (meter_id, area, consumer_name, status, current_draw, baseline_watts)
    ("NXM-001-TZN", "Tzaneen North", "Casious Mookamedi", "WARNING", 850, 650),
    ("NXM-002-TZN", "Tzaneen North", "Lerato Maseko", "NORMAL", 420, 500),
    ("NXM-003-TZN", "Tzaneen CBD", "Thabo Khumalo", "CRITICAL", 1950, 700),
]

READINGS = [
    # (meter_id, watts, voltage, current_amps, kwh_today, estimated_cost_today)
    ("NXM-001-TZN", 850, 230, 3.7, 4.8, 18.75),
    ("NXM-002-TZN", 420, 230, 1.8, 2.2, 8.58),
    ("NXM-003-TZN", 1950, 230, 8.5, 9.6, 37.44),
]

ALERTS = [
    # (alert_id, meter_id, severity, status)
    ("ALT-001", "NXM-003-TZN", "CRITICAL", "OPEN"),
    ("ALT-002", "NXM-001-TZN", "WARNING", "IN_PROGRESS"),
]


# --------------------------------------------------------------------------- #
# Test harness.
# --------------------------------------------------------------------------- #
class Check:
    """Tiny assertion/reporting helper so output reads like a test run."""

    def __init__(self) -> None:
        self.passed = 0
        self.failed = 0

    def ok(self, label: str, condition: bool, detail: str = "") -> None:
        mark = "PASS" if condition else "FAIL"
        if condition:
            self.passed += 1
        else:
            self.failed += 1
        suffix = f"  ({detail})" if detail else ""
        print(f"  [{mark}] {label}{suffix}")

    def summary(self) -> int:
        print("-" * 60)
        total = self.passed + self.failed
        print(f"  {self.passed}/{total} checks passed.")
        return 0 if self.failed == 0 else 1


def setup_schema(cur) -> None:
    cur.execute(f"DROP SCHEMA IF EXISTS {SCHEMA} CASCADE;")
    cur.execute(f"CREATE SCHEMA {SCHEMA};")
    cur.execute(
        f"""
        CREATE TABLE {SCHEMA}.meters (
            meter_id        TEXT PRIMARY KEY,
            area            TEXT NOT NULL,
            consumer_name   TEXT NOT NULL,
            status          TEXT NOT NULL,
            current_draw    INTEGER NOT NULL,
            baseline_watts  INTEGER NOT NULL
        );
        """
    )
    cur.execute(
        f"""
        CREATE TABLE {SCHEMA}.readings (
            id                    SERIAL PRIMARY KEY,
            meter_id              TEXT NOT NULL REFERENCES {SCHEMA}.meters(meter_id),
            watts                 INTEGER NOT NULL,
            voltage               INTEGER NOT NULL,
            current_amps          NUMERIC(6,2) NOT NULL,
            kwh_today             NUMERIC(8,2) NOT NULL,
            estimated_cost_today  NUMERIC(8,2) NOT NULL,
            recorded_at           TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """
    )
    cur.execute(
        f"""
        CREATE TABLE {SCHEMA}.alerts (
            alert_id   TEXT PRIMARY KEY,
            meter_id   TEXT NOT NULL REFERENCES {SCHEMA}.meters(meter_id),
            severity   TEXT NOT NULL,
            status     TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """
    )


def seed_data(cur) -> None:
    cur.executemany(
        f"INSERT INTO {SCHEMA}.meters "
        f"(meter_id, area, consumer_name, status, current_draw, baseline_watts) "
        f"VALUES (%s, %s, %s, %s, %s, %s);",
        METERS,
    )
    cur.executemany(
        f"INSERT INTO {SCHEMA}.readings "
        f"(meter_id, watts, voltage, current_amps, kwh_today, estimated_cost_today) "
        f"VALUES (%s, %s, %s, %s, %s, %s);",
        READINGS,
    )
    cur.executemany(
        f"INSERT INTO {SCHEMA}.alerts (alert_id, meter_id, severity, status) "
        f"VALUES (%s, %s, %s, %s);",
        ALERTS,
    )


def run_queries(cur, check: Check) -> None:
    # --- Query 1: simple SELECT + COUNT -----------------------------------
    print("\nQuery 1 — count meters:")
    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.meters;")
    meter_count = cur.fetchone()[0]
    print(f"  SELECT COUNT(*) FROM meters  ->  {meter_count}")
    check.ok("meters seeded", meter_count == len(METERS), f"{meter_count} rows")

    # --- Query 2: filtered SELECT with ORDER BY ---------------------------
    print("\nQuery 2 — meters above baseline (potential anomalies):")
    cur.execute(
        f"""
        SELECT meter_id, consumer_name, status, current_draw, baseline_watts,
               ROUND(100.0 * (current_draw - baseline_watts) / baseline_watts, 1)
                   AS deviation_pct
        FROM {SCHEMA}.meters
        WHERE current_draw > baseline_watts
        ORDER BY deviation_pct DESC;
        """
    )
    rows = cur.fetchall()
    _print_table(
        ["meter_id", "consumer", "status", "draw", "baseline", "dev_%"], rows
    )
    check.ok("anomalous meters returned", len(rows) == 2, f"{len(rows)} rows")
    check.ok(
        "worst offender is the CRITICAL meter",
        rows and rows[0][0] == "NXM-003-TZN",
        rows[0][0] if rows else "no rows",
    )

    # --- Query 3: JOIN across readings + meters ---------------------------
    print("\nQuery 3 — latest reading per meter joined to consumer:")
    cur.execute(
        f"""
        SELECT m.meter_id, m.consumer_name, r.watts, r.kwh_today,
               r.estimated_cost_today
        FROM {SCHEMA}.meters m
        JOIN {SCHEMA}.readings r ON r.meter_id = m.meter_id
        ORDER BY r.estimated_cost_today DESC;
        """
    )
    rows = cur.fetchall()
    _print_table(
        ["meter_id", "consumer", "watts", "kwh_today", "cost_R"], rows
    )
    check.ok("join returned a row per meter", len(rows) == len(METERS))

    # --- Query 4: aggregate / GROUP BY ------------------------------------
    print("\nQuery 4 — total energy & cost by area:")
    cur.execute(
        f"""
        SELECT m.area,
               COUNT(*)                          AS meter_count,
               SUM(r.kwh_today)                  AS total_kwh,
               ROUND(SUM(r.estimated_cost_today), 2) AS total_cost
        FROM {SCHEMA}.meters m
        JOIN {SCHEMA}.readings r ON r.meter_id = m.meter_id
        GROUP BY m.area
        ORDER BY total_cost DESC;
        """
    )
    rows = cur.fetchall()
    _print_table(["area", "meters", "total_kwh", "total_cost_R"], rows)
    check.ok("group-by returned one row per area", len(rows) == 2)

    # --- Query 5: JOIN to alerts (open critical alerts) -------------------
    print("\nQuery 5 — open critical alerts with consumer details:")
    cur.execute(
        f"""
        SELECT a.alert_id, a.severity, a.status, m.meter_id, m.consumer_name
        FROM {SCHEMA}.alerts a
        JOIN {SCHEMA}.meters m ON m.meter_id = a.meter_id
        WHERE a.severity = 'CRITICAL' AND a.status = 'OPEN';
        """
    )
    rows = cur.fetchall()
    _print_table(["alert_id", "severity", "status", "meter_id", "consumer"], rows)
    check.ok("one open critical alert found", len(rows) == 1)

    # --- Query 6: parameterised query (safe against injection) ------------
    print("\nQuery 6 — parameterised lookup by meter_id:")
    target = "NXM-002-TZN"
    cur.execute(
        f"SELECT consumer_name, status FROM {SCHEMA}.meters WHERE meter_id = %s;",
        (target,),
    )
    row = cur.fetchone()
    print(f"  meter {target}  ->  {row}")
    check.ok("parameterised lookup works", row is not None and row[1] == "NORMAL")


def _print_table(headers, rows) -> None:
    cols = [str(h) for h in headers]
    data = [[("" if v is None else str(v)) for v in r] for r in rows]
    widths = [len(c) for c in cols]
    for r in data:
        for i, v in enumerate(r):
            widths[i] = max(widths[i], len(v))
    fmt = "  | " + " | ".join("{:<" + str(w) + "}" for w in widths) + " |"
    bar = "  +-" + "-+-".join("-" * w for w in widths) + "-+"
    print(bar)
    print(fmt.format(*cols))
    print(bar)
    for r in data:
        print(fmt.format(*r))
    print(bar)


def connect(dsn: str):
    if _DRIVER == "psycopg3":
        return psycopg.connect(dsn, connect_timeout=10)
    return psycopg.connect(dsn, connect_timeout=10)  # psycopg2 same signature


def main() -> int:
    parser = argparse.ArgumentParser(description="WattWise local Postgres query test.")
    parser.add_argument("--dsn", help="Override the database connection string.")
    parser.add_argument(
        "--keep",
        action="store_true",
        help="Keep the test_harness schema instead of dropping it at the end.",
    )
    args = parser.parse_args()

    _load_dotenv_files()
    dsn = resolve_dsn(args.dsn)

    print("=" * 60)
    print("WattWise — local PostgreSQL query test")
    print("=" * 60)
    print(f"Driver : {_DRIVER}")
    print(f"Target : {_redact(dsn)}")

    try:
        conn = connect(dsn)
    except Exception as exc:  # noqa: BLE001
        sys.stderr.write(
            "\nCould not connect to PostgreSQL.\n"
            f"  {type(exc).__name__}: {exc}\n\n"
            "Is the Docker container running?\n"
            "  cd local-postgres && docker compose up -d && docker compose ps\n"
        )
        return 1

    check = Check()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("SELECT version();")
                print(f"Server : {cur.fetchone()[0].split(',')[0]}\n")

                print("Setting up test schema and seed data...")
                setup_schema(cur)
                seed_data(cur)
                print(f"Created schema '{SCHEMA}' with meters/readings/alerts tables.")

                run_queries(cur, check)

                if not args.keep:
                    cur.execute(f"DROP SCHEMA IF EXISTS {SCHEMA} CASCADE;")
                    print(f"\nCleaned up schema '{SCHEMA}'.")
                else:
                    print(f"\nLeft schema '{SCHEMA}' in place (--keep).")
        print()
        return check.summary()
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
