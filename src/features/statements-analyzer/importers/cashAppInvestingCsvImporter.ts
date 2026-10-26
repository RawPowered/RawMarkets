import type { StatementImporter } from "./types";
import type { StatementRow } from "../types";
import {
  isDebitAmount,
  normalizeHeader,
  normalizeTickerSymbol,
  parseAccountingUsd,
  parseCashAppDate,
} from "./csvMoney";

function investmentTxKind(
  transactionType: string
): { purchase: boolean; sale: boolean; tx: "buy" | "sell" | null } {
  if (/stock\s*buy|bitcoin\s*buy/i.test(transactionType)) {
    return { purchase: true, sale: false, tx: "buy" };
  }
  if (/stock\s*sell|bitcoin\s*sell/i.test(transactionType)) {
    return { purchase: false, sale: true, tx: "sell" };
  }
  return { purchase: false, sale: false, tx: null };
}

function toRow(line: number, map: Record<string, string>): StatementRow | null {
  const dateRaw = map.date ?? "";
  const txType = map.transaction_type ?? map.type ?? "";
  const netRaw = map.net_amount ?? map.amount ?? "";
  const assetType = map.asset_type ?? "";
  const assetPriceRaw = map.asset_price ?? "";
  const assetAmountRaw = map.asset_amount ?? "";
  const notes = map.notes ?? map.note ?? "";

  const netUsd = parseAccountingUsd(netRaw);
  if (!dateRaw || netUsd <= 0) return null;

  const inv = investmentTxKind(txType);
  const symbolHint = inv.tx
    ? normalizeTickerSymbol(
        assetType || (/\bbitcoin\b/i.test(txType) ? "BTC" : "")
      )
    : undefined;

  const entryPriceUsd = parseAccountingUsd(assetPriceRaw);
  const shares = Number.parseFloat(assetAmountRaw.replace(/,/g, ""));
  const sharesN = Number.isFinite(shares) && shares > 0 ? shares : undefined;

  const kind = isDebitAmount(netRaw) ? "debit" : "credit";
  const description = [txType, notes, assetType ? `asset ${assetType}` : ""]
    .filter(Boolean)
    .join(" | ");

  return {
    sourceType: "cashapp_investing_csv",
    sourceLine: line,
    date: parseCashAppDate(dateRaw),
    merchant: "Cash App Investing",
    description,
    amountUsd: netUsd,
    kind,
    categoryHint: inv.tx ? "investments" : "general",
    symbolHint,
    externalId: map.transaction_id || undefined,
    investmentPurchase: inv.purchase,
    investmentSale: inv.sale,
    entryPriceUsd: entryPriceUsd > 0 ? entryPriceUsd : undefined,
    shares: sharesN,
    transactionType: txType,
  };
}

export const cashAppInvestingCsvImporter: StatementImporter = {
  id: "cashapp_investing_csv",
  label: "Cash App Investing CSV",
  canParse: (headers) => {
    const h = headers.map(normalizeHeader);
    return (
      h.includes("date") &&
      h.includes("transaction_type") &&
      h.includes("net_amount") &&
      (h.includes("asset_type") || h.includes("asset_price"))
    );
  },
  parse: (headers, rows) => {
    const normalizedHeaders = headers.map(normalizeHeader);
    const result: StatementRow[] = [];
    rows.forEach((cols, idx) => {
      const map: Record<string, string> = {};
      normalizedHeaders.forEach((header, hIdx) => {
        map[header] = (cols[hIdx] ?? "").trim();
      });
      const row = toRow(idx + 2, map);
      if (row) result.push(row);
    });
    return result;
  },
};
