# Backend scripts

## `test_db_query.py` — local Postgres connectivity & query test

A self-bootstrapping script that proves the backend can reach and query the
local Dockerized PostgreSQL instance (`../../local-postgres`).

It creates its own `test_harness` schema, seeds it with the same sample data
the API currently mocks (`app/mock_data.py`), runs six representative queries
(COUNT, filtered SELECT, JOINs, GROUP BY aggregate, parameterised lookup),
asserts on the results, prints them as tables, then drops the schema again.

### 1. Start the database

```bash
cd ../../local-postgres
cp .env.example .env        # first time only
docker compose up -d
docker compose ps           # wait until healthy
```

### 2. Install a driver (once)

```bash
pip install "psycopg[binary]"     # psycopg v3 (preferred)
# or
pip install psycopg2-binary       # psycopg v2 (also supported)
```

`python-dotenv` (already in `requirements.txt`) is used to auto-load
`local-postgres/.env` if present.

### 3. Run it

```bash
python backend/scripts/test_db_query.py
```

Exit code is `0` when every check passes, non-zero otherwise — so it works in CI.

### Options

```bash
python backend/scripts/test_db_query.py --keep        # don't drop the schema
python backend/scripts/test_db_query.py --dsn postgresql://user:pw@host:5432/db
```

### Connection resolution order

1. `--dsn` flag
2. `DATABASE_URL` env var
3. assembled from `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` /
   `POSTGRES_HOST` / `POSTGRES_PORT`
4. local-postgres defaults (`wattwise` / `change_me` / `wattwise_test` @ `localhost:5432`)
