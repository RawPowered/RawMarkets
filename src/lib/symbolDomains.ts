/** Curated issuer / brand domains for favicon-backed logos (Google s2). */
export const SYMBOL_DOMAIN_MAP: Record<string, string> = {
  GOLD: "kitco.com",
  SILVER: "kitco.com",
  COPPER: "cmegroup.com",
  GLD: "ssga.com",
  SLV: "ishares.com",
  OIL: "cmegroup.com",
  BRENT: "ice.com",
  COAL: "ice.com",
  GAS: "cmegroup.com",
  CVX: "chevron.com",
  XOM: "exxonmobil.com",
  BP: "bp.com",
  SHEL: "shell.com",
  NVDA: "nvidia.com",
  GOOGL: "google.com",
  GOOG: "google.com",
  META: "meta.com",
  TSLA: "tesla.com",
  SMSN: "samsung.com",
  OPENAI: "openai.com",
  XAI: "x.ai",
  ANTHROPIC: "anthropic.com",
  NTDOY: "nintendo.com",
  DIS: "disney.com",
  HAS: "hasbro.com",
  "TCG-POKE": "pokemon.com",
  JPM: "jpmorganchase.com",
  GS: "goldmansachs.com",
  X: "ussteel.com",
  NUE: "nucor.com",
  SONY: "sony.com",
  MSFT: "microsoft.com",
  SPACEX: "spacex.com",
  AAPL: "apple.com",
  AMZN: "amazon.com",
  AMD: "amd.com",
  INTC: "intel.com",
  NFLX: "netflix.com",
  BTC: "bitcoin.org",
  ETH: "ethereum.org",
  PLTR: "palantir.com",
  ASML: "asml.com",
  ARM: "arm.com",
};

export function guessDomainFromSymbol(symbol: string): string | null {
  const key = symbol.trim().toUpperCase();
  if (!key || key.length > 12) return null;
  if (/[^A-Z0-9.-]/.test(key)) return null;
  const base = key.replace(/\.(COM|INC)$/i, "").toLowerCase();
  if (base.length < 2) return null;
  return `${base}.com`;
}

export function resolveSymbolDomain(
  symbol: string,
  overrides?: Record<string, string>
): string | null {
  const key = symbol.trim().toUpperCase();
  if (overrides?.[key]) return overrides[key];
  if (SYMBOL_DOMAIN_MAP[key]) return SYMBOL_DOMAIN_MAP[key];
  return guessDomainFromSymbol(key);
}

export function googleFaviconUrl(domain: string, size: 64 | 128 | 256 = 128): string {
  const host = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`;
}
