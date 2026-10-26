import { WEALTH_BIBLE_RULES } from "../../../lib/wealthBibleRules";
import type { WealthRuleCheck } from "../types";

interface ExpenseStats {
  essentialsPct: number;
  discretionaryPct: number;
  investmentPct: number;
}

function findRule(idIncludes: string): string {
  return WEALTH_BIBLE_RULES.find((r) => r.id.includes(idIncludes))?.title ?? idIncludes;
}

export function evaluateExpenseWealthChecks(stats: ExpenseStats): WealthRuleCheck[] {
  const checks: WealthRuleCheck[] = [];

  checks.push({
    id: "safe-core-spend",
    title: findRule("diag-1"),
    status: stats.essentialsPct <= 70 ? "pass" : "warn",
    detail:
      stats.essentialsPct <= 70
        ? "Essentials are controlled enough to preserve capital for compounding."
        : "Essentials spend is high; tighten fixed costs to protect safe-core allocation.",
  });

  checks.push({
    id: "asymmetric-upside",
    title: findRule("flywheel-2"),
    status: stats.investmentPct >= 10 ? "pass" : "fail",
    detail:
      stats.investmentPct >= 10
        ? "Investment flow supports long-horizon upside exposure."
        : "Investment flow is low; increase consistent capital deployment to investments.",
  });

  checks.push({
    id: "hype-loop-risk",
    title: findRule("diag-7"),
    status: stats.discretionaryPct <= 35 ? "pass" : "warn",
    detail:
      stats.discretionaryPct <= 35
        ? "Discretionary spend is in a disciplined range."
        : "Discretionary spend is elevated; reduce impulse categories to avoid hype-loop behavior.",
  });

  return checks;
}
