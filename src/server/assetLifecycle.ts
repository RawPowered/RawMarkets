import { recordCatalogRemoval } from "./catalogRemovals";
import { getDb } from "./db";
import { listPortfolioHoldings, deletePortfolioHolding } from "./portfolioDb";

export interface DeleteAssetResult {
  success: boolean;
  symbol: string;
  deleted: boolean;
  blockedByPortfolio?: boolean;
  portfolioHoldingIds?: number[];
  message?: string;
  cascaded?: {
    marketPriceHistory: number;
    apiCache: number;
    portfolioHoldings: number;
    journalLinksCleared: number;
  };
}

export function deleteAsset(
  symbol: string,
  options?: { force?: boolean }
): DeleteAssetResult {
  const key = symbol.trim().toUpperCase();
  if (!key) {
    return { success: false, symbol: key, deleted: false, message: "Symbol required." };
  }

  const db = getDb();
  const exists = db
    .prepare("SELECT symbol FROM custom_assets WHERE symbol = ?")
    .get(key) as { symbol: string } | undefined;

  const portfolioRows = listPortfolioHoldings().filter(
    (h) => h.symbol.toUpperCase() === key
  );

  if (portfolioRows.length > 0 && !options?.force) {
    return {
      success: false,
      symbol: key,
      deleted: false,
      blockedByPortfolio: true,
      portfolioHoldingIds: portfolioRows.map((h) => h.id),
      message: `Symbol ${key} has ${portfolioRows.length} portfolio holding(s). Pass force=1 to delete anyway.`,
    };
  }

  let marketPriceHistory = 0;
  let apiCache = 0;
  let journalLinksCleared = 0;
  let portfolioHoldings = 0;

  const tx = db.transaction(() => {
    if (options?.force) {
      for (const h of portfolioRows) {
        if (deletePortfolioHolding(h.id)) portfolioHoldings++;
      }
    }

    const mph = db
      .prepare("DELETE FROM market_price_history WHERE asset_key = ?")
      .run(key);
    marketPriceHistory = mph.changes;

    const likePatterns = [
      `quote_${key}`,
      `yahoo_chart_${key}_%`,
      `serp_news_${key.toLowerCase()}%`,
      `news_bay_%${key}%`,
    ];
    for (const like of likePatterns) {
      const r = db
        .prepare("DELETE FROM api_cache WHERE cache_key LIKE ?")
        .run(like);
      apiCache += r.changes;
    }

    const journal = db
      .prepare(
        "UPDATE investor_journal_entries SET linked_asset_key = NULL WHERE linked_asset_key = ?"
      )
      .run(key);
    journalLinksCleared = journal.changes;

    db.prepare("DELETE FROM terminal_symbol_prefs WHERE symbol = ?").run(key);

    let deleted = false;
    if (exists) {
      const r = db.prepare("DELETE FROM custom_assets WHERE symbol = ?").run(key);
      deleted = r.changes > 0;
    }

    recordCatalogRemoval(key);

    return deleted;
  });

  const deleted = tx();

  return {
    success: deleted || marketPriceHistory > 0 || apiCache > 0,
    symbol: key,
    deleted,
    cascaded: {
      marketPriceHistory,
      apiCache,
      portfolioHoldings,
      journalLinksCleared,
    },
    message: deleted
      ? `Deleted ${key} and related data.`
      : exists
        ? `No catalog row for ${key}.`
        : `Removed orphaned data for ${key}.`,
  };
}
