-- News Bay: feed preferences (optional per-source toggles)

CREATE TABLE IF NOT EXISTS news_feed_prefs (
  feed_id TEXT NOT NULL PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);
