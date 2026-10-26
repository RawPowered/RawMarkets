import { getDb, setApiCacheEntry, loadApiCache } from "./db";
import {
  SYMBOL_DOMAIN_MAP,
  guessDomainFromSymbol,
  googleFaviconUrl,
} from "../lib/symbolDomains";

const CACHE_PREFIX = "logo_domain_";

export interface SymbolLogoInfo {
  symbol: string;
  domain: string | null;
  logoUrl: string | null;
  source: "map" | "cache" | "guess" | "none";
}

function cacheKey(symbol: string): string {
  return `${CACHE_PREFIX}${symbol.trim().toUpperCase()}`;
}

export function getCachedLogoDomain(symbol: string): string | null {
  const key = cacheKey(symbol);
  const row = getDb()
    .prepare("SELECT payload FROM api_cache WHERE cache_key = ?")
    .get(key) as { payload: string } | undefined;
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.payload) as { domain?: string };
    return parsed.domain?.trim() || null;
  } catch {
    return null;
  }
}

export function setCachedLogoDomain(symbol: string, domain: string): void {
  const sym = symbol.trim().toUpperCase();
  setApiCacheEntry(cacheKey(sym), {
    timestamp: Date.now(),
    data: { domain },
  });
}

export function resolveSymbolLogo(symbol: string): SymbolLogoInfo {
  const sym = symbol.trim().toUpperCase();
  if (!sym) {
    return { symbol: sym, domain: null, logoUrl: null, source: "none" };
  }

  if (SYMBOL_DOMAIN_MAP[sym]) {
    const domain = SYMBOL_DOMAIN_MAP[sym];
    return {
      symbol: sym,
      domain,
      logoUrl: googleFaviconUrl(domain, 128),
      source: "map",
    };
  }

  const cached = getCachedLogoDomain(sym);
  if (cached) {
    return {
      symbol: sym,
      domain: cached,
      logoUrl: googleFaviconUrl(cached, 128),
      source: "cache",
    };
  }

  const guessed = guessDomainFromSymbol(sym);
  if (guessed) {
    setCachedLogoDomain(sym, guessed);
    return {
      symbol: sym,
      domain: guessed,
      logoUrl: googleFaviconUrl(guessed, 128),
      source: "guess",
    };
  }

  return { symbol: sym, domain: null, logoUrl: null, source: "none" };
}

/** Warm cache from existing api_cache rows on startup (optional). */
export function countLogoCacheEntries(): number {
  const cache = loadApiCache();
  return Object.keys(cache).filter((k) => k.startsWith(CACHE_PREFIX)).length;
}
