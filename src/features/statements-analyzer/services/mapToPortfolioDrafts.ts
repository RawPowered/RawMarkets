import type { PortfolioImportDraft, StatementRow } from "../types";

export function mapToPortfolioDrafts(rows: StatementRow[]): PortfolioImportDraft[] {
  return rows.map((row, idx) => {
    const symbol = row.symbolHint ?? "";
    const entryPrice =
      row.entryPriceUsd && row.entryPriceUsd > 0
        ? row.entryPriceUsd
        : row.shares && row.shares > 0
          ? Number((row.amountUsd / row.shares).toFixed(4))
          : row.amountUsd > 0
            ? row.amountUsd
            : 0;
    const valid = Boolean(symbol) && entryPrice > 0;
    return {
      draftId: `draft-${idx}-${row.sourceLine}`,
      sourceLine: row.sourceLine,
      symbol,
      entry_date: row.date,
      entry_mode: "dollars",
      entry_price: entryPrice,
      dollars_invested: Number(row.amountUsd.toFixed(2)),
      shares: row.shares,
      notes: `${row.merchant} | ${row.description}`.slice(0, 220),
      confidence: valid ? (row.investmentPurchase ? 0.95 : 0.75) : 0.35,
      status: "pending",
      valid,
      validationMessage: valid
        ? undefined
        : !symbol
          ? "Missing ticker symbol; edit before import."
          : "Entry price must be greater than zero.",
    };
  });
}
