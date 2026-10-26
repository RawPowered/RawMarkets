import type { CachedData } from "../db";
import {
  resolveMetalsCapture,
  type MetalsCaptureOptions,
} from "../metalsCapture";
import {
  readScrapeCache,
  scrapeCacheKey,
  writeScrapeCache,
} from "./scrapeCache";
import type { MetalScrapeBundle, ScrapeResult } from "./types";
import { scrapeYahooQuote } from "./yahooQuote";
import {
  resolveGoogleFinanceId,
  resolveYahooSymbol,
} from "./types";
import { historyAlignedToScrapePrice } from "../../lib/scrapeHistory";
import {
  scrapeGoogleFinanceBetaQuote,
  scrapeGoogleFinanceBetaQuoteFetch,
  googleFinanceBetaQuoteUrl,
  GOOGLE_FINANCE_BETA_PROVIDER,
} from "./googleFinanceBeta";
import {
  chartResultToScrapeResult,
  fetchYahooChart,
} from "../yahooChart";
import { runTrackedScrape, recordInstantScrapeActivity } from "./scrapeQueue";

export type ScrapeMetalsOptions = MetalsCaptureOptions;

/** @deprecated Prefer resolveMetalsCapture — thin wrapper for existing imports. */
export async function scrapeMetals(
  apiCache: Record<string, CachedData>,
  fresh: boolean,
  persist: () => void,
  extra?: Omit<MetalsCaptureOptions, "apiCache" | "fresh" | "persist">
): Promise<MetalScrapeBundle> {
  return resolveMetalsCapture({
    apiCache,
    fresh,
    persist,
    ...extra,
  });
}

export async function scrapeYahooChartQuote(
  apiCache: Record<string, CachedData>,
  assetKey: string,
  symbol: string,
  fresh: boolean,
  persist: () => void
): Promise<ScrapeResult> {
  const yahooSymbol = resolveYahooSymbol(assetKey, symbol);
  const cacheKey = scrapeCacheKey("yahoo_chart", yahooSymbol);
  const cached = readScrapeCache(apiCache, cacheKey, fresh);
  if (cached) return { ...cached, provider: cached.provider || "Yahoo Chart API" };

  if (!fresh) {
    return {
      ok: false,
      sourceUrl: "",
      provider: "Yahoo Chart API",
      error: "No cached Yahoo chart quote — use Refresh Spot Feed.",
    };
  }

  const started = Date.now();
  const chart = await fetchYahooChart(yahooSymbol, "1d", {
    fresh: true,
    apiCache,
    persistCache: persist,
  });
  const result = chartResultToScrapeResult(chart, yahooSymbol);
  recordInstantScrapeActivity({
    provider: "Yahoo Chart API",
    symbol: yahooSymbol,
    url: result.sourceUrl,
    ok: result.ok,
    price: result.price,
    error: result.error,
    elapsedMs: Date.now() - started,
  });
  writeScrapeCache(apiCache, cacheKey, result, persist);
  return result;
}

export async function scrapeEquityQuote(
  apiCache: Record<string, CachedData>,
  assetKey: string,
  symbol: string,
  fresh: boolean,
  persist: () => void,
  usePlaywright = true
): Promise<ScrapeResult> {
  const yahooSymbol = resolveYahooSymbol(assetKey, symbol);
  const cacheKey = scrapeCacheKey("yahoo", yahooSymbol);

  const cached = readScrapeCache(apiCache, cacheKey, fresh);
  if (cached) return cached;

  if (!fresh) {
    const chartCached = readScrapeCache(
      apiCache,
      scrapeCacheKey("yahoo_chart", yahooSymbol),
      false
    );
    if (chartCached) return chartCached;
    return {
      ok: false,
      sourceUrl: "",
      provider: "Yahoo Finance",
      error: "No cached Yahoo quote — use Refresh Spot Feed for a live scrape.",
    };
  }

  const chartResult = await scrapeYahooChartQuote(
    apiCache,
    assetKey,
    symbol,
    true,
    persist
  );
  if (chartResult.ok) return chartResult;

  if (!usePlaywright) return chartResult;

  const result = await runTrackedScrape(
    {
      provider: "Yahoo Finance",
      symbol: yahooSymbol,
      url: `https://finance.yahoo.com/quote/${encodeURIComponent(yahooSymbol)}/`,
    },
    () => scrapeYahooQuote(assetKey, symbol)
  );
  writeScrapeCache(apiCache, cacheKey, result, persist);
  return result;
}

