import type { Asset, FeedSource, MarketFeedStats } from "../types";

export type { FeedSource, MarketFeedStats };

let lastFeedStats: MarketFeedStats | null = null;

export function getLastFeedStats(): MarketFeedStats | null {
  return lastFeedStats;
}

export function setLastFeedStats(stats: MarketFeedStats): void {
  lastFeedStats = stats;
}

export function tagAssetSources(
  items: Record<string, Asset & { priceSource?: FeedSource; historySource?: FeedSource }>,
  livePrice: Set<string>,
  liveHistory: Set<string>,
  cachedPrice?: Set<string>,
  scrapePrice?: Set<string>
): Record<string, Asset> {
  const cached = cachedPrice ?? new Set<string>();
  const scraped = scrapePrice ?? new Set<string>();
  const out: Record<string, Asset> = {};
  for (const [key, item] of Object.entries(items)) {
    out[key] = {
      ...item,
      priceSource: scraped.has(key)
        ? "scrape"
        : livePrice.has(key)
          ? "live"
          : cached.has(key)
            ? "cached"
            : item.priceSource === "scrape"
              ? "scrape"
              : item.priceSource === "live"
                ? "live"
                : item.priceSource === "cached"
                  ? "cached"
                  : "unavailable",
      historySource: scraped.has(key) || item.historySource === "scrape"
        ? "scrape"
        : liveHistory.has(key)
          ? "live"
          : item.historySource === "live"
            ? "live"
            : "unavailable",
    };
  }
  return out;
}

export function buildFeedStats(
  items: Record<string, Asset>,
  source: MarketFeedStats["source"],
  message: string,
  opts: {
    alphaVantageKeyConfigured: boolean;
    forceOfflineFallback: boolean;
  }
): MarketFeedStats {
  const liveSymbols: string[] = [];
  const staleSymbols: string[] = [];
  let liveHistoryCount = 0;

  for (const [key, item] of Object.entries(items)) {
    const a = item as Asset & { priceSource?: FeedSource; historySource?: FeedSource };
    if (
      a.priceSource === "live" ||
      a.priceSource === "cached" ||
      a.priceSource === "scrape"
    ) {
      liveSymbols.push(key);
    } else {
      staleSymbols.push(key);
    }
    if (a.historySource === "live") liveHistoryCount++;
  }

  return {
    source,
    message,
    alphaVantageKeyConfigured: opts.alphaVantageKeyConfigured,
    forceOfflineFallback: opts.forceOfflineFallback,
    livePriceCount: liveSymbols.length,
    stalePriceCount: staleSymbols.length,
    simulatedPriceCount: staleSymbols.length,
    liveHistoryCount,
    liveSymbols,
    staleSymbols,
    simulatedSymbols: staleSymbols,
    fetchedAt: new Date().toISOString(),
  };
}

export function applyGlobalQuoteToItem(
  item: Asset,
  quote: Record<string, string>
): Asset {
  const rawPrice = parseFloat(quote["05. price"]);
  const rawChange = parseFloat(quote["09. change"]);
  const rawChangePct = quote["10. change percent"];
  if (isNaN(rawPrice)) return item;

  return {
    ...item,
    current: rawPrice,
    open: parseFloat(quote["02. open"]) || item.open,
    high: parseFloat(quote["03. high"]) || item.high,
    low: parseFloat(quote["04. low"]) || item.low,
    volume: parseInt(quote["06. volume"], 10) || item.volume,
    change: isNaN(rawChange) ? item.change : rawChange,
    changePercent: rawChangePct || item.changePercent,
    priceSource: "live",
  };
}

export function applyCommoditySeriesToItem(
  item: Asset,
  dataPoints: { date: string; value: number }[]
): Asset | null {
  if (dataPoints.length === 0) return null;
  const latestVal = dataPoints[dataPoints.length - 1].value;
  const prevVal = dataPoints[dataPoints.length - 2]?.value ?? latestVal;
  const delta = latestVal - prevVal;
  const deltaPct = prevVal !== 0 ? ((delta / prevVal) * 100).toFixed(2) : "0.00";

  return {
    ...item,
    current: latestVal,
    change: parseFloat(delta.toFixed(2)),
    changePercent: `${delta >= 0 ? "+" : ""}${deltaPct}%`,
    history: dataPoints,
    priceSource: "live",
    historySource: "live",
  };
}

/** Standard tickers we can refresh via GLOBAL_QUOTE (rotated per request on free tier). */
export const ROTATING_EQUITY_KEYS = [
  "COPPER",
  "BP",
  "SHEL",
  "NVDA",
  "GOOGL",
  "META",
  "TSLA",
  "DIS",
  "HAS",
  "AMD",
  "AAPL",
  "MSFT",
  "AMZN",
  "JPM",
  "SONY",
  "X",
] as const;

export function isFetchableEquityTicker(symbol: string): boolean {
  return /^[A-Z]{1,5}$/.test(symbol) && !symbol.includes("-");
}

/** Keys rotated when ?focus= is empty — keeps Yahoo scrape useful without burning time. */
export const DEFAULT_SCRAPE_EQUITY_KEYS = [
  "TSLA",
  "NVDA",
  "BTC",
  "ETH",
  "OIL",
  "BRENT",
  "COPPER",
  "CVX",
  "XOM",
  "MSFT",
] as const;

let scrapeEquityRotation = 0;

