import type { CachedData } from "../db";
import type { ScrapeResult } from "./types";

export const SCRAPE_TTL_MS = 10 * 60 * 1000;

export function scrapeCacheKey(provider: string, symbol: string): string {
  return `scrape_${provider}_${symbol}`;
}

export function readScrapeCache(
  apiCache: Record<string, CachedData>,
  cacheKey: string,
  fresh: boolean
): ScrapeResult | null {
  if (fresh) return null;
  const entry = apiCache[cacheKey];
  if (!entry || Date.now() - entry.timestamp >= SCRAPE_TTL_MS) return null;
  const data = entry.data as ScrapeResult;
  return data?.ok ? data : null;
}

export function writeScrapeCache(
  apiCache: Record<string, CachedData>,
  cacheKey: string,
  result: ScrapeResult,
  persist: () => void
): void {
  if (!result.ok || result.price == null) return;
  apiCache[cacheKey] = {
    timestamp: Date.now(),
    data: { ...result, scrapedAt: Date.now() },
  };
  persist();
}
