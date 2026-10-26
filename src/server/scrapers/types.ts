import type { MetalSpotRate } from "../metalSpot";

export type ScrapeResult = {
  ok: boolean;
  price?: number;
  change?: number;
  changePercent?: string;
  sourceUrl: string;
  provider: string;
  error?: string;
  scrapedAt?: number;
};

export type MetalScrapeBundle = {
  rates: Record<string, MetalSpotRate>;
  source: string;
  fromLive: boolean;
  message?: string;
};

export const YAHOO_SYMBOL_MAP: Record<string, string> = {
  OIL: "CL=F",
  BRENT: "BZ=F",
  COPPER: "HG=F",
  GOLD: "GC=F",
  SILVER: "SI=F",
};

/** Crypto bases captured via Coinbase spot API (not Yahoo/GF). */
export const CRYPTO_BASE_SYMBOLS = new Set([
  "BTC",
  "ETH",
  "SOL",
  "LTC",
  "XRP",
  "ADA",
  "DOGE",
  "BCH",
  "LINK",
  "AVAX",
  "MATIC",
  "DOT",
  "UNI",
  "ATOM",
  "XLM",
  "ALGO",
  "HBAR",
  "FIL",
  "APT",
  "ARB",
  "NEAR",
  "ICP",
  "OP",
]);

export function isCryptoSymbol(assetKey: string, symbol: string): boolean {
  const sym = symbol.toUpperCase().trim();
  const key = assetKey.toUpperCase().trim();
  if (CRYPTO_BASE_SYMBOLS.has(sym) || CRYPTO_BASE_SYMBOLS.has(key)) return true;
  const pair = sym.match(/^([A-Z]{2,12})-USD$/);
  if (pair && CRYPTO_BASE_SYMBOLS.has(pair[1])) return true;
  return false;
}

export function resolveYahooSymbol(assetKey: string, symbol: string): string {
  const key = assetKey.toUpperCase();
  if (YAHOO_SYMBOL_MAP[key]) return YAHOO_SYMBOL_MAP[key];
  return symbol.toUpperCase();
}

/** Dashboard keys we can scrape on Yahoo (futures mapping or plain tickers). */
export function isYahooScrapeable(assetKey: string, symbol: string): boolean {
  const key = assetKey.toUpperCase();
  if (YAHOO_SYMBOL_MAP[key]) return true;
  const sym = symbol.toUpperCase().trim();
  return /^[A-Z]{1,6}$/.test(sym) && !sym.includes("-");
}

/** Map Yahoo / vendor exchange codes to Google Finance suffix. */
const EXCHANGE_TO_GOOGLE: Record<string, string> = {
  NYQ: "NYSE",
  NYSE: "NYSE",
  NMS: "NASDAQ",
  NGM: "NASDAQ",
  NCM: "NASDAQ",
  NASDAQ: "NASDAQ",
  NEO: "NEO",
  TOR: "TSE",
  TSE: "TSE",
  LON: "LON",
  LSE: "LON",
  FRA: "FRA",
  GER: "ETR",
  ETR: "ETR",
  PAR: "EPA",
  EPA: "EPA",
  HKG: "HKG",
  HKEX: "HKG",
  ASX: "ASX",
  SWX: "SWX",
  AMS: "AMS",
  BME: "BME",
  MIL: "BIT",
  BIT: "BIT",
};

export function buildGoogleFinanceId(
  symbol: string,
  exchange?: string | null
): string | null {
  const sym = symbol.toUpperCase().trim();
  if (!sym || sym.includes(" ")) return null;
  if (sym.includes(":")) return sym;

  const exRaw = (exchange ?? "").toUpperCase().trim();
  const googleEx =
    EXCHANGE_TO_GOOGLE[exRaw] ??
    (exRaw.length >= 2 && exRaw.length <= 6 ? exRaw : null);

  if (/^[A-Z]{1,5}$/.test(sym)) {
    return `${sym}:${googleEx ?? "NASDAQ"}`;
  }

  if (/^[A-Z0-9.-]{1,24}$/.test(sym)) {
    return sym;
  }

  return null;
}

/** Resolve Google Finance Beta quote id (primary for equities). */
export function resolveGoogleFinanceId(
  assetKey: string,
  symbol: string,
  googleFinanceId?: string,
  exchange?: string | null
): string | null {
  const explicit = googleFinanceId?.trim();
  if (explicit) return explicit;
  if (isCryptoSymbol(assetKey, symbol)) return null;

  return buildGoogleFinanceId(symbol, exchange);
}

export function isGoogleFinanceScrapeable(
  assetKey: string,
  symbol: string,
  googleFinanceId?: string,
  exchange?: string | null
): boolean {
  if (isCryptoSymbol(assetKey, symbol)) return false;
  return resolveGoogleFinanceId(assetKey, symbol, googleFinanceId, exchange) != null;
}
