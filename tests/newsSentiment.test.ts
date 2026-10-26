import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  keywordScoreFromText,
  numericToUiSentiment,
  scoreSerpApiNewsItem,
} from "../src/server/newsSentiment";
import { parseRssXml, extractRssThumbnail, normalizeRssImageUrl } from "../src/server/rssFetch";
import { ouncePriceUsdFromApiRates } from "../src/server/metalSpot";
import * as cheerio from "cheerio";
import { matchesSymbolInText as symbolFilter } from "../src/server/newsBaySymbolFilter";

describe("newsSentiment", () => {
  it("numericToUiSentiment maps thresholds", () => {
    assert.equal(numericToUiSentiment(0.5), "Bullish");
    assert.equal(numericToUiSentiment(-0.5), "Negative");
    assert.equal(numericToUiSentiment(0), "Neutral");
  });

  it("keywordScoreFromText detects bullish headline", () => {
    const r = keywordScoreFromText("Stock surges on strong rally");
    assert.equal(r.sentiment, "Bullish");
    assert.ok(r.score > 0);
    assert.equal(r.engine, "keyword");
  });

  it("scoreSerpApiNewsItem matches legacy serp shape", () => {
    const r = scoreSerpApiNewsItem({
      title: "Markets fall on recession concern",
      snippet: "weak demand",
    });
    assert.equal(r.sentiment, "Negative");
  });
});

describe("rssFetch", () => {
  it("normalizeRssImageUrl accepts https and rejects trackers", () => {
    assert.equal(
      normalizeRssImageUrl("https://cdn.example.com/photo.jpg"),
      "https://cdn.example.com/photo.jpg"
    );
    assert.equal(normalizeRssImageUrl("//cdn.example.com/x.png"), "https://cdn.example.com/x.png");
    assert.equal(normalizeRssImageUrl("https://x.com/1x1.gif"), null);
  });

  it("extractRssThumbnail reads media:thumbnail", () => {
    const xml = `<item>
      <title>T</title>
      <media:thumbnail url="https://cdn.example.com/thumb.jpg"/>
      <description>text</description>
    </item>`;
    const $ = cheerio.load(xml, { xmlMode: true });
    const el = $("item").get(0)!;
    assert.equal(
      extractRssThumbnail($, el),
      "https://cdn.example.com/thumb.jpg"
    );
  });

  it("parseRssXml extracts items", () => {
    const xml = `<?xml version="1.0"?>
      <rss><channel>
        <item>
          <title>Test Headline</title>
          <description><![CDATA[Snippet here]]></description>
          <link>https://example.com/a</link>
          <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
        </item>
      </channel></rss>`;
    const items = parseRssXml(xml, "Test", 5);
    assert.equal(items.length, 1);
    assert.equal(items[0].title, "Test Headline");
    assert.ok(items[0].snippet.includes("Snippet"));
  });

  it("parseRssXml extracts image from description img", () => {
    const xml = `<?xml version="1.0"?><rss><channel><item>
      <title>With image</title>
      <description>&lt;p&gt;&lt;img src="https://cdn.example.com/hero.jpg"/&gt; Body&lt;/p&gt;</description>
      <link>https://example.com/a</link>
    </item></channel></rss>`;
    const items = parseRssXml(xml, "Test", 5);
    assert.equal(items[0]?.imageUrl, "https://cdn.example.com/hero.jpg");
  });
});

describe("metalSpot", () => {
  it("ouncePriceUsdFromApiRates prefers USDXAU direct field", () => {
    const price = ouncePriceUsdFromApiRates(
      { XAU: 0.000219, USDXAU: 4567.0 },
      "XAU",
      999
    );
    assert.equal(price, 4567.0);
  });

  it("ouncePriceUsdFromApiRates inverts XAU when no direct field", () => {
    const price = ouncePriceUsdFromApiRates({ XAU: 0.000219 }, "XAU", 999);
    assert.ok(price > 4500 && price < 4600);
  });
});

describe("newsBaySymbolFilter", () => {
  it("matchesSymbolInText finds ticker", () => {
    assert.ok(symbolFilter("Apple Inc AAPL rises", "AAPL", "Apple Inc"));
    assert.ok(!symbolFilter("Unrelated market news", "ZZZZ", null));
  });
});
