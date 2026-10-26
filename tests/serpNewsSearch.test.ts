import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  buildSerpMarketNewsQuery,
  clearSerpNewsCache,
  searchSerpGoogleNews,
} from "../src/server/serpNewsSearch";

describe("serpNewsSearch", () => {
  it("buildSerpMarketNewsQuery appends market news suffix", () => {
    assert.ok(buildSerpMarketNewsQuery("HAS").includes("HAS"));
    assert.ok(buildSerpMarketNewsQuery("HAS").includes("market news"));
  });

  it("searchSerpGoogleNews returns empty without key", async () => {
    clearSerpNewsCache();
    const items = await searchSerpGoogleNews("test", "", { skipCache: true });
    assert.equal(items.length, 0);
  });

  it("searchSerpGoogleNews parses news_results", async () => {
    clearSerpNewsCache();
    const original = globalThis.fetch;
    globalThis.fetch = mock.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          news_results: [
            {
              title: "Hasbro beats estimates",
              snippet: "Toy maker reports.",
              link: "https://example.com/has",
              date: "Today",
              source: { name: "Reuters" },
            },
          ],
        }),
      } as Response;
    }) as typeof fetch;

    try {
      const items = await searchSerpGoogleNews("hasbro news", "fake-key", {
        skipCache: true,
      });
      assert.equal(items.length, 1);
      assert.equal(items[0].title, "Hasbro beats estimates");
      assert.equal(items[0].url, "https://example.com/has");
    } finally {
      globalThis.fetch = original;
    }
  });
});
