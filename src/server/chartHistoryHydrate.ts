import type { CachedData } from "./db";
import type { Asset } from "../types";
import { historyAlignedToScrapePrice } from "../lib/scrapeHistory";
import { fetchYahooChart } from "./yahooChart";
import { isYahooScrapeable, resolveYahooSymbol } from "./scrapers/types";

const MIN_CHART_POINTS = 2;

export function needsChartHistoryHydration(item: Asset): boolean {
  return (
    Number.isFinite(item.current) &&
    item.current > 0 &&
    (item.history?.length ?? 0) < MIN_CHART_POINTS
  );
}

export async function hydrateAssetChartHistory(
  assetKey: string,
  item: Asset,
  opts?: {
    apiCache?: Record<string, CachedData>;
    persistCache?: () => void;
    fresh?: boolean;
  }
): Promise<Asset> {
  if (!needsChartHistoryHydration(item)) return item;
  if (!isYahooScrapeable(assetKey, item.symbol)) return item;

  const yahooSym = resolveYahooSymbol(assetKey, item.symbol);
  const chart = await fetchYahooChart(yahooSym, "1mo", {
    fresh: opts?.fresh ?? false,
    apiCache: opts?.apiCache,
    persistCache: opts?.persistCache,
  });

  if (!chart.history || chart.history.length < MIN_CHART_POINTS) {
    return item;
  }

  const base = chart.history.slice(-31);
  const anchor = base[base.length - 1]?.value ?? item.current;
  const history = historyAlignedToScrapePrice(base, anchor, item.current);
  if (history.length < MIN_CHART_POINTS) return item;

  const values = history.map((p) => p.value);
  return {
    ...item,
    history,
    open: history[0]?.value ?? item.current,
    high: Math.max(...values, item.current),
    low: Math.min(...values, item.current),
    historySource: "scrape",
  };
}

export async function hydrateItemsChartHistory(
  items: Record<string, Asset>,
  opts?: {
    apiCache?: Record<string, CachedData>;
    persistCache?: () => void;
    fresh?: boolean;
    keys?: string[];
  }
): Promise<Record<string, Asset>> {
  const out = { ...items };
  const targetKeys =
    opts?.keys ??
    Object.keys(out).filter((k) => needsChartHistoryHydration(out[k]!));

  await Promise.all(
    targetKeys.map(async (key) => {
      const item = out[key];
      if (!item) return;
      out[key] = await hydrateAssetChartHistory(key, item, opts);
    })
  );

  return out;
}
