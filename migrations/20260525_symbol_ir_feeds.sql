CREATE TABLE IF NOT EXISTS symbol_ir_feeds (
  symbol TEXT NOT NULL PRIMARY KEY,
  ir_page_url TEXT,
  rss_url TEXT,
  discovery_status TEXT NOT NULL DEFAULT 'pending',
  last_checked_at INTEGER,
  error_message TEXT
);
