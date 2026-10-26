import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifySymbolRelevance,
  companyAliases,
  matchesSymbolInText,
} from "../src/server/newsBaySymbolFilter";

describe("newsBaySymbolFilter relevance", () => {
  it("matches company names and ticker context", () => {
    assert.equal(
      matchesSymbolInText(
        "Advanced Micro Devices shares rise after AI chip update",
        "AMD",
        "Advanced Micro Devices, Inc."
      ),
      true
    );
    assert.equal(
      matchesSymbolInText(
        "The math should terrify index investors: the AMDs of the market keep growing",
        "AMD",
        "Advanced Micro Devices, Inc."
      ),
      true
    );
  });

  it("requires stronger evidence for ambiguous symbols", () => {
    assert.equal(
      matchesSymbolInText("X users discuss a new social media feature", "X", "United States Steel Corp."),
      false
    );
    assert.equal(
      matchesSymbolInText("United States Steel (X) receives merger update", "X", "United States Steel Corp."),
      true
    );
    assert.equal(
      matchesSymbolInText("Cat bonds attract yield buyers", "CAT", "Caterpillar Inc."),
      false
    );
    assert.equal(
      matchesSymbolInText("Caterpillar shares rise after construction demand improves", "CAT", "Caterpillar Inc."),
      true
    );
  });

  it("treats cashtags and exchange-qualified symbols as high confidence", () => {
    assert.deepEqual(classifySymbolRelevance("$AI jumps after earnings", "AI", "C3.ai Inc.").confidence, "high");
    assert.deepEqual(classifySymbolRelevance("NYSE: X files 8-K", "X", "United States Steel Corp.").confidence, "high");
  });

  it("derives useful aliases while dropping corporate suffixes", () => {
    const aliases = companyAliases("The Goldman Sachs Group, Inc.");
    assert.ok(aliases.includes("goldman sachs"));
    assert.ok(!aliases.includes("group inc"));
  });
});
