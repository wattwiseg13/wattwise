# WattWise — Local PostgreSQL (test database)

A throwaway PostgreSQL instance for local development and testing, run with Docker.
**Not for production.** Credentials live in `.env` (git-ignored).

## Prerequisites

- Docker Desktop (or Docker Engine) with the Compose plugin.

## Quick start

```bash
# from this folder (local-postgres/)
cp .env.example .env        # first time only, then edit if you like
docker compose up -d        # start Postgres in the background
docker compose ps           # check it's healthy
```

Postgres is now reachable at `localhost:5432` (or whatever `POSTGRES_PORT` you set).

Default connection string:

```
postgresql://wattwise:wattwise_test_pw@localhost:5432/wattwise_test
```

## Connect

```bash
# open a psql shell inside the container
docker compose exec postgres psql -U wattwise -d wattwise_test

# or from your host, if psql is installed
psql "postgresql://wattwise:wattwise_test_pw@localhost:5432/wattwise_test"
```

## Common commands

```bash
docker compose logs -f postgres   # follow logs
docker compose stop               # stop, keep data
docker compose down               # remove container, keep data volume
docker compose down -v            # remove container AND wipe the data (fresh DB)
```

## Schema / seed data

Any `.sql` or `.sh` files in `./initdb` run automatically **the first time** the
data volume is created. Edit `initdb/01_init.sql` (or add more files) for your
WattWise schema. To re-run them, wipe the volume first with `docker compose down -v`.

## Change the port

If `5432` is already in use (e.g. a Postgres already installed on your machine),
set `POSTGRES_PORT=5433` in `.env` and restart with `docker compose up -d`.

## Notes

- `.env` is git-ignored on purpose — only `.env.example` should be committed.
- Data persists in the named Docker volume `wattwise_pgdata` between restarts.
