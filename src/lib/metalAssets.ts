import type { Asset, SpecialMetalRate } from "../types";
import { historyAlignedToScrapePrice } from "./scrapeHistory";

const ISO_TO_ASSET: [string, string][] = [
  ["XAU", "GOLD"],
  ["XAG", "SILVER"],
];

export function patchAssetsFromMetalRates(
  assets: Record<string, Asset>,
  rates: Record<string, SpecialMetalRate>,
  fromLive: boolean
): Record<string, Asset> {
  if (!fromLive) return assets;
  const next = { ...assets };
  for (const [iso, key] of ISO_TO_ASSET) {
    const r = rates[iso];
    const item = next[key];
    if (!r || !item) continue;
    const hasHistory = (item.history?.length ?? 0) >= 2;
    const history = hasHistory
      ? historyAlignedToScrapePrice(item.history, item.current, r.price)
      : item.history ?? [];
    const values = history.length > 0 ? history.map((p) => p.value) : [r.price];
    next[key] = {
      ...item,
      current: r.price,
      open: history[0]?.value ?? r.price,
      high: Math.max(...values, r.price),
      low: Math.min(...values, r.price),
      change: r.change,
      changePercent: r.changePercent,
      history,
      priceSource: "scrape",
      historySource: hasHistory ? "scrape" : item.historySource,
      feedNote: undefined,
    };
  }
  return next;
}

export function isMetalDashboardKey(key: string): boolean {
  return key === "GOLD" || key === "SILVER";
}
