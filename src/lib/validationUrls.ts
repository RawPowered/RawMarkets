import type { Asset } from "../types";
import { YAHOO_SYMBOL_MAP } from "../server/scrapers/types";
import { isCryptoSymbol } from "../server/scrapers/coinbaseSpot";
import { resolveCoinbaseProductId, coinbaseProductUrl } from "../server/scrapers/coinbaseSpot";

export interface ValidationLink {
  url: string;
  provider: string;
  label: string;
}

const KITCO: Record<string, ValidationLink> = {
  GOLD: {
    url: "https://www.kitco.com/charts/livegold.html",
    provider: "Kitco",
    label: "Kitco live gold",
  },
  SILVER: {
    url: "https://www.kitco.com/charts/livesilver.html",
    provider: "Kitco",
    label: "Kitco live silver",
  },
  XAU: {
    url: "https://www.kitco.com/charts/livegold.html",
    provider: "Kitco",
    label: "Kitco live gold (XAU)",
  },
  XAG: {
    url: "https://www.kitco.com/charts/livesilver.html",
    provider: "Kitco",
    label: "Kitco live silver (XAG)",
  },
  XPT: {
    url: "https://www.kitco.com/charts/liveplatinum.html",
    provider: "Kitco",
    label: "Kitco live platinum",
  },
  XPD: {
    url: "https://www.kitco.com/charts/livepalladium.html",
    provider: "Kitco",
    label: "Kitco live palladium",
  },
};

function yahooQuote(symbol: string): ValidationLink {
  const sym = symbol.toUpperCase();
  return {
    url: `https://finance.yahoo.com/quote/${encodeURIComponent(sym)}/`,
    provider: "Yahoo Finance (fallback)",
    label: `Yahoo Finance ${sym}`,
  };
}

function yahooForAssetKey(sym: string): ValidationLink {
  const key = sym.toUpperCase();
  const yahooSym = YAHOO_SYMBOL_MAP[key] ?? key;
  return yahooQuote(yahooSym);
}

function googleFinanceBetaQuote(symbolOrId: string): ValidationLink {
  const id = symbolOrId.includes(":")
    ? symbolOrId
    : `${symbolOrId.toUpperCase()}:NASDAQ`;
  return {
    url: `https://www.google.com/finance/beta/quote/${encodeURIComponent(id)}`,
    provider: "Google Finance Beta",
    label: `Google Finance Beta: ${id}`,
  };
}

function coinbaseLink(assetKey: string, symbol: string): ValidationLink | null {
  const productId = resolveCoinbaseProductId(assetKey, symbol);
  if (!productId) return null;
  return {
    url: coinbaseProductUrl(productId),
    provider: "Coinbase",
    label: `Coinbase ${productId}`,
  };
}

function googleFinanceSearch(query: string): ValidationLink {
  const q = encodeURIComponent(query);
  return {
    url: `https://www.google.com/finance/beta/?q=${q}`,
    provider: "Google Finance Beta (search)",
    label: `Google Finance Beta search: ${query}`,
  };
}

function isPlainTicker(symbol: string): boolean {
  return /^[A-Z]{1,6}$/i.test(symbol) && !symbol.includes("-");
}

/**
 * Validation links match live capture providers (Kitco, Coinbase, GF Beta, Yahoo fallback).
 */
export function getValidationLink(
  symbol: string,
  category: Asset["category"],
  name?: string
): ValidationLink | null {
  const sym = symbol.toUpperCase().trim();
  const displayName = name?.trim() || sym;

  if (KITCO[sym]) return KITCO[sym];

  const coinbase = coinbaseLink(sym, sym);
  if (coinbase) return coinbase;

  if (YAHOO_SYMBOL_MAP[sym]) return googleFinanceBetaQuote(sym);

  if (category === "METALS") {
    if (sym === "COPPER") return yahooForAssetKey("COPPER");
    if (KITCO[sym]) return KITCO[sym];
    if (isPlainTicker(sym)) return googleFinanceBetaQuote(sym);
  }

  if (category === "ENERGY") {
    if (YAHOO_SYMBOL_MAP[sym] || ["OIL", "BRENT", "CVX", "XOM", "BP", "SHEL"].includes(sym)) {
      return googleFinanceBetaQuote(sym);
    }
  }

  if (["GLD", "SLV", "GDX", "IAU"].includes(sym)) {
    return googleFinanceBetaQuote(sym);
  }

  if (isPlainTicker(sym)) {
    return googleFinanceBetaQuote(sym);
  }

  if (sym.includes("-") || sym.length > 6) {
    return googleFinanceBetaQuote(sym);
  }

  return googleFinanceSearch(displayName);
}

export function getValidationLinkForAsset(
  assetKey: string,
  symbol: string,
  category: Asset["category"],
  name?: string
): ValidationLink | null {
  if (isCryptoSymbol(assetKey, symbol)) {
    return coinbaseLink(assetKey, symbol);
  }
  return getValidationLink(symbol, category, name);
}
