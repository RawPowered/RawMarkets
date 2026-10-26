import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  shouldPreflightNewsSearch,
  extractNewsQueryTerms,
} from "../src/server/localAiNewsResolve";

describe("localAiNewsResolve", () => {
  it("detects news intent", () => {
    assert.equal(shouldPreflightNewsSearch("check Hasbro news"), true);
    assert.equal(shouldPreflightNewsSearch("what is the price of gold"), false);
  });

  it("extracts query from news on X phrasing", () => {
    assert.equal(
      extractNewsQueryTerms("latest news on Hasbro"),
      "Hasbro"
    );
  });
});
