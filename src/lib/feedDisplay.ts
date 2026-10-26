import type { Asset, FeedSource } from "../types";

/** Fresh network scrape or live API on this refresh. */
export function isRealPriceSource(source?: FeedSource): boolean {
  return source === "live" || source === "scrape";
}

/** Price may be shown (live, scrape, or last stored check). */
export function isDisplayablePriceSource(source?: FeedSource): boolean {
  return (
    source === "live" || source === "scrape" || source === "cached"
  );
}

export function hasRealChartHistory(source?: FeedSource): boolean {
  return source === "live" || source === "scrape";
}

/** User-facing price badge label (never "Scrape" or "Simulation"). */
export function feedPriceSourceLabel(source?: FeedSource): string | null {
  if (!isDisplayablePriceSource(source)) return null;
  if (source === "live" || source === "scrape") return "LIVE";
  if (source === "cached") return "STORED";
  return "MARKET";
}

/** User-facing chart badge label. */
export function feedHistorySourceLabel(source?: FeedSource): string | null {
  if (!hasRealChartHistory(source)) return null;
  return "CHART";
}

export type MarketFeedDisplaySource =
  | "unavailable"
  | "alphavantage"
  | "mixed-fallback"
  | "scrape"
  | "simulation";

/** Map API aggregate source to user-facing header state. */
export function normalizeMarketFeedDisplaySource(
  source?: string
): MarketFeedDisplaySource {
  if (source === "scrape" || source === "alphavantage" || source === "mixed-fallback") {
    return source;
  }
  if (source === "simulation") return "unavailable";
  return "unavailable";
}

/** Header / status chip for aggregate market feed. */
export function marketFeedStatusLabel(
  source: MarketFeedDisplaySource,
  liveCount: number,
  staleCount: number
): string {
  const total = liveCount + staleCount;
  if (source === "scrape" || source === "alphavantage") {
    return total > 0 ? `Live ${liveCount}/${total}` : "Market feed";
  }
  if (source === "mixed-fallback") {
    return `Live ${liveCount}${staleCount > 0 ? ` · ${staleCount} pending` : ""}`;
  }
  if (total > 0 && liveCount === 0) {
    return `Pending ${staleCount}/${total}`;
  }
  return "Connecting…";
}

/** Sanitize server feed notes for display (strip scrape/simulation jargon). */
export function sanitizeFeedNoteForDisplay(note?: string): string | undefined {
  if (!note?.trim()) return undefined;
  let t = note
    .replace(/yahoo scrape/gi, "market quote")
    .replace(/kitco scrape/gi, "metals feed")
    .replace(/scrape/gi, "market feed")
    .replace(/playwright scrapers/gi, "market capture")
    .replace(/simulated/gi, "pending")
    .replace(/simulation/gi, "offline mode")
    .replace(/npm run scrape:install/gi, "engine setup")
    .replace(/Only fresh scrapes are shown/gi, "Refresh for latest quotes");
  return t.trim();
}

export function formatDisplayPrice(
  value: number | undefined,
  priceSource?: FeedSource
): string {
  if (!isDisplayablePriceSource(priceSource)) return "—";
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatLastPriceCheck(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDisplayChangePercent(
  changePercent: string | undefined,
  priceSource?: FeedSource
): string | null {
  if (!isDisplayablePriceSource(priceSource)) return null;
  const t = changePercent?.trim();
  return t || null;
}

export function isDisplayChangePositive(
  changePercent: string | undefined,
  priceSource?: FeedSource
): boolean | null {
  const t = formatDisplayChangePercent(changePercent, priceSource);
  if (t == null) return null;
  return !t.startsWith("-");
}

export function formatDisplayChangeAmount(
  change: number | undefined,
  priceSource?: FeedSource
): string | null {
  if (!isDisplayablePriceSource(priceSource)) return null;
  if (change == null || !Number.isFinite(change)) return null;
  return Math.abs(change).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function isRealMetalSpotLive(source: string, fromLive: boolean): boolean {
  return (
    fromLive &&
    (source.includes("kitco") || source.includes("yahoo"))
  );
}

/** Show metal price when we have a real number from any feed (not unavailable). */
export function isDisplayableMetalPrice(
  source: string,
  price: number | undefined
): boolean {
  if (price == null || !Number.isFinite(price) || price <= 0) return false;
  if (
    source === "unavailable" ||
    source === "scrape-disabled" ||
    source === "none"
  ) {
    return false;
  }
  return true;
}

export function formatMetalSpotPrice(
  price: number | undefined,
  source: string,
  _fromLive: boolean
): string {
  if (!isDisplayableMetalPrice(source, price)) return "—";
  return `$${price!.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatMetalChangePercent(
  changePercent: string | undefined,
  source: string,
  _fromLive: boolean,
  price?: number
): string | null {
  if (!isDisplayableMetalPrice(source, price)) return null;
  const t = changePercent?.trim();
  return t || null;
}
