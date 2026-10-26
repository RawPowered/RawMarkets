import type { Asset } from "../types";
import type { CachedData } from "./db";
import { getDb } from "./db";
import { getNewsFeedRefreshedAt } from "./newsArticleStore";
import { parseFocusAssetKeys } from "./liveMarket";
import { isCryptoSymbol } from "./scrapers/types";

const KITCO_CACHE_KEY_STR = "scrape_kitco_bundle_v2";

export function startOfUtcDayMs(now = Date.now()): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function wasCheckedToday(checkedAtMs: number | null | undefined): boolean {
  if (checkedAtMs == null || !Number.isFinite(checkedAtMs)) return false;
  return checkedAtMs >= startOfUtcDayMs();
}

export function wasMarketPriceCheckedToday(assetKey: string): boolean {
  const row = getDb()
    .prepare(
      `SELECT checked_at FROM market_price_history
       WHERE asset_key = ?
       ORDER BY checked_at DESC
       LIMIT 1`
    )
    .get(assetKey.toUpperCase()) as { checked_at: number } | undefined;
  return wasCheckedToday(row?.checked_at);
}

export function wasMetalSpotFreshToday(apiCache: Record<string, CachedData>): boolean {
  const entry = apiCache[KITCO_CACHE_KEY_STR];
  if (!entry) return false;
  const dayStart = startOfUtcDayMs();
  return entry.timestamp >= dayStart;
}

export function wasNewsFeedRefreshedToday(
  feedId: string,
  symbol: string
): boolean {
  const at = getNewsFeedRefreshedAt(feedId, symbol);
  return wasCheckedToday(at);
}

/** Map tickers to catalog keys; crypto may use symbol as key before catalog entry exists. */
export function resolveCatalogKeysForSymbols(
  symbols: string[],
  catalog: Record<string, Asset>
): string[] {
  const keys: string[] = [];
  for (const raw of symbols) {
    const sym = raw.trim().toUpperCase();
    if (!sym) continue;
    if (catalog[sym] && !keys.includes(sym)) {
      keys.push(sym);
      continue;
    }
    const bySym = Object.entries(catalog).find(
      ([, a]) => a.symbol.toUpperCase() === sym
    );
    if (bySym && !keys.includes(bySym[0])) {
      keys.push(bySym[0]);
      continue;
    }
    if (isCryptoSymbol(sym, sym) && !keys.includes(sym)) {
      keys.push(sym);
    }
  }
  return keys;
}

export function resolveCatalogKeyForSymbol(
  symbol: string,
  catalog: Record<string, Asset>
): string {
  const sym = symbol.toUpperCase();
  if (catalog[sym]) return sym;
  const bySym = Object.entries(catalog).find(
    ([, a]) => a.symbol.toUpperCase() === sym
  );
  return bySym ? bySym[0] : sym;
}

export function buildLaunchFocusKeys(
  items: Record<string, Asset>,
  portfolioSymbols: string[],
  extraKeys: string[] = ["GOLD", "SILVER"]
): string[] {
  const fromPortfolio = resolveCatalogKeysForSymbols(portfolioSymbols, items);
  const merged = [...fromPortfolio];
  for (const k of extraKeys) {
    const u = k.toUpperCase();
    if (!merged.includes(u)) merged.push(u);
  }
  const focusParam = merged.join(",");
  return parseFocusAssetKeys(items, focusParam, Math.max(merged.length, 12));
}

export { KITCO_CACHE_KEY_STR as KITCO_BUNDLE_CACHE_KEY };