export function buildScrapeEquityKeys(
  items: Record<string, Asset>,
  focusKeys: string[],
  max: number,
  isScrapeable: (assetKey: string, symbol: string) => boolean
): string[] {
  const keys: string[] = [];
  const metalKeys = new Set(["GOLD", "SILVER", "XAU", "XAG", "XPT", "XPD"]);

  const tryAdd = (key: string) => {
    if (keys.length >= max || keys.includes(key) || metalKeys.has(key)) return;
    const asset = items[key];
    if (!asset || !isScrapeable(key, asset.symbol)) return;
    keys.push(key);
  };

  for (const key of focusKeys) tryAdd(key);

  const pool = DEFAULT_SCRAPE_EQUITY_KEYS;
  let scanned = 0;
  while (keys.length < max && scanned < pool.length * 2) {
    const key = pool[(scrapeEquityRotation + scanned) % pool.length];
    tryAdd(key);
    scanned++;
  }
  scrapeEquityRotation = (scrapeEquityRotation + 1) % pool.length;

  return keys;
}

export function buildScrapeGoogleFinanceKeys(
  items: Record<string, Asset>,
  focusKeys: string[],
  max: number,
  alreadyScraped: Set<string>,
  resolveId: (assetKey: string, asset: Asset) => string | null
): string[] {
  const keys: string[] = [];
  const metalKeys = new Set(["GOLD", "SILVER", "XAU", "XAG", "XPT", "XPD"]);

  const tryAdd = (key: string) => {
    if (keys.length >= max || keys.includes(key) || alreadyScraped.has(key)) return;
    if (metalKeys.has(key)) return;
    const asset = items[key];
    if (!asset || !resolveId(key, asset)) return;
    keys.push(key);
  };

  for (const key of focusKeys) tryAdd(key);
  for (const key of Object.keys(items)) {
    if (keys.length >= max) break;
    tryAdd(key);
  }
  return keys;
}

const COMMODITY_CACHE_MAP: Record<string, string> = {
  COPPER: "commodities_COPPER",
  OIL: "commodities_WTI",
  BRENT: "commodities_BRENT",
  GOLD: "commodities_GOLD",
  SILVER: "commodities_SILVER",
};

/** Resolve dashboard keys from ?focus= query (keys or ticker symbols). */
export function parseFocusAssetKeys(
  items: Record<string, Asset>,
  focusParam: string | string[] | undefined,
  max = 6
): string[] {
  if (!focusParam) return [];
  const raw = Array.isArray(focusParam) ? focusParam.join(",") : focusParam;
  const tokens = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const keys: string[] = [];
  for (const token of tokens) {
    if (items[token] && !keys.includes(token)) {
      keys.push(token);
      continue;
    }
    const bySym = Object.entries(items).find(
      ([, a]) => a.symbol.toUpperCase() === token
    );
    if (bySym && !keys.includes(bySym[0])) keys.push(bySym[0]);
    if (keys.length >= max) break;
  }
  return keys.slice(0, max);
}

export function hydrateItemsFromQuoteCache(
  items: Record<string, Asset>,
  apiCache: Record<string, { timestamp: number; data: unknown }>,
  cacheTtlMs: number,
  livePrice: Set<string>,
  cachedPrice: Set<string>,
  now = Date.now()
): number {
  let applied = 0;
  for (const [key, item] of Object.entries(items)) {
    if (!isFetchableEquityTicker(item.symbol)) continue;
    const cacheKey = `quote_${item.symbol}`;
    const cached = apiCache[cacheKey];
    if (!cached || now - cached.timestamp >= cacheTtlMs) continue;
    const payload = cached.data as { ["Global Quote"]?: Record<string, string> };
    const quote = payload?.["Global Quote"];
    if (!quote) continue;
    items[key] = applyGlobalQuoteToItem(item, quote);
    cachedPrice.add(key);
    applied++;
  }
  return applied;
}

export function hydrateItemsFromCommodityCache(
  items: Record<string, Asset>,
  apiCache: Record<string, { timestamp: number; data: unknown }>,
  cacheTtlMs: number,
  livePrice: Set<string>,
  cachedPrice: Set<string>,
  liveHistory: Set<string>,
  now = Date.now()
): number {
  let applied = 0;
  for (const [key, cacheKey] of Object.entries(COMMODITY_CACHE_MAP)) {
    if (!items[key]) continue;
    const cached = apiCache[cacheKey];
    if (!cached || now - cached.timestamp >= cacheTtlMs) continue;
    const data = cached.data as { data?: { date: string; value: string }[] };
    if (!data?.data) continue;
    const series = data.data
      .map((dp) => ({ date: dp.date, value: parseFloat(dp.value) }))
      .filter((dp) => !isNaN(dp.value))
      .reverse()
      .slice(-30);
    if (series.length === 0) continue;
    const updated = applyCommoditySeriesToItem(items[key], series);
    if (!updated) continue;
    items[key] = updated;
    cachedPrice.add(key);
    liveHistory.add(key);
    applied++;
  }
  return applied;
}

export function parseDailySeriesFromAv(data: unknown): { date: string; value: number }[] | null {
  const series = (data as Record<string, Record<string, Record<string, string>>>)[
    "Time Series (Daily)"
  ];
  if (!series) return null;
  const points = Object.entries(series)
    .map(([date, row]) => ({
      date,
      value: parseFloat(row["4. close"]),
    }))
    .filter((p) => !isNaN(p.value))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);
  return points.length > 0 ? points : null;
}
