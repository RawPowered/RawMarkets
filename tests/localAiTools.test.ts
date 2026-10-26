import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import {
  initDatabase,
  closeDatabase,
  getDb,
  getEngineSettings,
  saveEngineSettings,
} from "../src/server/db";
import {
  executeLocalAiTool,
  freshToolBudget,
  isUrlAllowed,
} from "../src/server/localAiTools";
import {
  upsertNewsArticles,
  markNewsFeedRefreshed,
  listNewsArticlesByTextSearch,
} from "../src/server/newsArticleStore";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

let tmpDir = "";
let prevCwd = "";

before(() => {
  prevCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rawmarkets-localai-tools-"));
  process.chdir(tmpDir);
  initDatabase();
  getDb().exec(
    fs.readFileSync(
      path.join(repoRoot, "migrations", "20260527_news_article_store.sql"),
      "utf-8"
    )
  );
});

after(() => {
  closeDatabase();
  process.chdir(prevCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("localAiTools", () => {
  it("isUrlAllowed blocks localhost and non-https", () => {
    assert.equal(isUrlAllowed("http://example.com"), false);
    assert.equal(isUrlAllowed("https://example.com/article"), true);
    assert.equal(isUrlAllowed("https://localhost/x"), false);
    assert.equal(isUrlAllowed("file:///etc/passwd"), false);
  });

  it("search_platform_news returns stored articles", async () => {
    upsertNewsArticles(
      [
        {
          title: "Gold miners rally",
          snippet: "Spot gold firm.",
          url: "https://example.com/gold",
          published_at: "2026-05-27T12:00:00.000Z",
          feedId: "globenewswire",
          sourceLabel: "GlobeNewswire",
          symbol: "GOLD",
          imageUrl: null,
        },
      ],
      "company"
    );
    markNewsFeedRefreshed("globenewswire", "GOLD", "company");

    const budget = freshToolBudget();
    const result = await executeLocalAiTool(
      "search_platform_news",
      JSON.stringify({ symbols: ["GOLD"], limit: 5 }),
      {
        page: "terminal",
        pageLabel: "Terminal",
        selectedSymbol: "GOLD",
        capturedAt: new Date().toISOString(),
      },
      budget
    );
    const parsed = JSON.parse(result.content) as {
      ok: boolean;
      articles: { title: string }[];
    };
    assert.equal(parsed.ok, true);
    assert.equal(parsed.articles.length, 1);
    assert.equal(parsed.articles[0].title, "Gold miners rally");
  });

  it("enforces per-turn fetch_page_text limit", async () => {
    const budget = freshToolBudget();
    budget.fetchPage = 3;
    const blocked = await executeLocalAiTool(
      "fetch_page_text",
      JSON.stringify({ url: "https://example.com/4" }),
      {
        page: "terminal",
        pageLabel: "Terminal",
        capturedAt: new Date().toISOString(),
      },
      budget
    );
    const parsed = JSON.parse(blocked.content) as { ok: boolean; message: string };
    assert.equal(parsed.ok, false);
    assert.ok(parsed.message.includes("limit"));
  });

  it("listNewsArticlesByTextSearch finds by title keyword", () => {
    upsertNewsArticles(
      [
        {
          title: "Hasbro earnings beat",
          snippet: "Toy maker reports.",
          url: "https://example.com/has",
          published_at: "2026-05-27T12:00:00.000Z",
          feedId: "globenewswire",
          sourceLabel: "GlobeNewswire",
          symbol: "HAS",
          imageUrl: null,
        },
      ],
      "company"
    );
    markNewsFeedRefreshed("globenewswire", "HAS", "company");
    const hits = listNewsArticlesByTextSearch({
      query: "hasbro",
      retentionDays: 30,
      limit: 10,
    });
    assert.equal(hits.length, 1);
    assert.ok(hits[0].title.toLowerCase().includes("hasbro"));
  });

  it("search_platform_news matches text query without focus symbol", async () => {
    const budget = freshToolBudget();
    const result = await executeLocalAiTool(
      "search_platform_news",
      JSON.stringify({ query: "hasbro", limit: 5 }),
      {
        page: "config",
        pageLabel: "Engine",
        selectedSymbol: "GOLD",
        capturedAt: new Date().toISOString(),
      },
      budget,
      { lastUserMessage: "check Hasbro news" }
    );
    const parsed = JSON.parse(result.content) as {
      ok: boolean;
      count: number;
    };
    assert.equal(parsed.ok, true);
    assert.equal(parsed.count, 1);
  });

  it("search_web_news rejects when Serp disabled for copilot", async () => {
    const prev = getEngineSettings();
    saveEngineSettings({ ...prev, aiLocalSerpEnabled: false });
    const budget = freshToolBudget();
    const result = await executeLocalAiTool(
      "search_web_news",
      JSON.stringify({ query: "hasbro" }),
      {
        page: "terminal",
        pageLabel: "Terminal",
        capturedAt: new Date().toISOString(),
      },
      budget
    );
    const parsed = JSON.parse(result.content) as { ok: boolean; message: string };
    assert.equal(parsed.ok, false);
    assert.ok(parsed.message.includes("disabled"));
    saveEngineSettings(prev);
  });

  it("fetch_page_text rejects when Playwright scrapers disabled", async () => {
    const prev = getEngineSettings();
    saveEngineSettings({ ...prev, usePlaywrightScrapers: false });
    const budget = freshToolBudget();
    const result = await executeLocalAiTool(
      "fetch_page_text",
      JSON.stringify({ url: "https://example.com/a" }),
      {
        page: "terminal",
        pageLabel: "Terminal",
        capturedAt: new Date().toISOString(),
      },
      budget
    );
    const parsed = JSON.parse(result.content) as { ok: boolean; message: string };
    assert.equal(parsed.ok, false);
    assert.ok(parsed.message.includes("Playwright"));
    saveEngineSettings(prev);
  });

  it("web_research orchestrates platform news", async () => {
    upsertNewsArticles(
      [
        {
          title: "Hasbro web story",
          snippet: "Online coverage.",
          url: "https://example.com/web-has",
          published_at: "2026-05-27T12:00:00.000Z",
          feedId: "globenewswire",
          sourceLabel: "GlobeNewswire",
          symbol: "HAS",
          imageUrl: null,
        },
      ],
      "company"
    );
    markNewsFeedRefreshed("globenewswire", "HAS", "company");
    const prev = getEngineSettings();
    saveEngineSettings({
      ...prev,
      usePlaywrightScrapers: false,
      aiLocalSerpEnabled: false,
    });
    const budget = freshToolBudget();
    const result = await executeLocalAiTool(
      "web_research",
      JSON.stringify({ query: "hasbro", fetchPages: 0 }),
      {
        page: "config",
        pageLabel: "Engine",
        selectedSymbol: "GOLD",
        capturedAt: new Date().toISOString(),
      },
      budget
    );
    const parsed = JSON.parse(result.content) as {
      ok: boolean;
      platformNews: { count?: number };
    };
    assert.equal(parsed.ok, true);
    assert.ok((parsed.platformNews?.count ?? 0) >= 1);
    saveEngineSettings(prev);
  });

  it("open_reader_tab returns openTab payload", async () => {
    const budget = freshToolBudget();
    const result = await executeLocalAiTool(
      "open_reader_tab",
      JSON.stringify({
        url: "https://example.com/story",
        title: "Story",
      }),
      {
        page: "terminal",
        pageLabel: "Terminal",
        capturedAt: new Date().toISOString(),
      },
      budget
    );
    assert.deepEqual(result.openTab, {
      url: "https://example.com/story",
      title: "Story",
    });
  });
});
