import type { CachedData } from "./db";
import { loadCustomAssets } from "./db";
import {
  emptyMetalSpotRates,
  isPlausibleMetalSpotCache,
  type MetalSpotRate,
} from "./metalSpot";
import {
  scrapeKitcoMetals,
  scrapeResultToMetalRate,
  KITCO_METAL_PAGES,
} from "./scrapers/kitcoMetals";
import type { MetalScrapeBundle } from "./scrapers/types";
import { recordInstantScrapeActivity } from "./scrapers/scrapeQueue";
import { fetchYahooChart } from "./yahooChart";

const KITCO_CACHE_KEY = "scrape_kitco_bundle_v2";
const YAHOO_METAL_CACHE_KEY = "yahoo_metal_spot_v2";
/** Show stale metal cache up to 24h instead of simulation. */
export const METAL_STALE_CACHE_MS = 24 * 60 * 60 * 1000;
const KITCO_FRESH_CACHE_MS = 10 * 60 * 1000;

export const DEFAULT_REFRESH_METAL_ISOS = ["XAU", "XAG"] as const;
export const ALL_METAL_ISOS = ["XAU", "XAG", "XPT", "XPD"] as const;

/** Spot FX first (matches chart terminals); futures as fallback. */
const YAHOO_METAL_SYMBOLS: Record<string, { symbols: string[]; name: string }> =
  {
    XAU: { symbols: ["XAUUSD=X", "GC=F"], name: "Gold Spot" },
    XAG: { symbols: ["XAGUSD=X", "SI=F"], name: "Silver Spot" },
    XPT: { symbols: ["XPTUSD=X", "PL=F"], name: "Platinum Spot" },
    XPD: { symbols: ["XPDUSD=X", "PA=F"], name: "Palladium Spot" },
  };

function chartToMetalRate(iso: string, price: number): MetalSpotRate {
  const meta = YAHOO_METAL_SYMBOLS[iso] ?? KITCO_METAL_PAGES[iso];
  return {
    name: meta?.name ?? `${iso} Spot`,
    symbol: iso,
    price: parseFloat(price.toFixed(2)),
    rate: parseFloat((1 / price).toFixed(8)),
    change: 0,
    changePercent: "0.00%",
    unit: "oz",
  };
}

async function fetchMetalsFromYahooFutures(
  isos: readonly string[],
  apiCache: Record<string, CachedData>,
  persist: () => void,
  fresh = true
): Promise<Record<string, MetalSpotRate> | null> {
  const started = Date.now();
  const rates: Record<string, MetalSpotRate> = {};

  await Promise.all(
    isos.map(async (iso) => {
      const map = YAHOO_METAL_SYMBOLS[iso];
      if (!map) return;
      for (const yahooSym of map.symbols) {
        const chart = await fetchYahooChart(yahooSym, "1d", {
          fresh,
          apiCache,
          persistCache: persist,
        });
        if (!chart.ok || chart.price == null || chart.price <= 0) continue;
        rates[iso] = chartToMetalRate(iso, chart.price);
        recordInstantScrapeActivity({
          provider: "Yahoo Chart API",
          symbol: `${iso} (${yahooSym})`,
          url: `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}`,
          ok: true,
          price: chart.price,
          elapsedMs: Date.now() - started,
        });
        break;
      }
    })
  );

  if (Object.keys(rates).length === 0) return null;
  return rates;
}

export type MetalsCaptureOptions = {
  apiCache: Record<string, CachedData>;
  fresh: boolean;
  persist: () => void;
  metalKey?: string | null;
  metalIsos?: readonly string[];
};

/** Kitco/Yahoo caches only — MetalPriceAPI is not used for displayed gold/silver spot. */
function readStaleBundle(
  apiCache: Record<string, CachedData>
): { rates: Record<string, MetalSpotRate>; source: string; ageMs: number } | null {
  const kitco = apiCache[KITCO_CACHE_KEY];
  if (kitco?.data) {
    const payload = kitco.data as { rates?: Record<string, MetalSpotRate> };
    if (payload.rates && isPlausibleMetalSpotCache(payload.rates)) {
      return {
        rates: payload.rates,
        source: "kitco-scrape-cached",
        ageMs: Date.now() - kitco.timestamp,
      };
    }
  }

  const yahoo = apiCache[YAHOO_METAL_CACHE_KEY];
  if (yahoo?.data) {
    const yRates = yahoo.data as Record<string, MetalSpotRate>;
    if (isPlausibleMetalSpotCache(yRates)) {
      return {
        rates: yRates,
        source: "yahoo-spot-cached",
        ageMs: Date.now() - yahoo.timestamp,
      };
    }
  }

  return null;
}

