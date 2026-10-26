import { evaluateExpenseWealthChecks } from "../adapters/wealthRulesAdapter";
import type { ExpenseBreakdownResult, StatementRow } from "../types";

function categoryForRow(row: StatementRow): string {
  const text = `${row.merchant} ${row.description}`.toLowerCase();
  if (row.categoryHint === "investments" || /stock|bitcoin|btc|invest/.test(text)) {
    return "Investments";
  }
  if (/rent|mortgage|utility|electric|water|insurance|phone/.test(text)) {
    return "Essentials";
  }
  if (/grocery|market|food/.test(text)) {
    return "Food";
  }
  if (/uber|lyft|gas|fuel|transit/.test(text)) {
    return "Transport";
  }
  return "Discretionary";
}

export function buildExpenseBreakdown(rows: StatementRow[]): ExpenseBreakdownResult {
  const spendRows = rows.filter((r) => r.kind === "debit");
  const totals = new Map<string, number>();
  let total = 0;
  spendRows.forEach((row) => {
    const category = categoryForRow(row);
    const next = (totals.get(category) ?? 0) + row.amountUsd;
    totals.set(category, next);
    total += row.amountUsd;
  });

  const categories = [...totals.entries()]
    .map(([category, amountUsd]) => ({
      category,
      amountUsd: Number(amountUsd.toFixed(2)),
      sharePct: total > 0 ? Number(((amountUsd / total) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.amountUsd - a.amountUsd);

  const essentialsPct = categories.find((c) => c.category === "Essentials")?.sharePct ?? 0;
  const investmentPct = categories.find((c) => c.category === "Investments")?.sharePct ?? 0;
  const discretionaryPct = categories.find((c) => c.category === "Discretionary")?.sharePct ?? 0;

  return {
    totalSpendUsd: Number(total.toFixed(2)),
    categories,
    wealthChecks: evaluateExpenseWealthChecks({
      essentialsPct,
      discretionaryPct,
      investmentPct,
    }),
  };
}
