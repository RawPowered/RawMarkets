import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { initDatabase, closeDatabase } from "../src/server/db";
import {
  buildLocalAiSystemPrompt,
  parseOllamaStreamLine,
} from "../src/server/ollamaChat";
import { buildLocationSnapshot } from "../src/context/PlatformContext";
import type { PlatformLocation } from "../src/types";

let tmpDir = "";
let prevCwd = "";

describe("ollamaChat", () => {
  before(() => {
    prevCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rawmarkets-ollama-chat-"));
    process.chdir(tmpDir);
    initDatabase();
  });

  after(() => {
    closeDatabase();
    process.chdir(prevCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("buildLocalAiSystemPrompt embeds platform context JSON", () => {
    const ctx: PlatformLocation = {
      page: "terminal",
      pageLabel: "Track & Search Terminal",
      selectedSymbol: "GOLD",
      capturedAt: "2026-05-27T12:00:00.000Z",
    };
    const platformData = {
      focusSymbols: ["GOLD"],
      articleCount: 0,
      articles: [],
      portfolioNews: [],
      quotes: [],
      research: [],
      dataFreshness: {},
      truncated: false,
    };
    const prompt = buildLocalAiSystemPrompt(ctx, platformData);
    assert.ok(prompt.includes("RawMarkets Local Copilot"));
    assert.ok(prompt.includes('"selectedSymbol": "GOLD"'));
    assert.ok(prompt.includes("platformLocation"));
    assert.ok(prompt.includes("platformData"));
    assert.ok(prompt.includes("Bible of Wealth"));
  });

  it("parseOllamaStreamLine extracts content delta", () => {
    const line = JSON.stringify({
      message: { role: "assistant", content: "Hello" },
      done: false,
    });
    assert.equal(parseOllamaStreamLine(line), "Hello");
  });

  it("parseOllamaStreamLine returns null for empty content", () => {
    const line = JSON.stringify({ done: true });
    assert.equal(parseOllamaStreamLine(line), null);
  });

  it("parseOllamaStreamLine throws on error field", () => {
    const line = JSON.stringify({ error: "model not found" });
    assert.throws(() => parseOllamaStreamLine(line), /model not found/);
  });
});

describe("buildLocationSnapshot", () => {
  it("maps active page and selected asset", () => {
    const snap = buildLocationSnapshot({
      activePage: "terminal",
      selectedKey: "GOLD",
      activeCategory: "METALS",
      searchQuery: "",
      pinnedSymbols: ["GOLD", "SILVER"],
      assets: {
        GOLD: {
          name: "Gold Spot",
          symbol: "XAUUSD",
          unit: "USD/oz",
          current: 2400,
          open: 2390,
          high: 2410,
          low: 2385,
          volume: 0,
          change: 10,
          changePercent: "+0.42%",
          history: [],
          category: "METALS",
          desc: "",
          priceSource: "live",
        },
      },
    });
    assert.equal(snap.page, "terminal");
    assert.equal(snap.pageLabel, "Track & Search Terminal");
    assert.equal(snap.selectedSymbol, "GOLD");
    assert.equal(snap.activeCategory, "METALS");
    assert.deepEqual(snap.pinnedSymbols, ["GOLD", "SILVER"]);
    assert.equal(snap.selectedAsset?.price, 2400);
    assert.equal(snap.selectedAsset?.priceSource, "live");
  });

  it("omits ALL category and empty search", () => {
    const snap = buildLocationSnapshot({
      activePage: "overview",
      selectedKey: "GOLD",
      activeCategory: "ALL",
      searchQuery: "  ",
      pinnedSymbols: [],
      assets: {},
    });
    assert.equal(snap.page, "overview");
    assert.equal(snap.activeCategory, undefined);
    assert.equal(snap.searchQuery, undefined);
  });
});
