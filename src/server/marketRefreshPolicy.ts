import { getDb, type EngineSettings } from "./db";

const LAST_MARKET_FEED_KEY = "last_market_feed_at";

export function marketRefreshFreshnessMs(settings: EngineSettings): number {
  const value = Math.max(1, settings.marketRefreshFreshnessValue ?? 24);
  if (settings.marketRefreshFreshnessUnit === "days") {
    return value * 24 * 60 * 60 * 1000;
  }
  return value * 60 * 60 * 1000;
}

export function getLastMarketFeedAt(): number | null {
  const row = getDb()
    .prepare("SELECT value FROM engine_meta WHERE key = ?")
    .get(LAST_MARKET_FEED_KEY) as { value: string } | undefined;
  if (!row) return null;
  const parsed = parseInt(row.value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function setLastMarketFeedAt(at: number): void {
  getDb()
    .prepare(
      `INSERT INTO engine_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(LAST_MARKET_FEED_KEY, String(at));
}

export function clearLastMarketFeedAt(): void {
  getDb()
    .prepare("DELETE FROM engine_meta WHERE key = ?")
    .run(LAST_MARKET_FEED_KEY);
}

export function marketNeedsBootstrap(): boolean {
  const customCount = getDb()
    .prepare("SELECT COUNT(*) as c FROM custom_assets")
    .get() as { c: number };
  if (customCount.c === 0) return true;

  if (getLastMarketFeedAt() != null) return false;

  const row = getDb()
    .prepare("SELECT COUNT(*) as c FROM market_price_history")
    .get() as { c: number };
  return row.c === 0;
}

export type MarketRefreshReason =
  | "manual"
  | "bootstrap"
  | "no_timestamp"
  | "stale"
  | "within_freshness_window"
  | "policy_off";

export function resolveMarketDataFresh(
  manualFresh: boolean,
  settings: EngineSettings
): { fresh: boolean; reason: MarketRefreshReason } {
  if (manualFresh) {
    return { fresh: true, reason: "manual" };
  }
  if (marketNeedsBootstrap()) {
    return { fresh: true, reason: "bootstrap" };
  }
  if (!settings.skipAutoMarketRefresh) {
    return { fresh: false, reason: "policy_off" };
  }
  const lastAt = getLastMarketFeedAt();
  if (lastAt == null) {
    return { fresh: true, reason: "no_timestamp" };
  }
  const age = Date.now() - lastAt;
  if (age < marketRefreshFreshnessMs(settings)) {
    return { fresh: false, reason: "within_freshness_window" };
  }
  return { fresh: true, reason: "stale" };
}

export function formatFreshnessLabel(settings: EngineSettings): string {
  const unit = settings.marketRefreshFreshnessUnit === "days" ? "day" : "hour";
  const value = settings.marketRefreshFreshnessValue;
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}
