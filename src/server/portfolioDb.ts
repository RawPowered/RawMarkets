import { getDb } from "./db";

export type EntryMode = "shares" | "dollars";
export type BarbellSide = "safe" | "aggressive";
export type WealthBucket =
  | "public_equities"
  | "precious_metals"
  | "digital"
  | "energy"
  | "private_vc";
export type Fragility = "hedged" | "speculative" | "ponzi";
export type PriceSnapshotSource =
  | "yahoo_chart"
  | "scrape"
  | "coinbase"
  | "manual"
  | "cached";

export interface PortfolioHoldingRow {
  id: number;
  symbol: string;
  entry_date: string;
  entry_mode: EntryMode;
  shares: number;
  entry_price: number;
  dollars_invested: number | null;
  barbell_side: BarbellSide;
  wealth_bucket: WealthBucket;
  fragility: Fragility;
  target_pct: number | null;
  take_profit_pct: number | null;
  stop_loss_pct: number | null;
  kelly_p: number | null;
  kelly_b: number | null;
  archived_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface ListPortfolioHoldingsOptions {
  /** Default true — only non-archived holdings */
  activeOnly?: boolean;
  archivedOnly?: boolean;
}

export interface PortfolioSettingsRow {
  id: number;
  safe_target_pct: number;
  aggressive_target_pct: number;
  rebalance_drift_pct: number;
  last_rebalance_date: string | null;
  cash_buffer_usd: number;
  research_enabled: number;
  research_min_history_days: number;
  ollama_news_enabled: number;
  last_research_at: number | null;
  updated_at: number;
}

export interface PriceSnapshotRow {
  holding_id: number;
  date: string;
  close: number;
  source: PriceSnapshotSource;
}

export interface CreateHoldingInput {
  symbol: string;
  entry_date: string;
  entry_mode: EntryMode;
  shares?: number;
  entry_price: number;
  dollars_invested?: number | null;
  barbell_side?: BarbellSide;
  wealth_bucket?: WealthBucket;
  fragility?: Fragility;
  target_pct?: number | null;
  take_profit_pct?: number | null;
  stop_loss_pct?: number | null;
  kelly_p?: number | null;
  kelly_b?: number | null;
}

export interface UpdateHoldingInput {
  symbol?: string;
  entry_date?: string;
  entry_mode?: EntryMode;
  shares?: number;
  entry_price?: number;
  dollars_invested?: number | null;
  barbell_side?: BarbellSide;
  wealth_bucket?: WealthBucket;
  fragility?: Fragility;
  target_pct?: number | null;
  take_profit_pct?: number | null;
  stop_loss_pct?: number | null;
  kelly_p?: number | null;
  kelly_b?: number | null;
}

function rowToHolding(row: Record<string, unknown>): PortfolioHoldingRow {
  return {
    id: row.id as number,
    symbol: String(row.symbol).toUpperCase(),
    entry_date: String(row.entry_date),
    entry_mode: row.entry_mode as EntryMode,
    shares: row.shares as number,
    entry_price: row.entry_price as number,
    dollars_invested:
      row.dollars_invested == null ? null : (row.dollars_invested as number),
    barbell_side: row.barbell_side as BarbellSide,
    wealth_bucket: row.wealth_bucket as WealthBucket,
    fragility: row.fragility as Fragility,
    target_pct: row.target_pct == null ? null : (row.target_pct as number),
    take_profit_pct:
      row.take_profit_pct == null ? null : (row.take_profit_pct as number),
    stop_loss_pct:
      row.stop_loss_pct == null ? null : (row.stop_loss_pct as number),
    kelly_p: row.kelly_p == null ? null : (row.kelly_p as number),
    kelly_b: row.kelly_b == null ? null : (row.kelly_b as number),
    archived_at:
      row.archived_at == null ? null : (row.archived_at as number),
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  };
}

export function normalizeHoldingEntry(input: CreateHoldingInput): {
  shares: number;
  entry_price: number;
  dollars_invested: number | null;
} {
  const entryPrice = Math.max(0.0001, Number(input.entry_price) || 0);
  if (input.entry_mode === "dollars") {
    const dollars = Math.max(0, Number(input.dollars_invested) || 0);
    const shares = dollars / entryPrice;
    return {
      shares: parseFloat(shares.toFixed(6)),
      entry_price: entryPrice,
      dollars_invested: dollars,
    };
  }
  const shares = Math.max(0, Number(input.shares) || 0);
  return {
    shares: parseFloat(shares.toFixed(6)),
    entry_price: entryPrice,
    dollars_invested: parseFloat((shares * entryPrice).toFixed(2)),
  };
}

export function listPortfolioHoldings(
  options?: ListPortfolioHoldingsOptions
): PortfolioHoldingRow[] {
  let sql =
    "SELECT * FROM portfolio_holdings";
  if (options?.archivedOnly) {
    sql += " WHERE archived_at IS NOT NULL";
  } else if (options?.activeOnly !== false) {
    sql += " WHERE archived_at IS NULL";
  }
  sql += " ORDER BY entry_date DESC, symbol ASC";
  const rows = getDb().prepare(sql).all() as Record<string, unknown>[];
  return rows.map(rowToHolding);
}

export function listArchivedPortfolioHoldings(): PortfolioHoldingRow[] {
  return listPortfolioHoldings({ archivedOnly: true });
}

export function setPortfolioHoldingArchived(
  id: number,
  archived: boolean
): PortfolioHoldingRow | null {
  const now = Date.now();
  getDb()
    .prepare("UPDATE portfolio_holdings SET archived_at = ?, updated_at = ? WHERE id = ?")
    .run(archived ? now : null, now, id);
  return getPortfolioHolding(id);
}

export function getPortfolioHolding(id: number): PortfolioHoldingRow | null {
  const row = getDb()
    .prepare("SELECT * FROM portfolio_holdings WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToHolding(row) : null;
}

export function createPortfolioHolding(
  input: CreateHoldingInput
): PortfolioHoldingRow {
  const norm = normalizeHoldingEntry(input);
  const now = Date.now();
  const result = getDb()
    .prepare(
      `INSERT INTO portfolio_holdings (
        symbol, entry_date, entry_mode, shares, entry_price, dollars_invested,
        barbell_side, wealth_bucket, fragility, target_pct,
        take_profit_pct, stop_loss_pct, kelly_p, kelly_b, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.symbol.trim().toUpperCase(),
      input.entry_date,
      input.entry_mode,
      norm.shares,
      norm.entry_price,
      norm.dollars_invested,
      input.barbell_side ?? "aggressive",
      input.wealth_bucket ?? "public_equities",
      input.fragility ?? "speculative",
      input.target_pct ?? null,
      input.take_profit_pct ?? null,
      input.stop_loss_pct ?? null,
      input.kelly_p ?? null,
      input.kelly_b ?? null,
      now,
      now
    );
  const created = getPortfolioHolding(Number(result.lastInsertRowid));
  if (!created) throw new Error("Failed to create holding");
  return created;
}

export function updatePortfolioHolding(
  id: number,
  input: UpdateHoldingInput
): PortfolioHoldingRow | null {
  const existing = getPortfolioHolding(id);
  if (!existing) return null;

  const merged: CreateHoldingInput = {
    symbol: input.symbol ?? existing.symbol,
    entry_date: input.entry_date ?? existing.entry_date,
    entry_mode: input.entry_mode ?? existing.entry_mode,
    shares: input.shares ?? existing.shares,
    entry_price: input.entry_price ?? existing.entry_price,
    dollars_invested:
      input.dollars_invested !== undefined
        ? input.dollars_invested
        : existing.dollars_invested,
    barbell_side: input.barbell_side ?? existing.barbell_side,
    wealth_bucket: input.wealth_bucket ?? existing.wealth_bucket,
    fragility: input.fragility ?? existing.fragility,
    target_pct:
      input.target_pct !== undefined ? input.target_pct : existing.target_pct,
    take_profit_pct:
      input.take_profit_pct !== undefined
        ? input.take_profit_pct
        : existing.take_profit_pct,
    stop_loss_pct:
      input.stop_loss_pct !== undefined
        ? input.stop_loss_pct
        : existing.stop_loss_pct,
    kelly_p: input.kelly_p !== undefined ? input.kelly_p : existing.kelly_p,
    kelly_b: input.kelly_b !== undefined ? input.kelly_b : existing.kelly_b,
  };

  const norm = normalizeHoldingEntry(merged);
  const now = Date.now();

  getDb()
    .prepare(
      `UPDATE portfolio_holdings SET
        symbol = ?, entry_date = ?, entry_mode = ?, shares = ?, entry_price = ?,
        dollars_invested = ?, barbell_side = ?, wealth_bucket = ?, fragility = ?,
        target_pct = ?, take_profit_pct = ?, stop_loss_pct = ?, kelly_p = ?, kelly_b = ?,
        updated_at = ?
      WHERE id = ?`
    )
    .run(
      merged.symbol.trim().toUpperCase(),
      merged.entry_date,
      merged.entry_mode,
      norm.shares,
      norm.entry_price,
      norm.dollars_invested,
      merged.barbell_side!,
      merged.wealth_bucket!,
      merged.fragility!,
      merged.target_pct ?? null,
      merged.take_profit_pct ?? null,
      merged.stop_loss_pct ?? null,
      merged.kelly_p ?? null,
      merged.kelly_b ?? null,
      now,
      id
    );

  return getPortfolioHolding(id);
}

export function deletePortfolioHolding(id: number): boolean {
  const r = getDb()
    .prepare("DELETE FROM portfolio_holdings WHERE id = ?")
    .run(id);
  return r.changes > 0;
}

export function upsertPriceSnapshot(
  holdingId: number,
  date: string,
  close: number,
  source: PriceSnapshotSource
): void {
  getDb()
    .prepare(
      `INSERT INTO portfolio_price_snapshots (holding_id, date, close, source)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(holding_id, date) DO UPDATE SET close = excluded.close, source = excluded.source`
    )
    .run(holdingId, date, close, source);
}

export function listSnapshotsForHolding(
  holdingId: number,
  limit = 60
): PriceSnapshotRow[] {
  return getDb()
    .prepare(
      `SELECT holding_id, date, close, source FROM portfolio_price_snapshots
       WHERE holding_id = ? ORDER BY date ASC LIMIT ?`
    )
    .all(holdingId, limit) as PriceSnapshotRow[];
}

export function getLatestSnapshot(
  holdingId: number
): PriceSnapshotRow | null {
  const row = getDb()
    .prepare(
      `SELECT holding_id, date, close, source FROM portfolio_price_snapshots
       WHERE holding_id = ? ORDER BY date DESC LIMIT 1`
    )
    .get(holdingId) as PriceSnapshotRow | undefined;
  return row ?? null;
}

export function getPortfolioSettings(): PortfolioSettingsRow {
  const row = getDb()
    .prepare("SELECT * FROM portfolio_settings WHERE id = 1")
    .get() as Record<string, unknown> | undefined;
  if (!row) {
    return {
      id: 1,
      safe_target_pct: 80,
      aggressive_target_pct: 20,
      rebalance_drift_pct: 5,
      last_rebalance_date: null,
      cash_buffer_usd: 0,
      research_enabled: 1,
      research_min_history_days: 25,
      ollama_news_enabled: 1,
      last_research_at: null,
      updated_at: Date.now(),
    };
  }
  return {
    id: 1,
    safe_target_pct: row.safe_target_pct as number,
    aggressive_target_pct: row.aggressive_target_pct as number,
    rebalance_drift_pct: row.rebalance_drift_pct as number,
    last_rebalance_date: row.last_rebalance_date as string | null,
    cash_buffer_usd: row.cash_buffer_usd as number,
    research_enabled:
      row.research_enabled == null ? 1 : (row.research_enabled as number),
    research_min_history_days:
      row.research_min_history_days == null
        ? 25
        : (row.research_min_history_days as number),
    ollama_news_enabled:
      row.ollama_news_enabled == null ? 1 : (row.ollama_news_enabled as number),
    last_research_at:
      row.last_research_at == null ? null : (row.last_research_at as number),
    updated_at: row.updated_at as number,
  };
}

export function savePortfolioSettings(
  partial: Partial<
    Omit<PortfolioSettingsRow, "id" | "updated_at">
  >
): PortfolioSettingsRow {
  const current = getPortfolioSettings();
  const next = {
    safe_target_pct: partial.safe_target_pct ?? current.safe_target_pct,
    aggressive_target_pct:
      partial.aggressive_target_pct ?? current.aggressive_target_pct,
    rebalance_drift_pct:
      partial.rebalance_drift_pct ?? current.rebalance_drift_pct,
    last_rebalance_date:
      partial.last_rebalance_date !== undefined
        ? partial.last_rebalance_date
        : current.last_rebalance_date,
    cash_buffer_usd: partial.cash_buffer_usd ?? current.cash_buffer_usd,
    research_enabled: partial.research_enabled ?? current.research_enabled,
    research_min_history_days:
      partial.research_min_history_days ?? current.research_min_history_days,
    ollama_news_enabled:
      partial.ollama_news_enabled ?? current.ollama_news_enabled,
    last_research_at:
      partial.last_research_at !== undefined
        ? partial.last_research_at
        : current.last_research_at,
    updated_at: Date.now(),
  };
  getDb()
    .prepare(
      `UPDATE portfolio_settings SET
        safe_target_pct = ?, aggressive_target_pct = ?, rebalance_drift_pct = ?,
        last_rebalance_date = ?, cash_buffer_usd = ?,
        research_enabled = ?, research_min_history_days = ?,
        ollama_news_enabled = ?, last_research_at = ?, updated_at = ?
      WHERE id = 1`
    )
    .run(
      next.safe_target_pct,
      next.aggressive_target_pct,
      next.rebalance_drift_pct,
      next.last_rebalance_date,
      next.cash_buffer_usd,
      next.research_enabled,
      next.research_min_history_days,
      next.ollama_news_enabled,
      next.last_research_at,
      next.updated_at
    );
  return getPortfolioSettings();
}
