import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ENGINE_SETTINGS, type EngineSettings } from "../src/server/db";
import {
  buildWealthBibleRuleSpacePrompt,
  countActiveWealthBibleRules,
  resolveEnabledWealthBibleRules,
} from "../src/server/wealthBibleRuleSpace";
import {
  DEFAULT_ENABLED_WEALTH_BIBLE_RULE_IDS,
  WEALTH_BIBLE_RULES,
} from "../src/lib/wealthBibleRules";

function settings(patch: Partial<EngineSettings>): EngineSettings {
  return { ...DEFAULT_ENGINE_SETTINGS, ...patch };
}

describe("wealthBibleRuleSpace", () => {
  it("returns empty prompt when disabled", () => {
    const s = settings({ aiWealthBibleEnabled: false });
    assert.equal(buildWealthBibleRuleSpacePrompt(s), "");
    assert.equal(countActiveWealthBibleRules(s), 0);
    assert.equal(resolveEnabledWealthBibleRules(s).length, 0);
  });

  it("resolves all catalog rules when enabled with empty rule ids", () => {
    const s = settings({ aiWealthBibleEnabled: true, aiWealthBibleRuleIds: [] });
    const rules = resolveEnabledWealthBibleRules(s);
    assert.equal(rules.length, DEFAULT_ENABLED_WEALTH_BIBLE_RULE_IDS.length);
    assert.equal(countActiveWealthBibleRules(s), rules.length);
  });

  it("filters to explicit rule ids only", () => {
    const s = settings({
      aiWealthBibleEnabled: true,
      aiWealthBibleRuleIds: ["law-1", "law-2"],
    });
    const rules = resolveEnabledWealthBibleRules(s);
    assert.equal(rules.length, 2);
    assert.deepEqual(
      rules.map((r) => r.id),
      ["law-1", "law-2"]
    );
  });

  it("sorts by priority ascending", () => {
    const ids = ["inv-pillar-D", "law-1", "fly-3"];
    const s = settings({ aiWealthBibleEnabled: true, aiWealthBibleRuleIds: ids });
    const rules = resolveEnabledWealthBibleRules(s);
    const priorities = rules.map((r) => r.priority);
    assert.deepEqual(priorities, [...priorities].sort((a, b) => a - b));
  });

  it("builds prompt with header and rule lines", () => {
    const s = settings({
      aiWealthBibleEnabled: true,
      aiWealthBibleRuleIds: ["law-1"],
    });
    const prompt = buildWealthBibleRuleSpacePrompt(s);
    assert.ok(prompt.includes("First principles — Bible of Wealth"));
    assert.ok(prompt.includes("[law-1]"));
    assert.ok(prompt.includes("survival"));
  });

  it("truncates lowest-priority rules when maxChars exceeded", () => {
    const allIds = WEALTH_BIBLE_RULES.map((r) => r.id);
    const s = settings({ aiWealthBibleEnabled: true, aiWealthBibleRuleIds: allIds });
    const prompt = buildWealthBibleRuleSpacePrompt(s, { maxChars: 200 });
    assert.ok(prompt.includes("omitted for length"));
    assert.ok(prompt.length <= 400);
  });
});
