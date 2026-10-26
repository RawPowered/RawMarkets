import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  shouldPreflightWebResearch,
  extractWebResearchQuery,
} from "../src/server/localAiWebIntent";

describe("localAiWebIntent", () => {
  it("detects web research intent", () => {
    assert.equal(
      shouldPreflightWebResearch("use the web to research Hasbro"),
      true
    );
    assert.equal(shouldPreflightWebResearch("what is the spot price"), false);
  });

  it("extracts research topic from phrasing", () => {
    const q = extractWebResearchQuery("use the web to research Hasbro");
    assert.ok(q.toLowerCase().includes("hasbro"));
  });
});
