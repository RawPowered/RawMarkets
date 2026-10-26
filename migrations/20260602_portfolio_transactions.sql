-- Portfolio statement transaction ledger (idempotent)

CREATE TABLE IF NOT EXISTS portfolio_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  tx_date TEXT NOT NULL,
  tx_type TEXT NOT NULL CHECK (tx_type IN ('buy', 'sell')),
  shares REAL NOT NULL,
  price REAL NOT NULL,
  amount_usd REAL NOT NULL,
  source TEXT NOT NULL DEFAULT 'statement_import',
  source_line INTEGER,
  external_id TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(source, source_line, symbol, tx_date, tx_type, amount_usd)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_tx_symbol_date
  ON portfolio_transactions(symbol, tx_date);
