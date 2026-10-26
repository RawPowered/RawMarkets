import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import {
  buildResearchCapabilitiesPrompt,
  buildToolUseInstructions,
} from "../src/server/localAiTools";
import {
  DEFAULT_ENGINE_SETTINGS,
  initDatabase,
  closeDatabase,
} from "../src/server/db";

let tmpDir = "";
let prevCwd = "";

before(() => {
  prevCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rawmarkets-localai-agent-"));
  process.chdir(tmpDir);
  initDatabase();
});

after(() => {
  closeDatabase();
  process.chdir(prevCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("localAiAgent helpers", () => {
  it("buildToolUseInstructions mentions web research", () => {
    const text = buildToolUseInstructions(DEFAULT_ENGINE_SETTINGS);
    assert.ok(text.includes("web_research"));
    assert.ok(text.includes("NEVER tell the user to open a web browser"));
  });

  it("buildResearchCapabilitiesPrompt mentions Playwright and Serp", () => {
    const text = buildResearchCapabilitiesPrompt({
      ...DEFAULT_ENGINE_SETTINGS,
      aiLocalSerpEnabled: true,
    });
    assert.ok(text.includes("Playwright"));
    assert.ok(text.includes("SerpApi"));
  });
});
