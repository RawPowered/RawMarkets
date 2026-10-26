import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { applyPortfolioResearchMigration } from "../src/server/db";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationSql = fs.readFileSync(
  path.join(root, "migrations", "20260523_portfolio_research.sql"),
  "utf-8"
);

function seedMinimalDb(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS portfolio_holdings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      entry_date TEXT NOT NULL,
      entry_mode TEXT NOT NULL,
      shares REAL NOT NULL,
      entry_price REAL NOT NULL,
      dollars_invested REAL,
      barbell_side TEXT NOT NULL DEFAULT 'aggressive',
      wealth_bucket TEXT NOT NULL DEFAULT 'public_equities',
      fragility TEXT NOT NULL DEFAULT 'speculative',
      target_pct REAL,
      take_profit_pct REAL,
      stop_loss_pct REAL,
      kelly_p REAL,
      kelly_b REAL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS portfolio_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      safe_target_pct REAL NOT NULL DEFAULT 80,
      aggressive_target_pct REAL NOT NULL DEFAULT 20,
      rebalance_drift_pct REAL NOT NULL DEFAULT 5,
      last_rebalance_date TEXT,
      cash_buffer_usd REAL NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS engine_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS api_cache (
      cache_key TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS custom_assets (
      symbol TEXT PRIMARY KEY,
      payload TEXT NOT NULL
    );
    INSERT INTO portfolio_settings (id, safe_target_pct, aggressive_target_pct, rebalance_drift_pct, cash_buffer_usd, updated_at)
    VALUES (1, 80, 20, 5, 0, 0);
  `);
}

describe("migrations", () => {
  it("applies portfolio research migration idempotently", () => {
    const db = new Database(":memory:");
    seedMinimalDb(db);

    db.exec(migrationSql);
    db.exec(migrationSql);

    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'portfolio_%'"
      )
      .all() as { name: string }[];

    const names = new Set(tables.map((t) => t.name));
    assert.ok(names.has("portfolio_factor_snapshots"));
    assert.ok(names.has("portfolio_forecasts"));
    assert.ok(names.has("portfolio_actions"));
    assert.ok(names.has("portfolio_news_history"));

    applyPortfolioResearchMigration(db);
    const cols = db
      .prepare("PRAGMA table_info(portfolio_settings)")
      .all() as { name: string }[];
    assert.ok(cols.some((c) => c.name === "research_enabled"));

    db.close();
  });

  it("applies 20260524 catalog baseline marker idempotently", () => {
    const db = new Database(":memory:");
    seedMinimalDb(db);
    db.exec(migrationSql);

    const baselineSql = fs.readFileSync(
      path.join(root, "migrations", "20260524_catalog_baseline.sql"),
      "utf-8"
    );
    const purgeSql = fs.readFileSync(
      path.join(root, "migrations", "20260524_purge_simulation_cache.sql"),
      "utf-8"
    );

    db.exec(baselineSql);
    db.exec(baselineSql);
    db.exec(purgeSql);
    db.exec(purgeSql);

    const marker = db
      .prepare("SELECT value FROM engine_meta WHERE key = 'catalog_baseline_version'")
      .get() as { value: string } | undefined;
    assert.ok(marker?.value === "0" || marker?.value === "1");

    db.close();
  });

  it("applies news article store migration idempotently", () => {
    const db = new Database(":memory:");
    seedMinimalDb(db);

    const sql = fs.readFileSync(
      path.join(root, "migrations", "20260527_news_article_store.sql"),
      "utf-8"
    );

    db.exec(sql);
    db.exec(sql);

    const articleCols = db
      .prepare("PRAGMA table_info(news_bay_articles)")
      .all() as { name: string }[];
    assert.ok(articleCols.some((c) => c.name === "article_key"));
    assert.ok(articleCols.some((c) => c.name === "clipped_at"));

    const stateCols = db
      .prepare("PRAGMA table_info(news_bay_feed_state)")
      .all() as { name: string }[];
    assert.ok(stateCols.some((c) => c.name === "feed_key"));
    assert.ok(stateCols.some((c) => c.name === "refreshed_at"));

    db.close();
  });
});
