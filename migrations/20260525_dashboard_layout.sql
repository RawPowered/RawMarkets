CREATE TABLE IF NOT EXISTS dashboard_layout (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  layout_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
