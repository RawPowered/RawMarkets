import { test, expect } from "@playwright/test";
import { scrapeKitcoMetal } from "../../src/server/scrapers/kitcoMetals";
import { closeBrowser } from "../../src/server/scrapers/browserPool";

test.afterAll(async () => {
  await closeBrowser();
});

test("Kitco XAG parses a plausible silver spot", async () => {
  const result = await scrapeKitcoMetal("XAG");
  expect(result.ok, result.error ?? "scrape failed").toBe(true);
  expect(result.price).toBeGreaterThan(50);
  expect(result.price).toBeLessThan(150);
  expect(result.provider).toBe("Kitco");
});
