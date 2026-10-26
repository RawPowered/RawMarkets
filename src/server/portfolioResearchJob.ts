import type { CachedData } from "./db";
import type { PortfolioSignal } from "../lib/portfolioSignals";
import type { EnrichedHoldingInput } from "../lib/portfolioSignals";
import {
  computeFactorsForHolding,
  computePortfolioLogReturns,
  logReturns,
} from "../lib/portfolioFactors";
import { aggregateNews, computeForecast } from "../lib/portfolioForecast";
import {
  computeHoldingAction,
  computePortfolioLevelActions,
} from "../lib/portfolioResearchMerge";
import type { PortfolioHoldingRow, PortfolioSettingsRow } from "./portfolioDb";
import {
  listSnapshotsForHolding,
  savePortfolioSettings,
  upsertPriceSnapshot,
} from "./portfolioDb";
import {
  countSnapshotsForHolding,
  getEngineMeta,
  insertAction,
  insertFactorSnapshot,
  insertForecast,
  listRecentNewsForSymbol,
  type ResearchEngine,
} from "./portfolioResearchDb";
import { ingestNewsForSymbols } from "./newsIngest";
import { DEFAULT_OLLAMA_MODEL } from "./ollamaDefaults";
import { runPythonResearch, type PythonResearchPayload, isPythonAvailable } from "./pythonBridge";
import { fetchYahooChart } from "./yahooChart";
import { checkOllamaReady } from "./ollamaExtract";
import type {
  PortfolioHoldingResearch,
  PortfolioResearchMeta,
} from "../types";

const BACKFILL_MIN_SNAPSHOTS_DEFAULT = 65;

export interface ResearchJobDeps {
  apiCache: Record<string, CachedData>;
  saveCache: () => void;
  getApiKey: (id: string) => string | undefined;
}

export interface ResearchJobInput {
  holdings: PortfolioHoldingRow[];
  enriched: EnrichedHoldingInput[];
  settings: PortfolioSettingsRow;
  portfolioSignals: PortfolioSignal[];
  runNews: boolean;
}

export interface ResearchJobResult {
  evaluatedAt: number | null;
  byHoldingId: Map<number, PortfolioHoldingResearch>;
  meta: PortfolioResearchMeta;
}

async function backfillPricesIfNeeded(
  holding: PortfolioHoldingRow,
  deps: ResearchJobDeps,
  minSnapshots: number
): Promise<number[]> {
  const count = countSnapshotsForHolding(holding.id);
  if (count < minSnapshots) {
    const chart = await fetchYahooChart(holding.symbol, "3mo", {
      fresh: true,
      apiCache: deps.apiCache,
      persistCache: deps.saveCache,
    });
    for (const pt of chart.history) {
      upsertPriceSnapshot(holding.id, pt.date, pt.value, "yahoo_chart");
    }
  }

  const snapshots = listSnapshotsForHolding(holding.id, 120);
  return snapshots.map((s) => s.close);
}

async function fetchBenchmarkPrices(
  deps: ResearchJobDeps
): Promise<number[]> {
  const chart = await fetchYahooChart("SPY", "3mo", {
    fresh: false,
    apiCache: deps.apiCache,
    persistCache: deps.saveCache,
  });
  return chart.history.map((p) => p.value);
}

function buildNewsFromDb(
  symbol: string
): Array<{ sentiment: number; confidence: number; novelty: number }> {
  const since = Date.now() - 7 * 86400000;
  return listRecentNewsForSymbol(symbol, since).map((n) => ({
    sentiment: n.sentiment ?? 0,
    confidence: n.confidence ?? 0.3,
    novelty: n.novelty ?? 0.5,
  }));
}

