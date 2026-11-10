CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  os TEXT NOT NULL,
  version TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS devices_last_seen ON devices (last_seen);
