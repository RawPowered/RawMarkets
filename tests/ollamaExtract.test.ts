import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  keywordSentimentFallback,
  validateExtractedJson,
} from "../src/server/ollamaExtract";

describe("ollamaExtract", () => {
  it("keyword fallback detects bullish text", () => {
    const r = keywordSentimentFallback(
      "Gold surges to all-time high as rally continues"
    );
    assert.ok(r.sentiment > 0.2);
    assert.equal(r.confidence, 0.3);
  });

  it("keyword fallback detects bearish text", () => {
    const r = keywordSentimentFallback(
      "Stock plummets on recession concern and weak demand"
    );
    assert.ok(r.sentiment < -0.2);
  });

  it("validateExtractedJson rejects invalid payload", () => {
    assert.equal(validateExtractedJson({ bad: true }, "TSLA"), null);
  });

  it("validateExtractedJson accepts valid payload", () => {
    const v = validateExtractedJson(
      {
        symbols: ["tsla"],
        sentiment: 0.5,
        novelty: 0.4,
        time_horizon: "days",
        macro_tags: ["tech"],
        event_type: "earnings",
        confidence: 0.8,
      },
      "TSLA"
    );
    assert.ok(v);
    assert.deepEqual(v!.symbols, ["TSLA"]);
  });
});
