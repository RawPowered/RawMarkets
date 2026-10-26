import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { initDatabase, closeDatabase, getDb } from "../src/server/db";
import {
  getNewsFeedRefreshedAt,
  isNewsFeedStale,
  listNewsBayArticlesFromDb,
  listSavedNewsArticles,
  markNewsFeedRefreshed,
  upsertNewsArticles,
} from "../src/server/newsArticleStore";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

let tmpDir = "";
let prevCwd = "";

before(() => {
  prevCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rawmarkets-news-store-"));
  process.chdir(tmpDir);
  initDatabase();
  const sql = fs.readFileSync(
    path.join(repoRoot, "migrations", "20260527_news_article_store.sql"),
    "utf-8"
  );
  getDb().exec(sql);
});

after(() => {
  closeDatabase();
  process.chdir(prevCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("newsArticleStore", () => {
  it("listNewsBayArticlesFromDb returns stored snippet url and image", () => {
    upsertNewsArticles(
      [
        {
          title: "Gold rally continues",
          snippet: "Spot up 1.2% on the day.",
          url: "https://example.com/gold-rally",
          published_at: "2026-05-27T12:00:00.000Z",
          feedId: "globenewswire",
          sourceLabel: "GlobeNewswire",
          symbol: "GOLD",
          imageUrl: "https://example.com/thumb.jpg",
        },
      ],
      "company"
    );
    markNewsFeedRefreshed("globenewswire", "GOLD", "company");

    const rows = listNewsBayArticlesFromDb({
      lane: "company",
      feedIds: ["globenewswire"],
      symbols: ["GOLD"],
      retentionDays: 14,
      limit: 10,
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].snippet, "Spot up 1.2% on the day.");
    assert.equal(rows[0].url, "https://example.com/gold-rally");
    assert.equal(rows[0].imageUrl, "https://example.com/thumb.jpg");
  });

  it("isNewsFeedStale is false immediately after markNewsFeedRefreshed", () => {
    markNewsFeedRefreshed("sec_8k", "AAPL", "company");
    assert.equal(isNewsFeedStale("sec_8k", "AAPL", 60 * 60 * 1000), false);
    const at = getNewsFeedRefreshedAt("sec_8k", "AAPL");
    assert.ok(at != null && at > 0);
  });

  it("fresh feed with zero articles still has refresh state for sqlite-first reads", () => {
    markNewsFeedRefreshed("sec_10q", "MSFT", "company");
    assert.equal(isNewsFeedStale("sec_10q", "MSFT", 3600000), false);
    const perFeed = listSavedNewsArticles({
      feedId: "sec_10q",
      symbol: "MSFT",
      retentionDays: 14,
      limit: 10,
    });
    assert.equal(perFeed.length, 0);
    const bulk = listNewsBayArticlesFromDb({
      lane: "company",
      feedIds: ["sec_10q"],
      symbols: ["MSFT"],
      retentionDays: 14,
      limit: 10,
    });
    assert.equal(bulk.length, 0);
  });
});