function runTypeScriptResearch(
  input: ResearchJobInput,
  pricesByHolding: Map<number, number[]>,
  benchmarkPrices: number[],
  newsBySymbol: Record<
    string,
    Array<{ sentiment: number; confidence: number; novelty: number }>
  >,
  evaluatedAt: number
): {
  engine: ResearchEngine;
  holdings: Array<{
    holding_id: number;
    symbol: string;
    factors: ReturnType<typeof computeFactorsForHolding>;
    forecast: ReturnType<typeof computeForecast>;
    action: ReturnType<typeof computeHoldingAction>;
  }>;
  portfolioActions: ReturnType<typeof computePortfolioLevelActions>;
} {
  const portfolioTotal = input.enriched.reduce((s, e) => s + e.marketValue, 0);
  const holdingsPrices = new Map<number, number[]>();
  const weights = new Map<number, number>();

  for (const e of input.enriched) {
    holdingsPrices.set(e.holding.id, pricesByHolding.get(e.holding.id) ?? []);
    weights.set(e.holding.id, e.marketValue);
  }

  const portLogRets = computePortfolioLogReturns(holdingsPrices, weights);
  const benchLogRets =
    benchmarkPrices.length >= 2 ? logReturns(benchmarkPrices) : null;

  const results = input.enriched.map((e) => {
    const prices = pricesByHolding.get(e.holding.id) ?? [];
    const factors = computeFactorsForHolding(
      prices,
      e.marketValue,
      portfolioTotal,
      portLogRets,
      benchLogRets
    );
    const newsItems = newsBySymbol[e.holding.symbol.toUpperCase()] ?? [];
    const newsAgg = aggregateNews(newsItems);
    const forecast = computeForecast(factors, newsAgg);
    const signalCodes = input.portfolioSignals
      .filter((s) => s.holdingId === e.holding.id)
      .map((s) => s.code);
    const action = computeHoldingAction(factors, forecast, {
      signalCodes,
      targetPct: e.holding.target_pct,
      dayChangePct: e.dayChangePct,
    });

    return {
      holding_id: e.holding.id,
      symbol: e.holding.symbol,
      factors,
      forecast,
      action,
    };
  });

  return {
    engine: "typescript_fallback",
    holdings: results,
    portfolioActions: computePortfolioLevelActions(input.portfolioSignals),
  };
}

function persistResearchResults(
  engine: ResearchEngine,
  evaluatedAt: number,
  holdings: Array<{
    holding_id: number;
    symbol: string;
    factors: ReturnType<typeof computeFactorsForHolding>;
    forecast: ReturnType<typeof computeForecast>;
    action: ReturnType<typeof computeHoldingAction>;
  }>,
  portfolioActions: Array<{
    action: string;
    severity: "info" | "warn" | "critical";
    reason_code: string;
    reason: string;
    precedence: number;
    code?: string;
  }>
): Map<number, PortfolioHoldingResearch> {
  const byId = new Map<number, PortfolioHoldingResearch>();

  for (const h of holdings) {
    insertFactorSnapshot({
      holding_id: h.holding_id,
      symbol: h.symbol,
      evaluated_at: evaluatedAt,
      return_5d: h.factors.return_5d,
      return_20d: h.factors.return_20d,
      vol_20d: h.factors.vol_20d,
      drawdown_30d: h.factors.drawdown_30d,
      drawdown_60d: h.factors.drawdown_60d,
      trend_score: h.factors.trend_score,
      mean_reversion_score: h.factors.mean_reversion_score,
      concentration_pct: h.factors.concentration_pct,
      corr_to_portfolio: h.factors.corr_to_portfolio,
      corr_to_benchmark: h.factors.corr_to_benchmark,
      data_points: h.factors.data_points,
      engine,
    });

    insertForecast({
      holding_id: h.holding_id,
      symbol: h.symbol,
      evaluated_at: evaluatedAt,
      prob_up_5d: h.forecast.prob_up_5d,
      prob_up_20d: h.forecast.prob_up_20d,
      expected_return_low_5d: h.forecast.expected_return_low_5d,
      expected_return_high_5d: h.forecast.expected_return_high_5d,
      downside_risk_low_5d: h.forecast.downside_risk_low_5d,
      downside_risk_high_5d: h.forecast.downside_risk_high_5d,
      regime: h.forecast.regime,
      inputs_json: h.forecast.inputs_json,
      engine,
    });

    insertAction({
      holding_id: h.holding_id,
      symbol: h.symbol,
      evaluated_at: evaluatedAt,
      action: h.action.action,
      severity: h.action.severity,
      reason_code: h.action.reason_code,
      reason: h.action.reason,
      precedence: h.action.precedence,
      engine,
    });

    byId.set(h.holding_id, {
      evaluated_at: evaluatedAt,
      engine,
      factors: {
        return_5d: h.factors.return_5d,
        return_20d: h.factors.return_20d,
        vol_20d: h.factors.vol_20d,
        drawdown_30d: h.factors.drawdown_30d,
        drawdown_60d: h.factors.drawdown_60d,
        trend_score: h.factors.trend_score,
        mean_reversion_score: h.factors.mean_reversion_score,
        concentration_pct: h.factors.concentration_pct,
        corr_to_portfolio: h.factors.corr_to_portfolio,
        corr_to_benchmark: h.factors.corr_to_benchmark,
        data_points: h.factors.data_points,
      },
      forecast: {
        prob_up_5d: h.forecast.prob_up_5d,
        prob_up_20d: h.forecast.prob_up_20d,
        expected_return_low_5d: h.forecast.expected_return_low_5d,
        expected_return_high_5d: h.forecast.expected_return_high_5d,
        downside_risk_low_5d: h.forecast.downside_risk_low_5d,
        downside_risk_high_5d: h.forecast.downside_risk_high_5d,
        regime: h.forecast.regime,
      },
      action: h.action,
    });
  }

  for (const pa of portfolioActions) {
    insertAction({
      holding_id: null,
      symbol: null,
      evaluated_at: evaluatedAt,
      action: pa.action as PortfolioHoldingResearch["action"]["action"],
      severity: pa.severity,
      reason_code: pa.reason_code,
      reason: pa.reason,
      precedence: pa.precedence,
      engine,
    });
  }

  return byId;
}

