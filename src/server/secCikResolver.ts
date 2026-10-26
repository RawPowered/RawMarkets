import type { CachedData } from "./db";
import { getDb } from "./db";

export const SEC_USER_AGENT =
  "RawMarkets/1.0 (news-bay; contact: support@rawmarkets.local)";

const TICKERS_CACHE_KEY = "sec_company_tickers";
const TICKERS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface SecTickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

export function padCik(cik: string | number): string {
  const digits = String(cik).replace(/\D/g, "");
  return digits.padStart(10, "0");
}

export async function loadTickerMap(
  apiCache: Record<string, CachedData>
): Promise<Map<string, string>> {
  const cached = apiCache[TICKERS_CACHE_KEY];
  const now = Date.now();
  if (cached && now - cached.timestamp < TICKERS_TTL_MS) {
    const data = cached.data as Record<string, string>;
    return new Map(Object.entries(data));
  }

  const resp = await fetch("https://www.sec.gov/files/company_tickers.json", {
    headers: { "User-Agent": SEC_USER_AGENT, Accept: "application/json" },
  });
  if (!resp.ok) {
    throw new Error(`SEC company_tickers.json failed: ${resp.status}`);
  }

  const raw = (await resp.json()) as Record<string, SecTickerEntry>;
  const map: Record<string, string> = {};
  for (const entry of Object.values(raw)) {
    const sym = entry.ticker?.toUpperCase();
    if (sym) map[sym] = padCik(entry.cik_str);
  }

  apiCache[TICKERS_CACHE_KEY] = { timestamp: now, data: map };
  return new Map(Object.entries(map));
}

export function getCikFromDb(symbol: string): string | null {
  const row = getDb()
    .prepare("SELECT cik FROM symbol_sec_meta WHERE symbol = ?")
    .get(symbol.toUpperCase()) as { cik: string } | undefined;
  return row?.cik ?? null;
}

export function saveCikToDb(symbol: string, cik: string): void {
  const sym = symbol.toUpperCase();
  getDb()
    .prepare(
      `INSERT INTO symbol_sec_meta (symbol, cik, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(symbol) DO UPDATE SET cik = excluded.cik, updated_at = excluded.updated_at`
    )
    .run(sym, padCik(cik), Date.now());
}

export async function resolveCikForSymbol(
  symbol: string,
  apiCache: Record<string, CachedData>,
  saveCache: () => void
): Promise<string | null> {
  const sym = symbol.toUpperCase();
  const existing = getCikFromDb(sym);
  if (existing) return existing;

  try {
    const map = await loadTickerMap(apiCache);
    saveCache();
    const cik = map.get(sym);
    if (cik) {
      saveCikToDb(sym, cik);
      return cik;
    }
  } catch {
    /* ignore */
  }
  return null;
}
