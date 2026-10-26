import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeRankScore,
  detectEventType,
  freshnessBoost,
  normalizeTitle,
  rankArticles,
  titleSimilarity,
} from "../src/server/newsBayRank";
import { padCik } from "../src/server/secCikResolver";
import { SOURCE_CLASS_WEIGHT } from "../src/server/newsFeedRegistry";

describe("newsBayRank", () => {
  it("titleSimilarity detects near-duplicates", () => {
    const a = "Apple reports Q1 earnings beat estimates";
    const b = "Apple reports Q1 earnings beat analyst estimates";
    assert.ok(titleSimilarity(a, b) >= 0.65);
  });

  it("detectEventType picks SEC form", () => {
    assert.equal(detectEventType("Filing", "", "8-K"), "8-K");
    assert.equal(detectEventType("FDA approval", "trial"), "fda");
  });

  it("freshnessBoost favors recent items", () => {
    const recent = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const old = new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString();
    assert.ok(freshnessBoost(recent) > freshnessBoost(old));
  });

  it("rankArticles sorts by rankScore descending", () => {
    const ranked = rankArticles([
      {
        title: "Low priority aggregator",
        snippet: "x",
        url: null,
        published_at: null,
        feedId: "yahoo",
        symbol: "AAPL",
        sourceLabel: "Yahoo",
        imageUrl: null,
        sourceClass: "aggregator",
        sourceWeight: SOURCE_CLASS_WEIGHT.aggregator,
      },
      {
        title: "SEC 8-K material event",
        snippet: "AAPL",
        url: "https://sec.gov",
        published_at: new Date().toISOString(),
        feedId: "sec_8k",
        symbol: "AAPL",
        sourceLabel: "SEC",
        imageUrl: null,
        sourceClass: "primary",
        sourceWeight: SOURCE_CLASS_WEIGHT.primary,
        secFormType: "8-K",
      },
    ]);
    assert.equal(ranked[0].feedId, "sec_8k");
    assert.ok(ranked[0].rankScore > ranked[1].rankScore);
  });

  it("duplicatePenalty reduces score for similar titles", () => {
    const title = "Company announces merger with rival";
    const first = computeRankScore(
      {
        title,
        snippet: "",
        url: null,
        published_at: null,
        feedId: "a",
        symbol: "X",
        sourceLabel: "A",
        imageUrl: null,
        sourceClass: "primary",
        sourceWeight: 1,
      },
      []
    );
    const second = computeRankScore(
      {
        title: "Company announces merger with rival firm",
        snippet: "",
        url: null,
        published_at: null,
        feedId: "b",
        symbol: "X",
        sourceLabel: "B",
        imageUrl: null,
        sourceClass: "primary",
        sourceWeight: 1,
      },
      [title]
    );
    assert.ok(second.duplicatePenalty > 0);
    assert.ok(first.rankScore > second.rankScore);
  });
});

describe("secCikResolver", () => {
  it("padCik zero-fills to 10 digits", () => {
    assert.equal(padCik(320193), "0000320193");
    assert.equal(padCik("320193"), "0000320193");
  });
});

describe("newsBayRank normalizeTitle", () => {
  it("strips punctuation", () => {
    assert.equal(
      normalizeTitle("Hello, World!"),
      "hello world"
    );
  });
});