export function purgeMetalPriceApiCache(
  apiCache: Record<string, CachedData>
): number {
  let n = 0;
  for (const key of Object.keys(apiCache)) {
    if (key.startsWith("metalprice_rates")) {
      delete apiCache[key];
      n++;
    }
  }
  return n;
}

function formatCachedAt(ageMs: number): string {
  const mins = Math.round(ageMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs}h ago`;
}

function catalogBaselineMetalRates(): Record<string, MetalSpotRate> {
  const assets = loadCustomAssets() as Record<
    string,
    { name?: string; current?: number; change?: number; changePercent?: string }
  >;
  const rates: Record<string, MetalSpotRate> = {};
  const map: [string, string][] = [
    ["XAU", "GOLD"],
    ["XAG", "SILVER"],
  ];
  for (const [iso, key] of map) {
    const a = assets[key];
    if (!a?.current || a.current <= 0) continue;
    rates[iso] = {
      name: a.name ?? `${iso} Spot`,
      symbol: iso,
      price: parseFloat(a.current.toFixed(2)),
      rate: parseFloat((1 / a.current).toFixed(8)),
      change: a.change ?? 0,
      changePercent: a.changePercent ?? "0.00%",
      unit: "oz",
    };
  }
  return rates;
}

function ensureAllMetalIsos(
  rates: Record<string, MetalSpotRate>,
  isos: readonly string[]
): Record<string, MetalSpotRate> {
  const out = { ...rates };
  for (const iso of isos) {
    if (out[iso]) continue;
    const meta = YAHOO_METAL_SYMBOLS[iso] ?? KITCO_METAL_PAGES[iso];
    out[iso] = {
      name: meta?.name ?? `${iso} Spot`,
      symbol: iso,
      price: 0,
      rate: 0,
      change: 0,
      changePercent: "0.00%",
      unit: "oz",
    };
  }
  return out;
}

function mergeMetalRates(
  ...layers: Array<Record<string, MetalSpotRate> | null | undefined>
): Record<string, MetalSpotRate> {
  const out: Record<string, MetalSpotRate> = {};
  for (const layer of layers) {
    if (!layer) continue;
    for (const [iso, rate] of Object.entries(layer)) {
      if (rate.price > 0) out[iso] = rate;
    }
  }
  return out;
}

export async function resolveMetalsCapture(
  opts: MetalsCaptureOptions
): Promise<MetalScrapeBundle> {
  const { apiCache, fresh, persist } = opts;
  if (fresh) purgeMetalPriceApiCache(apiCache);
  const metalIso = opts.metalKey?.toUpperCase();
  const isos =
    metalIso && KITCO_METAL_PAGES[metalIso]
      ? ([metalIso] as readonly string[])
      : (opts.metalIsos ?? DEFAULT_REFRESH_METAL_ISOS);

  if (!fresh) {
    const cached = apiCache[KITCO_CACHE_KEY];
    if (cached && Date.now() - cached.timestamp < KITCO_FRESH_CACHE_MS) {
      const payload = cached.data as {
        rates: Record<string, MetalSpotRate>;
        errors?: string[];
      };
      if (payload?.rates && Object.keys(payload.rates).length > 0) {
        return {
          rates: payload.rates,
          source: "kitco-scrape-cached",
          fromLive: true,
          message:
            "Cached Kitco metals (<10m) — use Refresh Spot Feed for a live pull.",
        };
      }
    }

    const stale = readStaleBundle(apiCache);
    if (stale && stale.ageMs < METAL_STALE_CACHE_MS) {
      return {
        rates: ensureAllMetalIsos(stale.rates, ALL_METAL_ISOS),
        source: stale.source,
        fromLive: false,
        message: `Cached metals (${formatCachedAt(stale.ageMs)}, ${stale.source}) — Refresh Spot Feed for live Kitco/Yahoo.`,
      };
    }

    const yahooRates = await fetchMetalsFromYahooFutures(
      isos,
      apiCache,
      persist,
      false
    );
  const catalog = catalogBaselineMetalRates();
  const merged = mergeMetalRates(catalog, yahooRates);
  if (Object.keys(merged).length > 0) {
    if (yahooRates && Object.keys(yahooRates).length > 0) {
      apiCache[YAHOO_METAL_CACHE_KEY] = {
        timestamp: Date.now(),
        data: yahooRates,
      };
      persist();
    }
    return {
      rates: ensureAllMetalIsos(merged, ALL_METAL_ISOS),
      source: yahooRates ? "yahoo-futures" : "catalog-baseline",
      fromLive: !!yahooRates,
      message: yahooRates
        ? "Yahoo spot — use Refresh Spot Feed for live Kitco bid."
        : "Catalog baseline only — Refresh Spot Feed for live prices.",
    };
  }

    return {
      rates: ensureAllMetalIsos(emptyMetalSpotRates(), ALL_METAL_ISOS),
      source: "unavailable",
      fromLive: false,
      message:
        "No metal cache — click Refresh Spot Feed for live Kitco/Yahoo prices.",
    };
  }

  const yahooStarted = Date.now();
  let yahooRates = await fetchMetalsFromYahooFutures(isos, apiCache, persist, true);
  const yahooOk =
    yahooRates != null &&
    (isPlausibleMetalSpotCache(yahooRates) ||
      (isos.length === 1 && (yahooRates[isos[0]!]?.price ?? 0) > 0));

  try {
    const kitcoIsos = isos;
    const { results, errors } =
      kitcoIsos.length > 0
        ? await scrapeKitcoMetals(kitcoIsos)
        : { results: {}, errors: [] as string[] };
    const rates: Record<string, MetalSpotRate> = { ...(yahooRates ?? {}) };
    let okCount = 0;

    for (const [iso, result] of Object.entries(results)) {
      const rate = scrapeResultToMetalRate(iso, result);
      if (rate) {
        rates[iso] = rate;
        okCount++;
      }
    }

    if (okCount > 0 || Object.keys(rates).length > 0) {
      const existing = apiCache[KITCO_CACHE_KEY]?.data as
        | { rates?: Record<string, MetalSpotRate> }
        | undefined;
      const merged = { ...(existing?.rates ?? {}), ...rates };
      apiCache[KITCO_CACHE_KEY] = {
        timestamp: Date.now(),
        data: { rates: merged, errors },
      };
      persist();
      const partial =
        okCount < isos.length
          ? ` (${okCount}/${isos.length}; ${errors.join("; ")})`
          : "";
      const src =
        okCount > 0 && yahooOk
          ? "yahoo-spot+kitco"
          : okCount > 0
            ? "kitco-scrape"
            : "yahoo-spot";
      return {
        rates: merged,
        source: src,
        fromLive: true,
        message:
          okCount > 0 && yahooOk
            ? `Yahoo spot + Kitco bid (${okCount}/${isos.length} kitco) in ${((Date.now() - yahooStarted) / 1000).toFixed(1)}s.`
            : okCount > 0
              ? `Kitco live scrape${partial}`
              : `Yahoo spot (${isos.join(", ")}) — Kitco unavailable.`,
      };
    }

    const stale = readStaleBundle(apiCache);
    if (stale) {
      return {
        rates: stale.rates,
        source: stale.source,
        fromLive: false,
        message: `Kitco failed — showing cache (${formatCachedAt(stale.ageMs)}). ${errors.join("; ")}`,
      };
    }

    return {
      rates: emptyMetalSpotRates(),
      source: "kitco-scrape-failed",
      fromLive: false,
      message:
        errors.join("; ") ||
        "Kitco scrape failed — run npm run scrape:install or check Playwright in Engine Settings.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const stale = readStaleBundle(apiCache);
    if (stale) {
      return {
        rates: stale.rates,
        source: stale.source,
        fromLive: false,
        message: `Kitco error — cached metals (${formatCachedAt(stale.ageMs)}). ${msg}`,
      };
    }
    return {
      rates: emptyMetalSpotRates(),
      source: "kitco-scrape-failed",
      fromLive: false,
      message: `Kitco scrape error: ${msg}`,
    };
  }
}
