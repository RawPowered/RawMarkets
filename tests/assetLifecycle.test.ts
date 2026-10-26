import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { initDatabase, setCustomAsset, getDb, closeDatabase } from "../src/server/db";
import { deleteAsset } from "../src/server/assetLifecycle";
import { createPortfolioHolding } from "../src/server/portfolioDb";

let tmpDir = "";
let prevCwd = "";

before(() => {
  prevCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rawmarkets-lifecycle-"));
  process.chdir(tmpDir);
  initDatabase();
});

after(() => {
  closeDatabase();
  process.chdir(prevCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("assetLifecycle", () => {
  it("cascades delete for catalog symbol without portfolio", () => {
    setCustomAsset("ZZTEST", {
      name: "ZZ Test",
      symbol: "ZZTEST",
      unit: "USD",
      current: 10,
      open: 10,
      high: 10,
      low: 10,
      volume: 0,
      change: 0,
      changePercent: "+0.00%",
      history: [],
      category: "MARKETS",
      desc: "test",
    });

    const db = getDb();
    db.prepare(
      "INSERT INTO market_price_history (asset_key, symbol, price, source, checked_at) VALUES (?, ?, ?, ?, ?)"
    ).run("ZZTEST", "ZZTEST", 10, "manual", Date.now());
    db.prepare(
      "INSERT INTO api_cache (cache_key, timestamp, payload) VALUES (?, ?, ?)"
    ).run("quote_ZZTEST", Date.now(), "{}");

    const result = deleteAsset("ZZTEST");
    assert.equal(result.deleted, true);
    assert.ok((result.cascaded?.marketPriceHistory ?? 0) >= 1);
    assert.ok((result.cascaded?.apiCache ?? 0) >= 1);

    const row = db
      .prepare("SELECT symbol FROM custom_assets WHERE symbol = ?")
      .get("ZZTEST");
    assert.equal(row, undefined);
  });

  it("blocks delete when portfolio linked unless force", () => {
    setCustomAsset("PTEST", {
      name: "P Test",
      symbol: "PTEST",
      unit: "USD",
      current: 20,
      open: 20,
      high: 20,
      low: 20,
      volume: 0,
      change: 0,
      changePercent: "+0.00%",
      history: [],
      category: "MARKETS",
      desc: "test",
    });

    createPortfolioHolding({
      symbol: "PTEST",
      entry_date: "2026-01-01",
      entry_mode: "shares",
      shares: 1,
      entry_price: 20,
      barbell_side: "aggressive",
      wealth_bucket: "public_equities",
      fragility: "speculative",
    });

    const blocked = deleteAsset("PTEST");
    assert.equal(blocked.blockedByPortfolio, true);
    assert.equal(blocked.deleted, false);

    const forced = deleteAsset("PTEST", { force: true });
    assert.equal(forced.deleted, true);
    assert.ok((forced.cascaded?.portfolioHoldings ?? 0) >= 1);
  });
});
