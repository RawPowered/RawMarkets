import type { CachedData } from "./db";
import { setApiCacheEntry } from "./db";
import type { Asset, SymbolSearchHit, SymbolSearchSource } from "../types";
import { searchGoogleFinance } from "./scrapers/googleFinanceSearch";
import { isCryptoSymbol, buildGoogleFinanceId } from "./scrapers/types";

function coinbaseSearchHits(q: string): SymbolSearchHit[] {
  const sym = q.toUpperCase().trim();
  if (!sym || !isCryptoSymbol(sym, sym)) return [];
  return [
    {
      symbol: sym,
      name: `${sym} / USD`,
      market: "Coinbase",
      type: "Crypto",
      currency: "USD",
      defaultPrice: 100,
      category: "MARKETS",
      desc: "Live spot via Coinbase Exchange API",
      source: "coinbase",
    },
  ];
}

const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;
const YAHOO_SEARCH =
  "https://query1.finance.yahoo.com/v1/finance/search";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type Category = SymbolSearchHit["category"];

export interface SymbolSearchOptions {
  q: string;
  mode?: "symbol" | "name" | "keyword";
  category?: string;
}

export interface SymbolSearchResult {
  matches: SymbolSearchHit[];
  sources: SymbolSearchSource[];
  cached: boolean;
  note?: string;
}

export interface SymbolSearchDeps {
  getSimulatedItems: () => Record<string, Asset>;
  fetchAlphaVantage?: (
    url: string,
    cacheKey: string,
    fresh?: boolean
  ) => Promise<{
    data?: { bestMatches?: Record<string, string>[] };
    error?: boolean;
    fromCache?: boolean;
  }>;
  getApiKey: (id: string) => string | undefined;
  apiCache?: Record<string, CachedData>;
  saveCache?: () => void;
  usePlaywrightScrapers?: boolean;
}

function categorize(
  sym: string,
  name: string,
  typeHint?: string
): Category {
  const text = `${sym} ${name} ${typeHint ?? ""}`.toLowerCase();
  if (
    text.includes("gold") ||
    text.includes("silver") ||
    text.includes("metal") ||
    text.includes("copper")
  ) {
    return "METALS";
  }
  if (
    text.includes("oil") ||
    text.includes("gas") ||
    text.includes("energy")
  ) {
    return "ENERGY";
  }
  if (
    text.includes("bank") ||
    text.includes("finance") ||
    ["JPM", "GS", "MS", "BAC", "C", "WFC"].includes(sym.toUpperCase())
  ) {
    return "FINANCE";
  }
  if (
    text.includes("tech") ||
    text.includes("software") ||
    text.includes("semiconductor") ||
    ["AAPL", "MSFT", "GOOG", "GOOGL", "AMZN", "META", "NVDA", "TSLA"].includes(
      sym.toUpperCase()
    )
  ) {
    return "TECH";
  }
  return "MARKETS";
}

function defaultPrice(sym: string): number {
  return parseFloat(
    (10 + Math.abs(Math.sin(sym.charCodeAt(0) || 1)) * 80).toFixed(2)
  );
}

function buildLocalPool(
  getSimulatedItems: () => Record<string, Asset>
): SymbolSearchHit[] {
  const items = getSimulatedItems();
  return Object.entries(items).map(([key, val]) => ({
    symbol: key,
    name: val.name,
    market:
      val.category === "METALS" || val.category === "ENERGY"
        ? "Commodities"
        : "US Exchange",
    type: "Asset Index",
    currency: "USD",
    defaultPrice: val.current,
    category: val.category,
    desc: val.desc,
    source: "local" as const,
    inCatalog: true,
  }));
}

async function searchYahoo(q: string): Promise<SymbolSearchHit[]> {
  const url = `${YAHOO_SEARCH}?q=${encodeURIComponent(q)}&quotesCount=12&newsCount=0`;
  const resp = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!resp.ok) return [];
  const data = (await resp.json()) as {
    quotes?: Array<{
      symbol?: string;
      shortname?: string;
      longname?: string;
      quoteType?: string;
      exchange?: string;
      exchDisp?: string;
    }>;
  };
  const quotes = data.quotes ?? [];
  return quotes
    .filter((row) => row.symbol && row.quoteType !== "OPTION")
    .slice(0, 12)
    .map((row) => {
      const sym = String(row.symbol).toUpperCase();
      const name = row.longname || row.shortname || sym;
      return {
        symbol: sym,
        name,
        market: row.exchDisp || row.exchange || "US",
        type: row.quoteType || "Equity",
        currency: "USD",
        defaultPrice: defaultPrice(sym),
        category: categorize(sym, name, row.quoteType),
        desc: `Yahoo Finance — ${row.quoteType ?? "quote"} on ${row.exchange ?? row.exchDisp ?? "market"}`,
        source: "yahoo" as const,
        exchange: row.exchange,
        yahooSymbol: sym,
        googleFinanceId: buildGoogleFinanceId(sym, row.exchange) ?? undefined,
      };
    });
}

