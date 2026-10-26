import type { Asset } from "../types";
import { isAvQuotaPaused, getAvQuotaStatus } from "./avQuota";

export function stockFeedNote(opts: {
  keyConfigured: boolean;
  forceOffline: boolean;
  avPaused: boolean;
  hadLiveQuote: boolean;
  useScrapers?: boolean;
  scrapeError?: string;
}): string {
  if (opts.forceOffline) {
    return "Offline mode is on — live feeds disabled in Engine Settings.";
  }
  if (opts.useScrapers) {
    if (opts.scrapeError?.trim()) {
      return `Market quote unavailable: ${opts.scrapeError.trim()}`;
    }
    if (!opts.hadLiveQuote) {
      return "No live quote this refresh — use Refresh Spot Feed (may take 15–30 seconds).";
    }
    return "No live quote for this symbol on the last refresh.";
  }
  if (!opts.keyConfigured) {
    return "No Alpha Vantage key — add one under Config → API Keys or enable market capture.";
  }
  if (opts.avPaused) {
    const q = getAvQuotaStatus();
    const when = q.resetsAt
      ? new Date(q.resetsAt).toLocaleString("en-US", {
          timeZone: "UTC",
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "midnight UTC";
    return `Alpha Vantage daily limit used (25/day). Resets ${when}.`;
  }
  if (!opts.hadLiveQuote) {
    return "No live stock quote this refresh — wait for quota reset or refresh the feed.";
  }
  return "No live stock quote for this symbol on the last refresh.";
}

export function metalFeedNote(
  source: string,
  fromLive: boolean,
  message?: string
): string {
  if (fromLive) return "";
  if (message?.trim()) return message;
  if (source.includes("kitco")) {
    return "Metals feed did not complete — use Refresh Spot Feed.";
  }
  if (source === "unavailable" || source === "unavailable-fallback") {
    return "No live metal feed — use Refresh Spot Feed.";
  }
  if (source.includes("cached")) {
    return "Refresh for the latest metal quotes.";
  }
  if (source.includes("catalog-baseline")) {
    return "Showing catalog baseline — use Refresh Spot Feed for live Kitco/Yahoo.";
  }
  return "No live metal feed on this refresh.";
}

export function attachFeedNotes(
  items: Record<string, Asset>,
  ctx: {
    metalsFromLive: boolean;
    metalsSource: string;
    metalsMessage?: string;
    alphaKeyConfigured: boolean;
    forceOffline: boolean;
    livePriceKeys: Set<string>;
    useScrapers?: boolean;
  }
): void {
  const avPaused = isAvQuotaPaused();
  for (const [key, item] of Object.entries(items)) {
    if (item.priceSource === "live" || item.priceSource === "scrape") {
      item.feedNote = undefined;
      continue;
    }
    if (item.priceSource === "cached") {
      item.feedNote =
        "Showing last stored price — refresh for a new live quote.";
      continue;
    }
    if (item.category === "METALS" && (key === "GOLD" || key === "SILVER")) {
      item.feedNote = metalFeedNote(
        ctx.metalsSource,
        ctx.metalsFromLive,
        ctx.metalsMessage
      );
      continue;
    }
    item.feedNote = stockFeedNote({
      keyConfigured: ctx.alphaKeyConfigured,
      forceOffline: ctx.forceOffline,
      avPaused,
      hadLiveQuote: ctx.livePriceKeys.size > 0,
      useScrapers: ctx.useScrapers,
    });
  }
}
