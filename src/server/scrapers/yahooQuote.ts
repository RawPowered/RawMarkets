import type { Page } from "playwright";
import { withScrapeTab } from "./browserPool";
import type { ScrapeResult } from "./types";
import { resolveYahooSymbol } from "./types";

function parsePriceText(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "").trim();
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function extractYahooQuoteFromPage(
  page: Page,
  yahooSymbol: string,
  url: string
): Promise<ScrapeResult> {
  try {
    await page
      .waitForSelector(
        '[data-testid="qsp-price"], fin-streamer[data-field="regularMarketPrice"], [data-symbol]',
        { timeout: 20_000 }
      )
      .catch(() => {});

    await page.waitForTimeout(2000);

    const extracted = await page.evaluate(() => {
      const qsp = document.querySelector('[data-testid="qsp-price"]');
      const streamers = document.querySelectorAll(
        'fin-streamer[data-field="regularMarketPrice"]'
      );
      let streamerText: string | null = null;
      streamers.forEach((el) => {
        const t = el.textContent?.trim();
        if (t && /\d/.test(t)) streamerText = t;
      });
      const changeEl = document.querySelector(
        '[data-testid="qsp-price-change"], fin-streamer[data-field="regularMarketChangePercent"]'
      );
      return {
        qsp: qsp?.textContent?.trim() ?? null,
        streamer: streamerText,
        change: changeEl?.textContent?.trim() ?? null,
      };
    });

    const price =
      parsePriceText(extracted.qsp) ?? parsePriceText(extracted.streamer);

    if (!price) {
      return {
        ok: false,
        sourceUrl: url,
        provider: "Yahoo Finance",
        error: `Could not parse price for ${yahooSymbol} on Yahoo Finance.`,
      };
    }

    let changePercent = "0.00%";
    if (extracted.change) {
      const m = extracted.change.match(/([+-]?\d+\.?\d*)\s*%/);
      if (m) {
        const v = parseFloat(m[1]);
        changePercent = `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
      }
    }

    return {
      ok: true,
      price,
      changePercent,
      change: 0,
      sourceUrl: url,
      provider: "Yahoo Finance",
      scrapedAt: Date.now(),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      sourceUrl: url,
      provider: "Yahoo Finance",
      error: msg,
    };
  }
}

export async function scrapeYahooQuote(
  assetKey: string,
  symbol: string
): Promise<ScrapeResult> {
  const yahooSymbol = resolveYahooSymbol(assetKey, symbol);
  const url = `https://finance.yahoo.com/quote/${encodeURIComponent(yahooSymbol)}/`;
  return withScrapeTab(url, (page) =>
    extractYahooQuoteFromPage(page, yahooSymbol, url)
  );
}
