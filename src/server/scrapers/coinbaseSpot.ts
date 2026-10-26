import type { CachedData } from "../db";
import {
  readScrapeCache,
  scrapeCacheKey,
  writeScrapeCache,
} from "./scrapeCache";
import { recordInstantScrapeActivity } from "./scrapeQueue";
import type { ScrapeResult } from "./types";
import {
  CRYPTO_BASE_SYMBOLS,
  isCryptoSymbol,
} from "./types";

export { CRYPTO_BASE_SYMBOLS, isCryptoSymbol };

export function resolveCoinbaseProductId(
  assetKey: string,
  symbol: string
): string | null {
  const sym = symbol.toUpperCase().trim();
  const key = assetKey.toUpperCase().trim();
  if (sym.includes("-USD")) return sym;
  const base = CRYPTO_BASE_SYMBOLS.has(sym)
    ? sym
    : CRYPTO_BASE_SYMBOLS.has(key)
      ? key
      : null;
  if (!base) return null;
  return `${base}-USD`;
}

export function coinbaseProductUrl(productId: string): string {
  const base = productId.toUpperCase().replace(/-USD$/, "").toLowerCase();
  return `https://www.coinbase.com/price/${base}`;
}

type CoinbaseTicker = {
  price?: string;
  open_24h?: string;
};

export async function fetchCoinbaseTicker(
  productId: string
): Promise<ScrapeResult> {
  const pair = productId.toUpperCase();
  const apiUrl = `https://api.exchange.coinbase.com/products/${encodeURIComponent(pair)}/ticker`;
  const sourceUrl = coinbaseProductUrl(pair);

  try {
    const resp = await fetch(apiUrl, {
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) {
      return {
        ok: false,
        sourceUrl,
        provider: "Coinbase",
        error: `HTTP ${resp.status}`,
      };
    }
    const data = (await resp.json()) as CoinbaseTicker;
    const price = data.price ? parseFloat(data.price) : NaN;
    if (!Number.isFinite(price) || price <= 0) {
      return {
        ok: false,
        sourceUrl,
        provider: "Coinbase",
        error: "Invalid price from Coinbase ticker",
      };
    }

    let changePercent: string | undefined;
    let change: number | undefined;
    const open = data.open_24h ? parseFloat(data.open_24h) : NaN;
    if (Number.isFinite(open) && open > 0) {
      const pct = ((price - open) / open) * 100;
      change = price - open;
      changePercent = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
    }

    return {
      ok: true,
      price,
      change,
      changePercent,
      sourceUrl,
      provider: "Coinbase",
      scrapedAt: Date.now(),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      sourceUrl,
      provider: "Coinbase",
      error: msg,
    };
  }
}

export async function scrapeCoinbaseQuote(
  apiCache: Record<string, CachedData>,
  assetKey: string,
  symbol: string,
  fresh: boolean,
  persist: () => void
): Promise<ScrapeResult> {
  const productId = resolveCoinbaseProductId(assetKey, symbol);
  if (!productId) {
    return {
      ok: false,
      sourceUrl: "",
      provider: "Coinbase",
      error: "Not a supported Coinbase spot pair.",
    };
  }

  const cacheKey = scrapeCacheKey("coinbase", productId);
  const cached = readScrapeCache(apiCache, cacheKey, fresh);
  if (cached) return cached;

  if (!fresh) {
    return {
      ok: false,
      sourceUrl: "",
      provider: "Coinbase",
      error:
        "No cached Coinbase quote — use Refresh Spot Feed for a live price.",
    };
  }

  const started = Date.now();
  const result = await fetchCoinbaseTicker(productId);
  recordInstantScrapeActivity({
    provider: "Coinbase",
    symbol: productId,
    url: coinbaseProductUrl(productId),
    ok: result.ok,
    price: result.price,
    error: result.error,
    elapsedMs: Date.now() - started,
  });
  writeScrapeCache(apiCache, cacheKey, result, persist);
  return result;
}
