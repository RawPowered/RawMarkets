import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { initDatabase, closeDatabase } from "../src/server/db";
import {
  getDashboardLayout,
  saveDashboardLayout,
} from "../src/server/dashboardLayoutDb";
import { syncPinnedSymbols, listPinnedSymbols } from "../src/server/terminalSymbolPrefs";
import {
  createDefaultLayout,
  flattenLayoutSymbols,
  mergePinnedIntoLayout,
  pruneLayoutSymbols,
} from "../src/lib/dashboardLayout";
import { sortSymbols } from "../src/lib/dashboardSort";
import type { Asset } from "../src/types";

let tmpDir = "";
let prevCwd = "";

before(() => {
  prevCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rawmarkets-dashboard-"));
  process.chdir(tmpDir);
  initDatabase();
});

after(() => {
  closeDatabase();
  process.chdir(prevCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const sampleAssets: Record<string, Asset> = {
  AAA: {
    name: "A",
    symbol: "AAA",
    unit: "USD",
    current: 10,
    open: 10,
    high: 10,
    low: 10,
    volume: 0,
    change: 1,
    changePercent: "+5.00%",
    history: [],
    category: "TECH",
    desc: "",
    priceSource: "cached",
  },
  BBB: {
    name: "B",
    symbol: "BBB",
    unit: "USD",
    current: 20,
    open: 20,
    high: 20,
    low: 20,
    volume: 0,
    change: -2,
    changePercent: "-2.00%",
    history: [],
    category: "TECH",
    desc: "",
    priceSource: "cached",
  },
  CCC: {
    name: "C",
    symbol: "CCC",
    unit: "USD",
    current: 5,
    open: 5,
    high: 5,
    low: 5,
    volume: 0,
    change: 0,
    changePercent: "+0.50%",
    history: [],
    category: "TECH",
    desc: "",
    priceSource: "cached",
  },
};

describe("dashboardLayout", () => {
  it("createDefaultLayout uses pinned order", () => {
    const layout = createDefaultLayout(["ZZZ", "AAA"]);
    assert.deepEqual(flattenLayoutSymbols(layout), ["ZZZ", "AAA"]);
  });

  it("save and load layout round-trip", () => {
    const layout = createDefaultLayout(["GOLD", "SILVER"]);
    layout.skin = "terminal";
    layout.sortMode = "gainers";
    saveDashboardLayout(layout);
    const loaded = getDashboardLayout(["GOLD", "SILVER"]);
    assert.equal(loaded.skin, "terminal");
    assert.equal(loaded.sortMode, "gainers");
    assert.deepEqual(flattenLayoutSymbols(loaded), ["GOLD", "SILVER"]);
  });

  it("sortSymbols orders gainers and losers", () => {
    const symbols = ["BBB", "AAA", "CCC"];
    const gainers = sortSymbols(symbols, sampleAssets, "gainers");
    assert.deepEqual(gainers, ["AAA", "CCC", "BBB"]);
    const losers = sortSymbols(symbols, sampleAssets, "losers");
    assert.deepEqual(losers, ["BBB", "CCC", "AAA"]);
  });

  it("syncPinnedSymbols preserves order via pin_order", () => {
    syncPinnedSymbols(["ZZZ", "MMM", "AAA"]);
    const listed = listPinnedSymbols();
    assert.deepEqual(listed, ["ZZZ", "MMM", "AAA"]);
  });

  it("pruneLayoutSymbols removes stale keys", () => {
    const layout = createDefaultLayout(["GONE", "KEEP"]);
    const pruned = pruneLayoutSymbols(layout, new Set(["KEEP"]));
    assert.deepEqual(flattenLayoutSymbols(pruned), ["KEEP"]);
  });

  it("mergePinnedIntoLayout appends new pins", () => {
    const layout = createDefaultLayout(["A"]);
    const merged = mergePinnedIntoLayout(layout, ["A", "B"]);
    assert.deepEqual(flattenLayoutSymbols(merged), ["A", "B"]);
  });
});
