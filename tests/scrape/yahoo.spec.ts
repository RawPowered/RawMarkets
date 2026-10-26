import { test, expect } from "@playwright/test";
import { scrapeYahooQuote } from "../../src/server/scrapers/yahooQuote";
import { closeBrowser } from "../../src/server/scrapers/browserPool";

test.afterAll(async () => {
  await closeBrowser();
});

test("Yahoo TSLA parses a plausible equity price", async () => {
  const result = await scrapeYahooQuote("TSLA", "TSLA");
  expect(result.ok, result.error ?? "scrape failed").toBe(true);
  expect(result.price).toBeGreaterThan(100);
  expect(result.price).toBeLessThan(2000);
  expect(result.provider).toBe("Yahoo Finance");
});