export async function runPortfolioResearchJob(
  input: ResearchJobInput,
  deps: ResearchJobDeps
): Promise<ResearchJobResult> {
  const empty: ResearchJobResult = {
    evaluatedAt: null,
    byHoldingId: new Map(),
    meta: { status: "idle", engine: null, python: false, ollama: false },
  };

  if (!input.settings.research_enabled || input.holdings.length === 0) {
    return empty;
  }

  const evaluatedAt = Date.now();
  const minSnapshots = Math.max(
    20,
    input.settings.research_min_history_days ?? BACKFILL_MIN_SNAPSHOTS_DEFAULT
  );
  const pricesByHolding = new Map<number, number[]>();

  const backfillResults = await Promise.all(
    input.holdings.map((h) => backfillPricesIfNeeded(h, deps, minSnapshots))
  );
  input.holdings.forEach((h, i) => {
    pricesByHolding.set(h.id, backfillResults[i] ?? []);
  });

  const benchmarkPrices = await fetchBenchmarkPrices(deps);
  const symbols = [...new Set(input.holdings.map((h) => h.symbol.toUpperCase()))];

  let newsBySymbol: Record<
    string,
    Array<{ sentiment: number; confidence: number; novelty: number }>
  > = {};

  const ollamaModel = getEngineMeta("ollama_default_model") ?? DEFAULT_OLLAMA_MODEL;
  const ollamaCheck = await checkOllamaReady(ollamaModel);
  const ollamaEnabled =
    input.settings.ollama_news_enabled === 1 &&
    input.runNews &&
    ollamaCheck.ok &&
    ollamaCheck.modelReady;

  if (input.runNews) {
    newsBySymbol = await ingestNewsForSymbols(symbols, {
      getApiKey: deps.getApiKey,
      apiCache: deps.apiCache,
      saveCache: deps.saveCache,
      ollamaEnabled,
      ollamaModel,
    });
  } else {
    for (const sym of symbols) {
      newsBySymbol[sym] = buildNewsFromDb(sym);
    }
  }

  const portfolioTotal = input.enriched.reduce((s, e) => s + e.marketValue, 0);

  const pyPayload: PythonResearchPayload = {
    evaluated_at: evaluatedAt,
    portfolio_total: portfolioTotal,
    benchmark_prices: benchmarkPrices,
    news_by_symbol: newsBySymbol,
    portfolio_signals: input.portfolioSignals.map((s) => ({
      code: s.code,
      detail: s.detail,
    })),
    holdings: input.enriched.map((e) => ({
      holding_id: e.holding.id,
      symbol: e.holding.symbol,
      prices: pricesByHolding.get(e.holding.id) ?? [],
      market_value: e.marketValue,
      target_pct: e.holding.target_pct,
      day_change_pct: e.dayChangePct,
      signal_codes: input.portfolioSignals
        .filter((s) => s.holdingId === e.holding.id)
        .map((s) => s.code),
    })),
  };

  const pyResult = isPythonAvailable()
    ? await runPythonResearch(pyPayload)
    : { ok: false as const, error: "Python not available" };

  let engine: ResearchEngine = "typescript_fallback";
  let holdingsResult: ReturnType<typeof runTypeScriptResearch>["holdings"];
  let portfolioActions: ReturnType<typeof computePortfolioLevelActions>;

  if (pyResult.ok && pyResult.holdings?.length) {
    engine = "python";
    holdingsResult = pyResult.holdings.map((h) => ({
      holding_id: h.holding_id,
      symbol: h.symbol,
      factors: {
        return_5d: h.factors.return_5d as number | null,
        return_20d: h.factors.return_20d as number | null,
        vol_20d: h.factors.vol_20d as number | null,
        drawdown_30d: h.factors.drawdown_30d as number | null,
        drawdown_60d: h.factors.drawdown_60d as number | null,
        trend_score: h.factors.trend_score as number | null,
        mean_reversion_score: h.factors.mean_reversion_score as number | null,
        concentration_pct: h.factors.concentration_pct as number | null,
        corr_to_portfolio: h.factors.corr_to_portfolio as number | null,
        corr_to_benchmark: h.factors.corr_to_benchmark as number | null,
        data_points: Number(h.factors.data_points ?? 0),
      },
      forecast: {
        prob_up_5d: Number(h.forecast.prob_up_5d),
        prob_up_20d: Number(h.forecast.prob_up_20d),
        expected_return_low_5d: Number(h.forecast.expected_return_low_5d),
        expected_return_high_5d: Number(h.forecast.expected_return_high_5d),
        downside_risk_low_5d: Number(h.forecast.downside_risk_low_5d),
        downside_risk_high_5d: Number(h.forecast.downside_risk_high_5d),
        regime: String(h.forecast.regime) as ReturnType<
          typeof computeForecast
        >["regime"],
        inputs_json:
          (h.forecast.inputs_json as Record<string, unknown>) ?? {},
      },
      action: {
        action: String(h.action.action) as ReturnType<
          typeof computeHoldingAction
        >["action"],
        severity: String(h.action.severity) as ReturnType<
          typeof computeHoldingAction
        >["severity"],
        reason_code: String(h.action.reason_code),
        reason: String(h.action.reason),
        precedence: Number(h.action.precedence ?? 99),
      },
    }));
    portfolioActions = (pyResult.portfolio_actions ?? []).map((pa) => ({
      code: String(pa.reason_code ?? ""),
      action: String(pa.action) as ReturnType<
        typeof computeHoldingAction
      >["action"],
      severity: String(pa.severity) as "info" | "warn" | "critical",
      reason_code: String(pa.reason_code),
      reason: String(pa.reason),
      precedence: Number(pa.precedence ?? 99),
    }));
  } else {
    const ts = runTypeScriptResearch(
      input,
      pricesByHolding,
      benchmarkPrices,
      newsBySymbol,
      evaluatedAt
    );
    engine = ts.engine;
    holdingsResult = ts.holdings;
    portfolioActions = ts.portfolioActions;
  }

  const byHoldingId = persistResearchResults(
    engine,
    evaluatedAt,
    holdingsResult,
    portfolioActions
  );

  savePortfolioSettings({ last_research_at: evaluatedAt });

  return {
    evaluatedAt,
    byHoldingId,
    meta: {
      status: "ready",
      engine,
      python: engine === "python",
      ollama: ollamaEnabled,
    },
  };
}

