import type { PortfolioSignal, SignalCode } from "./portfolioSignals";
import type { ComputedFactors } from "./portfolioFactors";
import type { ComputedForecast } from "./portfolioForecast";

export type PortfolioActionType = "add" | "hold" | "trim" | "reduce" | "no_add";

export interface ResearchAction {
  action: PortfolioActionType;
  severity: "info" | "warn" | "critical";
  reason_code: string;
  reason: string;
  precedence: number;
}

export interface HoldingActionContext {
  signalCodes: string[];
  targetPct: number | null;
  dayChangePct: number | null;
}

export function computeHoldingAction(
  factors: ComputedFactors,
  forecast: ComputedForecast,
  context: HoldingActionContext
): ResearchAction {
  const codes = new Set(context.signalCodes);
  const concentration = factors.concentration_pct ?? 0;
  const targetPct = context.targetPct;
  const dayChange = context.dayChangePct;
  const probUp5d = forecast.prob_up_5d;
  const probUp20d = forecast.prob_up_20d;
  const regime = forecast.regime;
  const dd30 = factors.drawdown_30d;

  if (codes.has("CUT") || codes.has("STOP_LOSS")) {
    return {
      action: "reduce",
      severity: "critical",
      reason_code: "signal_stop_loss",
      reason: "Existing stop-loss or cut signal is active.",
      precedence: 0,
    };
  }

  if (probUp5d < 0.35 && dd30 != null && dd30 < -0.12) {
    return {
      action: "reduce",
      severity: "warn",
      reason_code: "forecast_bearish_dd",
      reason: "Low 5d probability with deep 30d drawdown.",
      precedence: 1,
    };
  }

  if (targetPct != null && concentration > targetPct + 5) {
    return {
      action: "trim",
      severity: "warn",
      reason_code: "overweight",
      reason: `Position ${concentration.toFixed(1)}% exceeds target ${targetPct}% + 5%.`,
      precedence: 2,
    };
  }

  if (codes.has("KELLY_CAP")) {
    return {
      action: "trim",
      severity: "warn",
      reason_code: "overweight",
      reason: "Above half-Kelly or target weight cap.",
      precedence: 2,
    };
  }

  if (
    codes.has("FOMO_COOLDOWN") ||
    (dayChange != null && dayChange > 8 && probUp5d > 0.7)
  ) {
    return {
      action: "no_add",
      severity: "warn",
      reason_code: "fomo_guard",
      reason: "Reflexivity spike — avoid hype adds.",
      precedence: 3,
    };
  }

  if (
    probUp20d > 0.6 &&
    targetPct != null &&
    concentration < targetPct - 3 &&
    regime !== "stress"
  ) {
    return {
      action: "add",
      severity: "info",
      reason_code: "forecast_underweight",
      reason: "Favorable 20d outlook with room below target weight.",
      precedence: 4,
    };
  }

  if (probUp5d >= 0.45 && probUp5d <= 0.65) {
    return {
      action: "hold",
      severity: "info",
      reason_code: "neutral_forecast",
      reason: "Neutral 5d forecast — maintain position.",
      precedence: 5,
    };
  }

  return {
    action: "hold",
    severity: "info",
    reason_code: "default",
    reason: "No strong research signal — default hold.",
    precedence: 99,
  };
}

export function computePortfolioLevelActions(
  portfolioSignals: PortfolioSignal[]
): (ResearchAction & { code: string })[] {
  const actions: (ResearchAction & { code: string })[] = [];

  for (const sig of portfolioSignals) {
    if (sig.code === "BARBELL_DRIFT") {
      actions.push({
        code: sig.code,
        action: "trim",
        severity: "warn",
        reason_code: "barbell_drift",
        reason: sig.detail,
        precedence: 10,
      });
    } else if (sig.code === "FRAGILITY_ALERT") {
      actions.push({
        code: sig.code,
        action: "reduce",
        severity: "critical",
        reason_code: "fragility_alert",
        reason: sig.detail,
        precedence: 5,
      });
    } else if (sig.code === "REBALANCE") {
      actions.push({
        code: sig.code,
        action: "hold",
        severity: "info",
        reason_code: "rebalance_nudge",
        reason: sig.detail,
        precedence: 20,
      });
    }
  }

  return actions;
}

export function mergeResearchWithSignals(
  researchActions: ResearchAction[],
  existingSignals: PortfolioSignal[]
): PortfolioSignal[] {
  const merged = [...existingSignals];
  for (const act of researchActions) {
    merged.push({
      code: `RESEARCH_${act.action.toUpperCase()}` as SignalCode,
      severity: act.severity,
      title: `Research: ${act.action}`,
      action: act.action.replace("_", " "),
      detail: act.reason,
    });
  }
  return merged;
}
