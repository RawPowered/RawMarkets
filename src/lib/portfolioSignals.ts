import type { PortfolioHoldingRow, PortfolioSettingsRow } from "../server/portfolioDb";
import type { HistoryPoint } from "../types";

export type SignalSeverity = "info" | "warn" | "critical";
export type SignalCode =
  | "HOLD"
  | "CUT"
  | "DISPOSITION_WARNING"
  | "FOMO_COOLDOWN"
  | "REBALANCE"
  | "BARBELL_DRIFT"
  | "KELLY_CAP"
  | "FRAGILITY_ALERT"
  | "TAKE_PROFIT"
  | "STOP_LOSS";

export interface PortfolioSignal {
  code: SignalCode;
  severity: SignalSeverity;
  title: string;
  action: string;
  detail: string;
  holdingId?: number;
}

export interface EnrichedHoldingInput {
  holding: PortfolioHoldingRow;
  currentPrice: number | null;
  dayChangePct: number | null;
  marketValue: number;
  costBasis: number;
  pnlUsd: number;
  pnlPct: number | null;
}

export interface PortfolioAggregates {
  totalValue: number;
  totalCost: number;
  dayPnlUsd: number;
  safePct: number;
  aggressivePct: number;
  ponziPct: number;
}

export function fractionalKelly(
  p: number,
  b: number,
  fraction = 0.5
): number | null {
  if (b <= 0 || p < 0 || p > 1) return null;
  const q = 1 - p;
  const fStar = (p * b - q) / b;
  if (!Number.isFinite(fStar) || fStar <= 0) return 0;
  return Math.min(1, Math.max(0, fStar * fraction));
}

export function computeAggregates(
  enriched: EnrichedHoldingInput[],
  cashBufferUsd: number
): PortfolioAggregates {
  let totalValue = cashBufferUsd;
  let totalCost = 0;
  let dayPnlUsd = 0;
  let safeValue = cashBufferUsd;
  let aggressiveValue = 0;
  let ponziValue = 0;

  for (const e of enriched) {
    totalValue += e.marketValue;
    totalCost += e.costBasis;
    if (e.dayChangePct != null && e.currentPrice != null) {
      const prev =
        e.currentPrice / (1 + e.dayChangePct / 100) || e.currentPrice;
      dayPnlUsd += e.holding.shares * (e.currentPrice - prev);
    }
    if (e.holding.barbell_side === "safe") safeValue += e.marketValue;
    else aggressiveValue += e.marketValue;
    if (e.holding.fragility === "ponzi") ponziValue += e.marketValue;
  }

  const investable = totalValue - cashBufferUsd || 1;
  if (totalValue <= 0) {
    return {
      totalValue: 0,
      totalCost: 0,
      dayPnlUsd: 0,
      safePct: 100,
      aggressivePct: 0,
      ponziPct: 0,
    };
  }
  return {
    totalValue,
    totalCost,
    dayPnlUsd,
    safePct: (safeValue / totalValue) * 100,
    aggressivePct: (aggressiveValue / totalValue) * 100,
    ponziPct: (ponziValue / investable) * 100,
  };
}

