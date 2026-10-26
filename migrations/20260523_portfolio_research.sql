-- Portfolio research engine tables (idempotent)

CREATE TABLE IF NOT EXISTS portfolio_news_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  snippet TEXT,
  url TEXT,
  published_at TEXT,
  raw_text TEXT NOT NULL,
  extracted_json TEXT,
  sentiment REAL,
  novelty REAL,
  time_horizon TEXT,
  macro_tags TEXT,
  event_type TEXT,
  confidence REAL,
  fetched_at INTEGER NOT NULL,
  UNIQUE(symbol, url, published_at)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_news_symbol_time
  ON portfolio_news_history(symbol, fetched_at DESC);

CREATE TABLE IF NOT EXISTS portfolio_factor_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  holding_id INTEGER NOT NULL,
  symbol TEXT NOT NULL,
  evaluated_at INTEGER NOT NULL,
  return_5d REAL,
  return_20d REAL,
  vol_20d REAL,
  drawdown_30d REAL,
  drawdown_60d REAL,
  trend_score REAL,
  mean_reversion_score REAL,
  concentration_pct REAL,
  corr_to_portfolio REAL,
  corr_to_benchmark REAL,
  data_points INTEGER NOT NULL,
  engine TEXT NOT NULL DEFAULT 'python',
  FOREIGN KEY (holding_id) REFERENCES portfolio_holdings(id) ON DELETE CASCADE,
  UNIQUE(holding_id, evaluated_at)
);

CREATE TABLE IF NOT EXISTS portfolio_forecasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  holding_id INTEGER NOT NULL,
  symbol TEXT NOT NULL,
  evaluated_at INTEGER NOT NULL,
  prob_up_5d REAL NOT NULL,
  prob_up_20d REAL NOT NULL,
  expected_return_low_5d REAL,
  expected_return_high_5d REAL,
  downside_risk_low_5d REAL,
  downside_risk_high_5d REAL,
  regime TEXT NOT NULL,
  inputs_json TEXT NOT NULL,
  engine TEXT NOT NULL,
  FOREIGN KEY (holding_id) REFERENCES portfolio_holdings(id) ON DELETE CASCADE,
  UNIQUE(holding_id, evaluated_at)
);

CREATE TABLE IF NOT EXISTS portfolio_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  holding_id INTEGER,
  symbol TEXT,
  evaluated_at INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('add','hold','trim','reduce','no_add')),
  severity TEXT NOT NULL CHECK (severity IN ('info','warn','critical')),
  reason_code TEXT NOT NULL,
  reason TEXT NOT NULL,
  precedence INTEGER NOT NULL DEFAULT 0,
  engine TEXT NOT NULL,
  FOREIGN KEY (holding_id) REFERENCES portfolio_holdings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_portfolio_actions_eval
  ON portfolio_actions(evaluated_at DESC, holding_id);