export async function scrapeGoogleFinanceEquityQuote(
  apiCache: Record<string, CachedData>,
  assetKey: string,
  symbol: string,
  googleFinanceId: string | undefined,
  fresh: boolean,
  persist: () => void,
  usePlaywright: boolean
): Promise<ScrapeResult> {
  const gfId = resolveGoogleFinanceId(assetKey, symbol, googleFinanceId);
  if (!gfId) {
    return {
      ok: false,
      sourceUrl: "",
      provider: GOOGLE_FINANCE_BETA_PROVIDER,
      error: "No Google Finance id for this symbol.",
    };
  }

  const cacheKey = scrapeCacheKey("google_finance", gfId);
  const cached = readScrapeCache(apiCache, cacheKey, fresh);
  if (cached) return cached;

  if (!fresh) {
    return {
      ok: false,
      sourceUrl: "",
      provider: GOOGLE_FINANCE_BETA_PROVIDER,
      error:
        "No cached Google Finance quote — use Refresh Spot Feed for a live scrape.",
    };
  }

  const url = googleFinanceBetaQuoteUrl(gfId);

  if (!usePlaywright) {
    const fetched = await scrapeGoogleFinanceBetaQuoteFetch(gfId);
    if (fetched.ok) {
      recordInstantScrapeActivity({
        provider: GOOGLE_FINANCE_BETA_PROVIDER,
        symbol: gfId,
        url: fetched.sourceUrl,
        ok: true,
        price: fetched.price,
      });
    }
    writeScrapeCache(apiCache, cacheKey, fetched, persist);
    return fetched;
  }

  const result = await runTrackedScrape(
    { provider: GOOGLE_FINANCE_BETA_PROVIDER, symbol: gfId, url },
    () => scrapeGoogleFinanceTiered(gfId, usePlaywright)
  );

  writeScrapeCache(apiCache, cacheKey, result, persist);
  return result;
}

/** HTTP fetch first, then Playwright if needed. */
async function scrapeGoogleFinanceTiered(
  gfId: string,
  allowPlaywright: boolean
): Promise<ScrapeResult> {
  const fetchStarted = Date.now();
  const fetched = await scrapeGoogleFinanceBetaQuoteFetch(gfId);
  if (fetched.ok) {
    recordInstantScrapeActivity({
      provider: GOOGLE_FINANCE_BETA_PROVIDER,
      symbol: gfId,
      url: fetched.sourceUrl,
      ok: true,
      price: fetched.price,
      elapsedMs: Date.now() - fetchStarted,
    });
    return fetched;
  }

  if (allowPlaywright) {
    const live = await scrapeGoogleFinanceBetaQuote(gfId);
    if (live.ok) return live;
    return live;
  }

  return fetched;
}

export function applyScrapeToAsset(
  item: import("../../types").Asset,
  result: ScrapeResult
): import("../../types").Asset | null {
  if (!result.ok || result.price == null) return null;
  const history =
    item.history.length >= 1
      ? historyAlignedToScrapePrice(item.history, item.current, result.price)
      : [];
  const open = history[0]?.value ?? result.price;
  const values = history.length > 0 ? history.map((p) => p.value) : [result.price];
  return {
    ...item,
    current: result.price,
    open,
    high: Math.max(...values, result.price),
    low: Math.min(...values, result.price),
    change: result.change ?? item.change,
    changePercent: result.changePercent ?? item.changePercent,
    history,
    priceSource: "scrape",
    historySource: history.length >= 2 ? "scrape" : item.historySource,
    feedNote: undefined,
  };
}
