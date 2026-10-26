-- News Bay durable article store and per-feed refresh state

CREATE TABLE IF NOT EXISTS news_bay_articles (
  article_key TEXT PRIMARY KEY,
  feed_id TEXT NOT NULL,
  lane TEXT NOT NULL,
  symbol TEXT NOT NULL DEFAULT '',
  source_label TEXT NOT NULL,
  title TEXT NOT NULL,
  snippet TEXT,
  url TEXT,
  url_key TEXT,
  published_at TEXT,
  published_at_ms INTEGER,
  image_url TEXT,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  clipped_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_news_bay_articles_feed_symbol_time
  ON news_bay_articles(feed_id, symbol, published_at_ms DESC, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_bay_articles_last_seen
  ON news_bay_articles(last_seen_at);

CREATE INDEX IF NOT EXISTS idx_news_bay_articles_url
  ON news_bay_articles(url);

CREATE TABLE IF NOT EXISTS news_bay_feed_state (
  feed_key TEXT PRIMARY KEY,
  feed_id TEXT NOT NULL,
  lane TEXT NOT NULL,
  symbol TEXT NOT NULL DEFAULT '',
  refreshed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_news_bay_feed_state_feed_symbol
  ON news_bay_feed_state(feed_id, symbol, refreshed_at DESC);
