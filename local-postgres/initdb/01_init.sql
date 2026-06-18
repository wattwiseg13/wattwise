-- Runs ONCE, automatically, the first time the database volume is created.
-- Add your schema / seed SQL here. This sample just proves the DB is alive.
-- (Delete or replace this with your real WattWise schema.)

CREATE TABLE IF NOT EXISTS healthcheck (
    id          SERIAL PRIMARY KEY,
    note        TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO healthcheck (note) VALUES ('WattWise local test DB initialised');