function signalsForHolding(
  e: EnrichedHoldingInput,
  portfolioPct: number
): PortfolioSignal[] {
  const signals: PortfolioSignal[] = [];
  const { holding, pnlPct, dayChangePct } = e;

  if (pnlPct != null && pnlPct > 5 && holding.take_profit_pct == null) {
    signals.push({
      code: "HOLD",
      severity: "info",
      title: "Winner — avoid early exit",
      action: "Hold",
      detail:
        "Disposition effect: up positions often get sold too soon. Let compounding work unless your take-profit target is hit.",
      holdingId: holding.id,
    });
  }

  if (holding.stop_loss_pct != null && pnlPct != null && pnlPct <= -holding.stop_loss_pct) {
    signals.push({
      code: "CUT",
      severity: "critical",
      title: "Stop loss breached",
      action: "Review exit",
      detail: `Position is ${pnlPct.toFixed(1)}% below entry — at or past your ${holding.stop_loss_pct}% stop.`,
      holdingId: holding.id,
    });
  } else if (pnlPct != null && pnlPct < -15) {
    signals.push({
      code: "CUT",
      severity: "warn",
      title: "Loser — cut loss bias",
      action: "Review exit",
      detail:
        "Down more than 15% — holding losers to avoid pain destroys returns. Re-check thesis or trim.",
      holdingId: holding.id,
    });
  }

  if (
    holding.take_profit_pct != null &&
    pnlPct != null &&
    pnlPct >= holding.take_profit_pct &&
    pnlPct < holding.take_profit_pct + 3
  ) {
    signals.push({
      code: "DISPOSITION_WARNING",
      severity: "warn",
      title: "Near take-profit",
      action: "Use plan",
      detail: "You set an exit target — execute per plan, not impulse.",
      holdingId: holding.id,
    });
  }

  if (holding.take_profit_pct != null && pnlPct != null && pnlPct >= holding.take_profit_pct) {
    signals.push({
      code: "TAKE_PROFIT",
      severity: "info",
      title: "Take-profit zone",
      action: "Consider trim",
      detail: `Gain ${pnlPct.toFixed(1)}% meets your ${holding.take_profit_pct}% target.`,
      holdingId: holding.id,
    });
  }

  if (
    dayChangePct != null &&
    dayChangePct > 8 &&
    portfolioPct > 15
  ) {
    signals.push({
      code: "FOMO_COOLDOWN",
      severity: "warn",
      title: "Reflexivity spike",
      action: "Do not add",
      detail: `+${dayChangePct.toFixed(1)}% today with ${portfolioPct.toFixed(0)}% of portfolio — avoid hype adds.`,
      holdingId: holding.id,
    });
  }

  if (holding.kelly_p != null && holding.kelly_b != null) {
    const half = fractionalKelly(holding.kelly_p, holding.kelly_b, 0.5);
    if (half != null && portfolioPct > half * 100 + 2) {
      signals.push({
        code: "KELLY_CAP",
        severity: "warn",
        title: "Above half-Kelly size",
        action: "No add",
        detail: `Position ${portfolioPct.toFixed(1)}% vs ~${(half * 100).toFixed(1)}% half-Kelly cap.`,
        holdingId: holding.id,
      });
    }
  }

  if (holding.target_pct != null && portfolioPct > holding.target_pct + 3) {
    signals.push({
      code: "KELLY_CAP",
      severity: "info",
      title: "Above target weight",
      action: "Trim or rebalance",
      detail: `Allocation ${portfolioPct.toFixed(1)}% exceeds your ${holding.target_pct}% cap.`,
      holdingId: holding.id,
    });
  }

  return signals;
}

export function computePortfolioSignals(
  enriched: EnrichedHoldingInput[],
  settings: PortfolioSettingsRow
): PortfolioSignal[] {
  const agg = computeAggregates(enriched, settings.cash_buffer_usd);
  const signals: PortfolioSignal[] = [];

  const safeTarget = settings.safe_target_pct;
  const aggTarget = settings.aggressive_target_pct;
  const drift = settings.rebalance_drift_pct;

  if (Math.abs(agg.safePct - safeTarget) > drift) {
    signals.push({
      code: "BARBELL_DRIFT",
      severity: "warn",
      title: "Barbell out of balance",
      action: "Rebalance",
      detail: `Safe sleeve ${agg.safePct.toFixed(1)}% vs target ${safeTarget}% (aggressive ${agg.aggressivePct.toFixed(1)}% vs ${aggTarget}%).`,
    });
  }

  const daysSinceRebalance = settings.last_rebalance_date
    ? Math.floor(
        (Date.now() - new Date(settings.last_rebalance_date).getTime()) /
          (86400000)
      )
    : 999;

  if (daysSinceRebalance >= 90) {
    signals.push({
      code: "REBALANCE",
      severity: "info",
      title: "Quarterly rebalance window",
      action: "Harvest volatility",
      detail:
        "Shannon's Demon: systematic rebalancing can convert volatility into growth — review sleeve weights.",
    });
  }

  if (agg.ponziPct > 25) {
    signals.push({
      code: "FRAGILITY_ALERT",
      severity: "critical",
      title: "Minsky / Ponzi exposure",
      action: "Reduce speculative",
      detail: `${agg.ponziPct.toFixed(0)}% of investable capital tagged high-fragility — systemic risk elevated.`,
    });
  }

  for (const e of enriched) {
    const portfolioPct =
      agg.totalValue > 0 ? (e.marketValue / agg.totalValue) * 100 : 0;
    signals.push(...signalsForHolding(e, portfolioPct));
  }

  const order: Record<SignalSeverity, number> = {
    critical: 0,
    warn: 1,
    info: 2,
  };
  return signals.sort(
    (a, b) => order[a.severity] - order[b.severity]
  );
}

export function mergeHistoryPoints(
  snapshots: { date: string; close: number }[],
  yahooPoints: HistoryPoint[]
): HistoryPoint[] {
  const map = new Map<string, number>();
  for (const s of snapshots) map.set(s.date, s.close);
  for (const p of yahooPoints) map.set(p.date, p.value);
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}
