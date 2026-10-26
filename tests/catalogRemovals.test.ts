import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { initDatabase, setCustomAsset, getDb, closeDatabase } from "../src/server/db";
import { deleteAsset } from "../src/server/assetLifecycle";
import {
  clearCatalogRemovals,
  isCatalogSymbolRemoved,
} from "../src/server/catalogRemovals";
import {
  presetToAssetMetadata,
  restoreMissingBaselinePresets,
  EMBEDDED_CATALOG_PRESETS,
} from "../src/server/embeddedCatalog";

let tmpDir = "";
let prevCwd = "";

before(() => {
  prevCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rawmarkets-removals-"));
  process.chdir(tmpDir);
  initDatabase();
});

after(() => {
  closeDatabase();
  process.chdir(prevCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("catalogRemovals", () => {
  it("delete + restoreMissingBaselinePresets does not resurrect removed preset", () => {
    const goldPreset = EMBEDDED_CATALOG_PRESETS.find((p) => p.key === "GOLD");
    assert.ok(goldPreset);
    setCustomAsset("GOLD", presetToAssetMetadata(goldPreset!));

    const del = deleteAsset("GOLD", { force: true });
    assert.equal(del.deleted, true);
    assert.equal(isCatalogSymbolRemoved("GOLD"), true);

    const rowBefore = getDb()
      .prepare("SELECT symbol FROM custom_assets WHERE symbol = ?")
      .get("GOLD");
    assert.equal(rowBefore, undefined);

    restoreMissingBaselinePresets();

    const rowAfter = getDb()
      .prepare("SELECT symbol FROM custom_assets WHERE symbol = ?")
      .get("GOLD");
    assert.equal(rowAfter, undefined);
  });

  it("includeRemoved restores symbols after clearCatalogRemovals", () => {
    clearCatalogRemovals();
    const goldPreset = EMBEDDED_CATALOG_PRESETS.find((p) => p.key === "GOLD");
    assert.ok(goldPreset);
    deleteAsset("GOLD", { force: true });
    assert.equal(isCatalogSymbolRemoved("GOLD"), true);

    const skipped = restoreMissingBaselinePresets();
    assert.equal(skipped, 0);

    const withRemoved = restoreMissingBaselinePresets({ includeRemoved: true });
    assert.ok(withRemoved >= 1);

    const row = getDb()
      .prepare("SELECT symbol FROM custom_assets WHERE symbol = ?")
      .get("GOLD") as { symbol: string } | undefined;
    assert.equal(row?.symbol, "GOLD");
  });

  it("clearCatalogRemovals allows auto-restore again", () => {
    deleteAsset("SILVER", { force: true });
    assert.equal(isCatalogSymbolRemoved("SILVER"), true);

    clearCatalogRemovals();
    assert.equal(isCatalogSymbolRemoved("SILVER"), false);

    const restored = restoreMissingBaselinePresets();
    assert.ok(restored >= 1);

    const row = getDb()
      .prepare("SELECT symbol FROM custom_assets WHERE symbol = ?")
      .get("SILVER");
    assert.ok(row);
  });
});
