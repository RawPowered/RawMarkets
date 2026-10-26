import { getDb } from "./db";

export type ResearchEngine = "python" | "typescript_fallback";
export type PortfolioActionType = "add" | "hold" | "trim" | "reduce" | "no_add";
export type PortfolioRegime = "risk_on" | "risk_off" | "range" | "stress";
export type NewsSource = "serpapi" | "yahoo_rss" | "manual";

export interface FactorSnapshotRow {
  id: number;
  holding_id: number;
  symbol: string;
  evaluated_at: number;
  return_5d: number | null;
  return_20d: number | null;
  vol_20d: number | null;
  drawdown_30d: number | null;
  drawdown_60d: number | null;
  trend_score: number | null;
  mean_reversion_score: number | null;
  concentration_pct: number | null;
  corr_to_portfolio: number | null;
  corr_to_benchmark: number | null;
  data_points: number;
  engine: ResearchEngine;
}

export interface ForecastRow {
  id: number;
  holding_id: number;
  symbol: string;
  evaluated_at: number;
  prob_up_5d: number;
  prob_up_20d: number;
  expected_return_low_5d: number | null;
  expected_return_high_5d: number | null;
  downside_risk_low_5d: number | null;
  downside_risk_high_5d: number | null;
  regime: PortfolioRegime;
  inputs_json: string;
  engine: ResearchEngine;
}

export interface ActionRow {
  id: number;
  holding_id: number | null;
  symbol: string | null;
  evaluated_at: number;
  action: PortfolioActionType;
  severity: "info" | "warn" | "critical";
  reason_code: string;
  reason: string;
  precedence: number;
  engine: ResearchEngine;
}

export interface NewsHistoryRow {
  id: number;
  symbol: string;
  source: NewsSource;
  title: string;
  snippet: string | null;
  url: string | null;
  published_at: string | null;
  raw_text: string;
  extracted_json: string | null;
  sentiment: number | null;
  novelty: number | null;
  time_horizon: string | null;
  macro_tags: string | null;
  event_type: string | null;
  confidence: number | null;
  fetched_at: number;
}

export interface FactorSnapshotInput {
  holding_id: number;
  symbol: string;
  evaluated_at: number;
  return_5d: number | null;
  return_20d: number | null;
  vol_20d: number | null;
  drawdown_30d: number | null;
  drawdown_60d: number | null;
  trend_score: number | null;
  mean_reversion_score: number | null;
  concentration_pct: number | null;
  corr_to_portfolio: number | null;
  corr_to_benchmark: number | null;
  data_points: number;
  engine: ResearchEngine;
}

export interface ForecastInput {
  holding_id: number;
  symbol: string;
  evaluated_at: number;
  prob_up_5d: number;
  prob_up_20d: number;
  expected_return_low_5d: number | null;
  expected_return_high_5d: number | null;
  downside_risk_low_5d: number | null;
  downside_risk_high_5d: number | null;
  regime: PortfolioRegime;
  inputs_json: Record<string, unknown>;
  engine: ResearchEngine;
}

export interface ActionInput {
  holding_id: number | null;
  symbol: string | null;
  evaluated_at: number;
  action: PortfolioActionType;
  severity: "info" | "warn" | "critical";
  reason_code: string;
  reason: string;
  precedence: number;
  engine: ResearchEngine;
}

export interface NewsInsertInput {
  symbol: string;
  source: NewsSource;
  title: string;
  snippet?: string | null;
  url?: string | null;
  published_at?: string | null;
  raw_text: string;
  extracted_json?: string | null;
  sentiment?: number | null;
  novelty?: number | null;
  time_horizon?: string | null;
  macro_tags?: string | null;
  event_type?: string | null;
  confidence?: number | null;
  fetched_at: number;
}

export function insertFactorSnapshot(input: FactorSnapshotInput): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO portfolio_factor_snapshots (
        holding_id, symbol, evaluated_at, return_5d, return_20d, vol_20d,
        drawdown_30d, drawdown_60d, trend_score, mean_reversion_score,
        concentration_pct, corr_to_portfolio, corr_to_benchmark, data_points, engine
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.holding_id,
      input.symbol.toUpperCase(),
      input.evaluated_at,
      input.return_5d,
      input.return_20d,
      input.vol_20d,
      input.drawdown_30d,
      input.drawdown_60d,
      input.trend_score,
      input.mean_reversion_score,
      input.concentration_pct,
      input.corr_to_portfolio,
      input.corr_to_benchmark,
      input.data_points,
      input.engine
    );
}