async function searchAlphaVantage(
  q: string,
  deps: SymbolSearchDeps
): Promise<SymbolSearchHit[]> {
  const apiKey = deps.getApiKey("alpha_vantage");
  if (!apiKey?.trim() || !deps.fetchAlphaVantage) return [];

  try {
    const searchUrl = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(q)}&apikey=${apiKey}`;
    const searchRes = await deps.fetchAlphaVantage(
      searchUrl,
      `raw_search_${q}`,
      true
    );
    if (!searchRes.data?.bestMatches) return [];

    return searchRes.data.bestMatches.map((m) => {
      const sym = m["1. symbol"] ?? "";
      const nm = m["2. name"] ?? sym;
      const tp = m["3. type"] || "Equity";
      const cur = m["8. currency"] || "USD";
      const rgn = m["4. region"] || "US";
      return {
        symbol: sym,
        name: nm,
        market: rgn,
        type: tp,
        currency: cur,
        defaultPrice: defaultPrice(sym),
        category: categorize(sym, nm, tp),
        desc: `Alpha Vantage — ${tp} (${rgn})`,
        source: "alpha_vantage" as const,
        googleFinanceId: buildGoogleFinanceId(sym, rgn) ?? undefined,
      };
    });
  } catch {
    return [];
  }
}

function filterLocal(
  pool: SymbolSearchHit[],
  q: string,
  mode: string,
  category: string
): SymbolSearchHit[] {
  const cleanQ = q.toLowerCase();
  const isCategoryAll = category === "ALL";

  return pool.filter((item) => {
    if (!isCategoryAll && item.category !== category) return false;
    if (mode === "symbol") {
      return item.symbol.toLowerCase().includes(cleanQ);
    }
    if (mode === "name") {
      return item.name.toLowerCase().includes(cleanQ);
    }
    return (
      item.symbol.toLowerCase().includes(cleanQ) ||
      item.name.toLowerCase().includes(cleanQ) ||
      (item.desc?.toLowerCase().includes(cleanQ) ?? false)
    );
  });
}

function mergeHits(
  lists: SymbolSearchHit[][],
  catalogKeys: Set<string>
): SymbolSearchHit[] {
  const bySymbol = new Map<string, SymbolSearchHit>();
  const order: SymbolSearchSource[] = [
    "coinbase",
    "yahoo",
    "google_finance",
    "alpha_vantage",
    "local",
  ];

  for (const list of lists) {
    for (const hit of list) {
      const sym = hit.symbol.toUpperCase();
      if (!sym) continue;
      const existing = bySymbol.get(sym);
      if (!existing) {
        bySymbol.set(sym, {
          ...hit,
          symbol: sym,
          inCatalog: catalogKeys.has(sym),
        });
        continue;
      }
      const existingRank = order.indexOf(existing.source);
      const hitRank = order.indexOf(hit.source);
      if (hitRank < existingRank) {
        bySymbol.set(sym, {
          ...existing,
          ...hit,
          symbol: sym,
          googleFinanceId: hit.googleFinanceId ?? existing.googleFinanceId,
          yahooSymbol: hit.yahooSymbol ?? existing.yahooSymbol,
          inCatalog: catalogKeys.has(sym),
        });
      } else {
        bySymbol.set(sym, {
          ...hit,
          ...existing,
          symbol: sym,
          googleFinanceId: existing.googleFinanceId ?? hit.googleFinanceId,
          yahooSymbol: existing.yahooSymbol ?? hit.yahooSymbol,
          inCatalog: catalogKeys.has(sym),
        });
      }
    }
  }

  return [...bySymbol.values()];
}

export async function searchSymbols(
  options: SymbolSearchOptions,
  deps: SymbolSearchDeps
): Promise<SymbolSearchResult> {
  const q = options.q.trim();
  const mode = options.mode ?? "keyword";
  const category = (options.category ?? "ALL").toUpperCase();

  if (!q) {
    return { matches: [], sources: [], cached: false };
  }

  const cacheKey = `search_symbol_${q}_${mode}_${category}`;
  if (deps.apiCache) {
    const cached = deps.apiCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL_MS) {
      const payload = cached.data as SymbolSearchResult;
      if (payload?.matches) {
        return { ...payload, cached: true };
      }
    }
  }

  const sources: SymbolSearchSource[] = [];
  const localPool = buildLocalPool(deps.getSimulatedItems);
  const catalogKeys = new Set(localPool.map((h) => h.symbol));

  const yahooHits = await searchYahoo(q);
  if (yahooHits.length) sources.push("yahoo");

  let googleHits: SymbolSearchHit[] = [];
  if (deps.usePlaywrightScrapers !== false) {
    try {
      googleHits = (await searchGoogleFinance(q)).filter(
        (h) => !isCryptoSymbol(h.symbol, h.symbol)
      );
      if (googleHits.length) sources.push("google_finance");
    } catch {
      /* optional */
    }
  }

  const coinbaseHits = coinbaseSearchHits(q);
  if (coinbaseHits.length) sources.push("coinbase");

  const avHits = await searchAlphaVantage(q, deps);
  if (avHits.length) sources.push("alpha_vantage");

  const localFiltered = filterLocal(localPool, q, mode, category);
  if (localFiltered.length) sources.push("local");

  let merged = mergeHits(
    [coinbaseHits, yahooHits, googleHits, avHits, localFiltered],
    catalogKeys
  );

  if (category !== "ALL") {
    merged = merged.filter((m) => m.category === category);
  }

  if (mode === "symbol") {
    merged.sort((a, b) => {
      const aExact = a.symbol === q.toUpperCase() ? 0 : 1;
      const bExact = b.symbol === q.toUpperCase() ? 0 : 1;
      return aExact - bExact;
    });
  }

  merged = merged.slice(0, 20);

  const result: SymbolSearchResult = {
    matches: merged,
    sources: [...new Set(sources)],
    cached: false,
    note:
      sources.length === 0
        ? "No live providers returned results; try a different query."
        : undefined,
  };

  if (deps.apiCache && deps.saveCache) {
    deps.apiCache[cacheKey] = {
      timestamp: Date.now(),
      data: result,
    };
    setApiCacheEntry(cacheKey, deps.apiCache[cacheKey]);
    deps.saveCache();
  }

  return result;
}
