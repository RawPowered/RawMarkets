import type { CachedData } from "./db";
import { getDb } from "./db";

export function purgeNewsBayCacheForSymbol(
  symbol: string,
  apiCache: Record<string, CachedData>
): number {
  const sym = symbol.trim().toUpperCase();
  if (!sym) return 0;
  let removed = 0;
  const needle = sym.toLowerCase();
  for (const key of Object.keys(apiCache)) {
    if (key.startsWith("news_bay_") && key.toLowerCase().includes(needle)) {
      delete apiCache[key];
      removed++;
    }
  }
  return removed;
}

export function purgeNewsBayCacheDb(symbol: string): number {
  const sym = symbol.trim().toUpperCase();
  if (!sym) return 0;
  const r = getDb()
    .prepare("DELETE FROM api_cache WHERE cache_key LIKE ?")
    .run(`news_bay_%${sym}%`);
  return r.changes;
}
