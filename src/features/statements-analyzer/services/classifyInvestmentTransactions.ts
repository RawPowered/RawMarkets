import type { StatementRow } from "../types";
import type { InvestmentTransaction } from "./computePositionFromTransactions";

function isInvestmentTxType(txType: string): "buy" | "sell" | null {
  if (/stock\s*buy|bitcoin\s*buy/i.test(txType)) return "buy";
  if (/stock\s*sell|bitcoin\s*sell/i.test(txType)) return "sell";
  return null;
}

export function classifyInvestmentTransactions(
  rows: StatementRow[]
): StatementRow[] {
  return rows.filter((row) => {
    if (!row.symbolHint) return false;
    const txType = row.transactionType ?? "";
    if (isInvestmentTxType(txType)) return true;
    if (row.investmentPurchase && row.kind === "debit") return true;
    if (row.investmentSale && row.kind === "credit") return true;
    return false;
  });
}

export function statementRowToInvestmentTransaction(
  row: StatementRow
): InvestmentTransaction | null {
  if (!row.symbolHint) return null;
  const txType =
    isInvestmentTxType(row.transactionType ?? "") ??
    (row.investmentSale ? "sell" : row.investmentPurchase ? "buy" : null);
  if (!txType) return null;

  const price =
    row.entryPriceUsd && row.entryPriceUsd > 0
      ? row.entryPriceUsd
      : row.shares && row.shares > 0
        ? row.amountUsd / row.shares
        : row.amountUsd;
  const shares =
    row.shares && row.shares > 0
      ? row.shares
      : price > 0
        ? row.amountUsd / price
        : 0;
  if (shares <= 0 || price <= 0) return null;

  return {
    symbol: row.symbolHint.toUpperCase(),
    tx_date: row.date,
    tx_type: txType,
    shares: parseFloat(shares.toFixed(6)),
    price: parseFloat(price.toFixed(6)),
    amount_usd: parseFloat(row.amountUsd.toFixed(2)),
    source_line: row.sourceLine,
  };
}

export function investmentTransactionsFromRows(
  rows: StatementRow[]
): InvestmentTransaction[] {
  return classifyInvestmentTransactions(rows)
    .map(statementRowToInvestmentTransaction)
    .filter((t): t is InvestmentTransaction => t != null);
}
