import type { CachedData } from "./db";
import { setApiCacheEntry } from "./db";
import type { HistoryPoint } from "../types";

const CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const CACHE_TTL_MS = 10 * 60 * 1000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export type YahooChartRange = "1d" | "7d" | "1mo" | "3mo";

export interface YahooQuoteResult {
  ok: boolean;
  symbol: string;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  history: HistoryPoint[];
  source: "yahoo_chart" | "cached";
  error?: string;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: (number | null)[];
        }>;
      };
    }>;
    error?: { description?: string };
  };
}

function cacheKey(symbol: string, range: YahooChartRange): string {
  return `yahoo_chart_${symbol.toUpperCase()}_${range}`;
}

function rangeToParam(range: YahooChartRange): string {
  if (range === "7d") return "7d";
  if (range === "1mo") return "1mo";
  if (range === "3mo") return "3mo";
  return "1d";
}

function parseChartPayload(
  data: YahooChartResponse,
  symbol: string
): Omit<YahooQuoteResult, "ok" | "source"> {
  const result = data.chart?.result?.[0];
  if (!result) {
    return {
      symbol,
      price: null,
      previousClose: null,
      change: null,
      changePercent: null,
      history: [],
      error: data.chart?.error?.description ?? "Empty Yahoo chart response",
    };
  }

  const meta = result.meta ?? {};
  const price = meta.regularMarketPrice ?? null;
  const previousClose =
    meta.chartPreviousClose ?? meta.previousClose ?? null;

  let change: number | null = null;
  let changePercent: number | null = null;
  if (price != null && previousClose != null && previousClose > 0) {
    change = price - previousClose;
    changePercent = (change / previousClose) * 100;
  }

  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const history: HistoryPoint[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close == null || !Number.isFinite(close)) continue;
    const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
    history.push({
      date,
      value: parseFloat(close.toFixed(4)),
    });
  }

  if (history.length === 0 && price != null) {
    history.push({
      date: new Date().toISOString().slice(0, 10),
      value: price,
    });
  }

  return {
    symbol,
    price,
    previousClose,
    change,
    changePercent,
    history,
  };
}

export async function fetchYahooChart(
  symbol: string,
  range: YahooChartRange = "1d",
  options?: {
    fresh?: boolean;
    apiCache?: Record<string, CachedData>;
    persistCache?: () => void;
  }
): Promise<YahooQuoteResult> {
  const sym = symbol.trim().toUpperCase();
  const key = cacheKey(sym, range);
  const cache = options?.apiCache;

  if (!options?.fresh && cache?.[key]) {
    const entry = cache[key];
    if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
      const cached = entry.data as Omit<YahooQuoteResult, "source">;
      return { ok: !!cached.price, source: "cached", ...cached };
    }
  }

  const url = `${CHART_BASE}/${encodeURIComponent(sym)}?interval=1d&range=${rangeToParam(range)}`;

  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!resp.ok) {
      return {
        ok: false,
        symbol: sym,
        price: null,
        previousClose: null,
        change: null,
        changePercent: null,
        history: [],
        source: "yahoo_chart",
        error: `Yahoo chart HTTP ${resp.status}`,
      };
    }

    const data = (await resp.json()) as YahooChartResponse;
    const parsed = parseChartPayload(data, sym);
    const ok = parsed.price != null && parsed.price > 0;

    if (cache && ok) {
      cache[key] = { timestamp: Date.now(), data: parsed };
      if (options?.persistCache) {
        setApiCacheEntry(key, cache[key]);
        options.persistCache();
      }
    }

    return { ok, source: "yahoo_chart", ...parsed };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      symbol: sym,
      price: null,
      previousClose: null,
      change: null,
      changePercent: null,
      history: [],
      source: "yahoo_chart",
      error: msg,
    };
  }
}

const CHART_QUOTE_URL = (sym: string) =>
  `${CHART_BASE}/${encodeURIComponent(sym)}?interval=1d&range=1d`;

/** Map Yahoo chart API result to unified scrape shape. */
export function chartResultToScrapeResult(
  chart: YahooQuoteResult,
  yahooSymbol: string
): import("./scrapers/types").ScrapeResult {
  const sourceUrl = CHART_QUOTE_URL(yahooSymbol);
  if (!chart.ok || chart.price == null || chart.price <= 0) {
    return {
      ok: false,
      sourceUrl,
      provider: "Yahoo Chart API",
      error: chart.error ?? "No price from Yahoo chart API",
    };
  }
  let changePercent = "0.00%";
  if (chart.changePercent != null && Number.isFinite(chart.changePercent)) {
    const v = chart.changePercent;
    changePercent = `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
  }
  return {
    ok: true,
    price: chart.price,
    change: chart.change ?? undefined,
    changePercent,
    sourceUrl,
    provider: "Yahoo Chart API",
    scrapedAt: Date.now(),
  };
}

export async function fetchYahooMultiRange(
  symbol: string,
  options?: {
    fresh?: boolean;
    apiCache?: Record<string, CachedData>;
    persistCache?: () => void;
  }
): Promise<{
  quote: YahooQuoteResult;
  history7d: HistoryPoint[];
  history30d: HistoryPoint[];
}> {
  const [quote, w7, m1] = await Promise.all([
    fetchYahooChart(symbol, "1d", options),
    fetchYahooChart(symbol, "7d", options),
    fetchYahooChart(symbol, "1mo", options),
  ]);

  return {
    quote,
    history7d: w7.history,
    history30d: m1.history,
  };
}
