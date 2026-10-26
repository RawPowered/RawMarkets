import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { initDatabase, closeDatabase } from "../src/server/db";
import { resolveSymbolLogo } from "../src/server/symbolLogo";
import {
  resolveSymbolDomain,
  googleFaviconUrl,
  guessDomainFromSymbol,
} from "../src/lib/symbolDomains";

let tmpDir = "";
let prevCwd = "";

before(() => {
  prevCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rawmarkets-logo-"));
  process.chdir(tmpDir);
  initDatabase();
});

after(() => {
  closeDatabase();
  process.chdir(prevCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("symbolLogo", () => {
  it("resolves known symbols from map", () => {
    assert.equal(resolveSymbolDomain("NVDA"), "nvidia.com");
    const info = resolveSymbolLogo("NVDA");
    assert.equal(info.source, "map");
    assert.equal(info.domain, "nvidia.com");
    assert.ok(info.logoUrl?.includes("favicons"));
  });

  it("guesses domain for unknown ticker", () => {
    const guessed = guessDomainFromSymbol("ACME");
    assert.equal(guessed, "acme.com");
    const info = resolveSymbolLogo("ACME");
    assert.equal(info.source, "guess");
    assert.equal(info.domain, "acme.com");
  });

  it("builds google favicon url", () => {
    const url = googleFaviconUrl("apple.com", 128);
    assert.ok(url.includes("apple.com"));
    assert.ok(url.includes("sz=128"));
  });
});
