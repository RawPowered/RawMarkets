import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { initDatabase, closeDatabase, getDb } from "../src/server/db";
import { fileURLToPath } from "url";
import { upsertNewsArticles, listRecentNewsBySymbols } from "../src/server/newsArticleStore";
import {
  resolveFocusSymbols,
  buildLocalAiDataContext,
} from "../src/server/localAiContext";
import type { PlatformLocation } from "../src/types";

let tmpDir = "";
let prevCwd = "";
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

before(() => {
  prevCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rawmarkets-localai-"));
  process.chdir(tmpDir);
  initDatabase();
  const newsSql = fs.readFileSync(
    path.join(repoRoot, "migrations", "20260527_news_article_store.sql"),
    "utf-8"
  );
  const db = getDb();
  db.exec(newsSql);
  const researchSql = fs.readFileSync(
    path.join(repoRoot, "migrations", "20260523_portfolio_research.sql"),
    "utf-8"
  );
  db.exec(researchSql);
});

after(() => {
  closeDatabase();
  process.chdir(prevCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("resolveFocusSymbols", () => {
  it("prioritizes newsBaySymbol on news-bay page", () => {
    const loc: PlatformLocation = {
      page: "news-bay",
      pageLabel: "News Bay",
      selectedSymbol: "GOLD",
      newsBaySymbol: "AAPL",
      capturedAt: new Date().toISOString(),
    };
    const syms = resolveFocusSymbols(loc);
    assert.equal(syms[0], "AAPL");
    assert.ok(syms.includes("GOLD"));
  });

  it("includes selected and pinned on terminal", () => {
    const loc: PlatformLocation = {
      page: "terminal",
      pageLabel: "Terminal",
      selectedSymbol: "SILVER",
      pinnedSymbols: ["GOLD"],
      capturedAt: new Date().toISOString(),
    };
    const syms = resolveFocusSymbols(loc);
    assert.deepEqual(syms.slice(0, 2), ["SILVER", "GOLD"]);
  });
});

describe("listRecentNewsBySymbols", () => {
  it("returns articles for matching symbols", () => {
    upsertNewsArticles(
      [
        {
          title: "Gold rallies on safe haven demand",
          snippet: "Spot gold climbed amid macro uncertainty.",
          url: "https://example.com/gold-1",
          published_at: new Date().toISOString(),
          feedId: "yahoo_rss",
          sourceLabel: "Yahoo",
          symbol: "GOLD",
          imageUrl: null,
        },
      ],
      "company"
    );
    const rows = listRecentNewsBySymbols({
      symbols: ["GOLD", "SILVER"],
      retentionDays: 14,
      globalLimit: 10,
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].symbol, "GOLD");
    assert.ok(rows[0].title.includes("Gold rallies"));
  });
});

describe("buildLocalAiDataContext", () => {
  it("includes RSS articles in platform data", async () => {
    upsertNewsArticles(
      [
        {
          title: "Silver supply tightens",
          snippet: "Industrial demand rises.",
          url: "https://example.com/silver-1",
          published_at: new Date().toISOString(),
          feedId: "yahoo_rss",
          sourceLabel: "Yahoo",
          symbol: "SILVER",
          imageUrl: null,
        },
      ],
      "company"
    );
    const ctx = await buildLocalAiDataContext({
      page: "terminal",
      pageLabel: "Terminal",
      selectedSymbol: "SILVER",
      capturedAt: new Date().toISOString(),
    });
    assert.ok(ctx.focusSymbols.includes("SILVER"));
    assert.ok(ctx.articleCount >= 1);
    assert.ok(ctx.articles.some((a) => a.title.includes("Silver supply")));
  });

  it("returns empty articles when no symbols", async () => {
    const ctx = await buildLocalAiDataContext({
      page: "config",
      pageLabel: "Settings",
      capturedAt: new Date().toISOString(),
    });
    assert.equal(ctx.articles.length, 0);
    assert.equal(ctx.articleCount, 0);
  });
});