export async function loadLatestResearchForHoldings(
  holdingIds: number[]
): Promise<Map<number, PortfolioHoldingResearch>> {
  const { getLatestFactorSnapshot, getLatestForecast, getLatestActionsForHolding } =
    await import("./portfolioResearchDb");

  const map = new Map<number, PortfolioHoldingResearch>();
  for (const id of holdingIds) {
    const factors = getLatestFactorSnapshot(id);
    const forecast = getLatestForecast(id);
    const action = getLatestActionsForHolding(id);
    if (!factors && !forecast) continue;

    map.set(id, {
      evaluated_at: factors?.evaluated_at ?? forecast?.evaluated_at ?? 0,
      engine: (factors?.engine ?? forecast?.engine ?? "typescript_fallback") as ResearchEngine,
      factors: factors
        ? {
            return_5d: factors.return_5d,
            return_20d: factors.return_20d,
            vol_20d: factors.vol_20d,
            drawdown_30d: factors.drawdown_30d,
            drawdown_60d: factors.drawdown_60d,
            trend_score: factors.trend_score,
            mean_reversion_score: factors.mean_reversion_score,
            concentration_pct: factors.concentration_pct,
            corr_to_portfolio: factors.corr_to_portfolio,
            corr_to_benchmark: factors.corr_to_benchmark,
            data_points: factors.data_points,
          }
        : null,
      forecast: forecast
        ? {
            prob_up_5d: forecast.prob_up_5d,
            prob_up_20d: forecast.prob_up_20d,
            expected_return_low_5d: forecast.expected_return_low_5d,
            expected_return_high_5d: forecast.expected_return_high_5d,
            downside_risk_low_5d: forecast.downside_risk_low_5d,
            downside_risk_high_5d: forecast.downside_risk_high_5d,
            regime: forecast.regime,
          }
        : null,
      action: action
        ? {
            action: action.action,
            severity: action.severity,
            reason_code: action.reason_code,
            reason: action.reason,
            precedence: action.precedence,
          }
        : null,
    });
  }
  return map;
}
