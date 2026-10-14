CREATE TABLE IF NOT EXISTS episode_follow_sets (
  device_id TEXT PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS episode_follows (
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  tmdb_id INTEGER NOT NULL CHECK (tmdb_id > 0),
  profile_scope TEXT NOT NULL,
  title TEXT NOT NULL,
  last_season INTEGER NOT NULL DEFAULT 0,
  last_episode INTEGER NOT NULL DEFAULT 0,
  next_check_at TEXT,
  checked_at TEXT,
  PRIMARY KEY (device_id, tmdb_id)
);
CREATE INDEX IF NOT EXISTS episode_follows_check_idx ON episode_follows(next_check_at, checked_at);
