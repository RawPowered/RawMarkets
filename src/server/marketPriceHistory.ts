import { getDb } from "./db";
import type { Asset, FeedSource } from "../types";

const MAX_HISTORY_PER_ASSET = 200;

export interface MarketPriceCheckRow {
  asset_key: string;
  symbol: string;
  price: number;
  change_amount: number | null;
  change_percent: string | null;
  source: string;
  checked_at: number;
}

function isRecordableSource(source?: FeedSource): boolean {
  return source === "live" || source === "scrape" || source === "cached";
}

export function shouldRecordMarketPrice(item: Asset): boolean {
  return (
    isRecordableSource(item.priceSource) &&
    Number.isFinite(item.current) &&
    item.current > 0
  );
}

export function recordMarketPriceCheck(
  assetKey: string,
  item: Asset,
  source: FeedSource = item.priceSource ?? "cached"
): void {
  if (!shouldRecordMarketPrice({ ...item, priceSource: source })) return;

  const db = getDb();
  const key = assetKey.toUpperCase();
  const checkedAt = Date.now();

  db.prepare(
    `INSERT INTO market_price_history (asset_key, symbol, price, change_amount, change_percent, source, checked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    key,
    item.symbol,
    item.current,
    Number.isFinite(item.change) ? item.change : null,
    item.changePercent ?? null,
    source,
    checkedAt
  );

  const prune = db
    .prepare(
      `DELETE FROM market_price_history
       WHERE asset_key = ?
         AND id NOT IN (
           SELECT id FROM market_price_history
           WHERE asset_key = ?
           ORDER BY checked_at DESC
           LIMIT ?
         )`
    )
    .run(key, key, MAX_HISTORY_PER_ASSET);
  void prune;
}

export function getLatestMarketPriceCheck(
  assetKey: string
): MarketPriceCheckRow | null {
  const row = getDb()
    .prepare(
      `SELECT asset_key, symbol, price, change_amount, change_percent, source, checked_at
       FROM market_price_history
       WHERE asset_key = ?
       ORDER BY checked_at DESC
       LIMIT 1`
    )
    .get(assetKey.toUpperCase()) as MarketPriceCheckRow | undefined;
  return row ?? null;
}

export function getMarketPriceHistory(
  assetKey: string,
  limit = 30
): { date: string; value: number; checkedAt: number; source: string }[] {
  const rows = getDb()
    .prepare(
      `SELECT price, source, checked_at FROM market_price_history
       WHERE asset_key = ?
       ORDER BY checked_at DESC
       LIMIT ?`
    )
    .all(assetKey.toUpperCase(), limit) as {
    price: number;
    source: string;
    checked_at: number;
  }[];

  return rows
    .map((r) => ({
      date: new Date(r.checked_at).toISOString().slice(0, 10),
      value: r.price,
      checkedAt: r.checked_at,
      source: r.source,
    }))
    .reverse();
}

function formatCheckedAt(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Record fresh checks, then fill simulated blanks from our local price history. */
export function persistAndHydrateMarketPrices(
  items: Record<string, Asset>,
  opts?: { cachedPriceKeys?: Set<string> }
): Record<string, Asset> {
  const out: Record<string, Asset> = { ...items };

  for (const [key, item] of Object.entries(out)) {
    if (shouldRecordMarketPrice(item)) {
      recordMarketPriceCheck(key, item);
      out[key] = {
        ...item,
        lastPriceCheckAt: new Date().toISOString(),
      };
    }
  }

  for (const [key, item] of Object.entries(out)) {
    if (isRecordableSource(item.priceSource) && item.current > 0) continue;

    const latest = getLatestMarketPriceCheck(key);
    if (!latest) continue;

    const storedNote = `Stored price from ${formatCheckedAt(latest.checked_at)} (${latest.source}).`;
    const feedNote = item.feedNote
      ? `${storedNote} ${item.feedNote}`
      : storedNote;

    out[key] = {
      ...item,
      current: latest.price,
      change: latest.change_amount ?? item.change,
      changePercent: latest.change_percent ?? item.changePercent,
      priceSource: "cached",
      lastPriceCheckAt: new Date(latest.checked_at).toISOString(),
      feedNote,
    };
    opts?.cachedPriceKeys?.add(key);
  }

  return out;
}

export function finalizeQuoteAsset(
  assetKey: string,
  item: Asset,
  priceSource: FeedSource
): Asset {
  const key = assetKey.toUpperCase();
  const hydrated = persistAndHydrateMarketPrices({
    [key]: { ...item, priceSource },
  });
  return hydrated[key] ?? item;
}
