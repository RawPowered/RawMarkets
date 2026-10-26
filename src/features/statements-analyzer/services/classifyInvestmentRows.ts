import type { StatementRow } from "../types";

export function classifyInvestmentRows(rows: StatementRow[]): StatementRow[] {
  return rows.filter((row) => {
    if (row.kind !== "debit") return false;
    if (row.investmentPurchase && row.symbolHint) return true;
    if (row.categoryHint === "investments" && row.symbolHint) return true;
    return false;
  });
}
