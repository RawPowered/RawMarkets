CREATE TABLE IF NOT EXISTS symbol_sec_meta (
  symbol TEXT NOT NULL PRIMARY KEY,
  cik TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);