export function insertForecast(input: ForecastInput): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO portfolio_forecasts (
        holding_id, symbol, evaluated_at, prob_up_5d, prob_up_20d,
        expected_return_low_5d, expected_return_high_5d,
        downside_risk_low_5d, downside_risk_high_5d,
        regime, inputs_json, engine
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.holding_id,
      input.symbol.toUpperCase(),
      input.evaluated_at,
      input.prob_up_5d,
      input.prob_up_20d,
      input.expected_return_low_5d,
      input.expected_return_high_5d,
      input.downside_risk_low_5d,
      input.downside_risk_high_5d,
      input.regime,
      JSON.stringify(input.inputs_json),
      input.engine
    );
}

export function insertAction(input: ActionInput): void {
  getDb()
    .prepare(
      `INSERT INTO portfolio_actions (
        holding_id, symbol, evaluated_at, action, severity,
        reason_code, reason, precedence, engine
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.holding_id,
      input.symbol?.toUpperCase() ?? null,
      input.evaluated_at,
      input.action,
      input.severity,
      input.reason_code,
      input.reason,
      input.precedence,
      input.engine
    );
}

export function insertNewsHistory(input: NewsInsertInput): boolean {
  const r = getDb()
    .prepare(
      `INSERT OR IGNORE INTO portfolio_news_history (
        symbol, source, title, snippet, url, published_at, raw_text,
        extracted_json, sentiment, novelty, time_horizon, macro_tags,
        event_type, confidence, fetched_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.symbol.toUpperCase(),
      input.source,
      input.title,
      input.snippet ?? null,
      input.url ?? null,
      input.published_at ?? null,
      input.raw_text,
      input.extracted_json ?? null,
      input.sentiment ?? null,
      input.novelty ?? null,
      input.time_horizon ?? null,
      input.macro_tags ?? null,
      input.event_type ?? null,
      input.confidence ?? null,
      input.fetched_at
    );
  return r.changes > 0;
}

export function getLatestFactorSnapshot(
  holdingId: number
): FactorSnapshotRow | null {
  const row = getDb()
    .prepare(
      `SELECT * FROM portfolio_factor_snapshots
       WHERE holding_id = ? ORDER BY evaluated_at DESC LIMIT 1`
    )
    .get(holdingId) as Record<string, unknown> | undefined;
  return row ? (row as unknown as FactorSnapshotRow) : null;
}

export function getLatestForecast(holdingId: number): ForecastRow | null {
  const row = getDb()
    .prepare(
      `SELECT * FROM portfolio_forecasts
       WHERE holding_id = ? ORDER BY evaluated_at DESC LIMIT 1`
    )
    .get(holdingId) as Record<string, unknown> | undefined;
  return row ? (row as unknown as ForecastRow) : null;
}

export function getLatestActionsForEval(
  evaluatedAt: number
): ActionRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM portfolio_actions WHERE evaluated_at = ? ORDER BY precedence ASC`
    )
    .all(evaluatedAt) as ActionRow[];
}

export function getLatestActionsForHolding(
  holdingId: number
): ActionRow | null {
  const row = getDb()
    .prepare(
      `SELECT * FROM portfolio_actions
       WHERE holding_id = ? ORDER BY evaluated_at DESC, precedence ASC LIMIT 1`
    )
    .get(holdingId) as ActionRow | undefined;
  return row ?? null;
}

export function getPortfolioLevelActions(
  evaluatedAt: number
): ActionRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM portfolio_actions
       WHERE evaluated_at = ? AND holding_id IS NULL ORDER BY precedence ASC`
    )
    .all(evaluatedAt) as ActionRow[];
}

export function listRecentNewsForSymbol(
  symbol: string,
  sinceMs: number
): NewsHistoryRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM portfolio_news_history
       WHERE symbol = ? AND fetched_at >= ? ORDER BY fetched_at DESC LIMIT 20`
    )
    .all(symbol.toUpperCase(), sinceMs) as NewsHistoryRow[];
}

export function countSnapshotsForHolding(holdingId: number): number {
  const row = getDb()
    .prepare(
      "SELECT COUNT(*) as c FROM portfolio_price_snapshots WHERE holding_id = ?"
    )
    .get(holdingId) as { c: number };
  return row.c;
}

export function getEngineMeta(key: string): string | null {
  const row = getDb()
    .prepare("SELECT value FROM engine_meta WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setEngineMeta(key: string, value: string): void {
  getDb()
    .prepare("INSERT OR REPLACE INTO engine_meta (key, value) VALUES (?, ?)")
    .run(key, value);
}
