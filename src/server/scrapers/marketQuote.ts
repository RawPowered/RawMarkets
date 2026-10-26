import type { CachedData } from "../db";
import { scrapeCoinbaseQuote, isCryptoSymbol } from "./coinbaseSpot";
import {
  scrapeEquityQuote,
  scrapeGoogleFinanceEquityQuote,
  scrapeYahooChartQuote,
} from "./orchestrator";
import {
  isYahooScrapeable,
  resolveGoogleFinanceId,
} from "./types";
import type { ScrapeResult } from "./types";

export type MarketQuoteScrapeOptions = {
  apiCache: Record<string, CachedData>;
  assetKey: string;
  symbol: string;
  googleFinanceId?: string;
  fresh: boolean;
  persist: () => void;
  /** Allow Playwright fallbacks (single-symbol capture). Bulk refresh sets false. */
  usePlaywright: boolean;
  /** HTTP-only: Coinbase + Yahoo chart + GF fetch — no browser tabs. */
  fastCapture?: boolean;
};

const METAL_KEYS = new Set(["GOLD", "SILVER", "XAU", "XAG", "XPT", "XPD"]);

export function isMarketQuoteScrapeable(
  assetKey: string,
  symbol: string,
  googleFinanceId?: string
): boolean {
  const key = assetKey.toUpperCase();
  if (METAL_KEYS.has(key)) return false;
  if (isCryptoSymbol(assetKey, symbol)) return true;
  if (resolveGoogleFinanceId(assetKey, symbol, googleFinanceId)) return true;
  if (isYahooScrapeable(assetKey, symbol)) return true;
  return false;
}

/** Read best cached quote without network (Coinbase → Yahoo chart → GF → Yahoo). */
export async function readCachedMarketQuote(
  opts: MarketQuoteScrapeOptions
): Promise<ScrapeResult | null> {
  if (opts.fresh) return null;

  if (isCryptoSymbol(opts.assetKey, opts.symbol)) {
    const r = await scrapeCoinbaseQuote(
      opts.apiCache,
      opts.assetKey,
      opts.symbol,
      false,
      opts.persist
    );
    if (r.ok) return r;
  }

  if (isYahooScrapeable(opts.assetKey, opts.symbol)) {
    const r = await scrapeYahooChartQuote(
      opts.apiCache,
      opts.assetKey,
      opts.symbol,
      false,
      opts.persist
    );
    if (r.ok) return r;
  }

  const gfId = resolveGoogleFinanceId(
    opts.assetKey,
    opts.symbol,
    opts.googleFinanceId
  );
  if (gfId) {
    const r = await scrapeGoogleFinanceEquityQuote(
      opts.apiCache,
      opts.assetKey,
      opts.symbol,
      opts.googleFinanceId,
      false,
      opts.persist,
      false
    );
    if (r.ok) return r;
  }

  if (isYahooScrapeable(opts.assetKey, opts.symbol)) {
    const r = await scrapeEquityQuote(
      opts.apiCache,
      opts.assetKey,
      opts.symbol,
      false,
      opts.persist,
      false
    );
    if (r.ok) return r;
  }

  return null;
}

/**
 * Fast ladder: Coinbase → Yahoo chart → GF fetch → (optional) Playwright.
 * Bulk refresh uses fastCapture=true to skip all browser work.
 */
export async function scrapeMarketQuote(
  opts: MarketQuoteScrapeOptions
): Promise<ScrapeResult> {
  const {
    apiCache,
    assetKey,
    symbol,
    googleFinanceId,
    fresh,
    persist,
    usePlaywright,
    fastCapture = false,
  } = opts;

  const allowBrowser = usePlaywright && !fastCapture;

  if (!fresh) {
    const cached = await readCachedMarketQuote(opts);
    if (cached) return cached;
    return {
      ok: false,
      sourceUrl: "",
      provider: "Market",
      error: "No cached quote — use Refresh Spot Feed for a live scrape.",
    };
  }

  if (isCryptoSymbol(assetKey, symbol)) {
    return scrapeCoinbaseQuote(apiCache, assetKey, symbol, true, persist);
  }

  if (isYahooScrapeable(assetKey, symbol)) {
    const chart = await scrapeYahooChartQuote(
      apiCache,
      assetKey,
      symbol,
      true,
      persist
    );
    if (chart.ok) return chart;
  }

  const gfId = resolveGoogleFinanceId(assetKey, symbol, googleFinanceId);
  if (gfId) {
    const gf = await scrapeGoogleFinanceEquityQuote(
      apiCache,
      assetKey,
      symbol,
      googleFinanceId,
      true,
      persist,
      allowBrowser
    );
    if (gf.ok) return gf;
  }

  if (isYahooScrapeable(assetKey, symbol) && allowBrowser) {
    return scrapeEquityQuote(
      apiCache,
      assetKey,
      symbol,
      true,
      persist,
      true
    );
  }

  return {
    ok: false,
    sourceUrl: "",
    provider: "Market",
    error: fastCapture
      ? "Fast capture failed — select symbol for deep scrape or retry."
      : "No capture provider available for this symbol.",
  };
}

/** Parallel HTTP capture for multiple symbols (no shared browser queue). */
export async function scrapeMarketQuotesParallel(
  keys: string[],
  items: Record<string, import("../../types").Asset>,
  base: Omit<
    MarketQuoteScrapeOptions,
    "assetKey" | "symbol" | "googleFinanceId"
  >
): Promise<Map<string, ScrapeResult>> {
  const out = new Map<string, ScrapeResult>();
  await Promise.all(
    keys.map(async (key) => {
      const asset = items[key];
      if (!asset) return;
      const result = await scrapeMarketQuote({
        ...base,
        assetKey: key,
        symbol: asset.symbol,
        googleFinanceId: asset.googleFinanceId,
      });
      out.set(key, result);
    })
  );
  return out;
}

export function marketQuoteLabel(result: ScrapeResult): string {
  return result.provider || "Market";
}
