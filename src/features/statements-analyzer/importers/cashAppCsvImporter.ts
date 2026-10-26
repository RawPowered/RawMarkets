import type { StatementImporter } from "./types";
import type { StatementRow } from "../types";
import {
  isDebitAmount,
  normalizeHeader,
  normalizeTickerSymbol,
  parseAccountingUsd,
  parseCashAppDate,
} from "./csvMoney";

/** P2P export: extract ticker from explicit buy phrasing only (never loose words like "OF"). */
function extractSymbolFromP2pText(text: string): string | undefined {
  const buy = text.match(/\b(?:buy|bought|purchase)\s+([A-Z][A-Z0-9.-]{0,9})\b/i);
  if (buy) return normalizeTickerSymbol(buy[1]);
  if (/\bbitcoin\b/i.test(text) || /\bbtc\b/i.test(text)) return "BTC";
  return undefined;
}

function toRow(line: number, map: Record<string, string>): StatementRow | null {
  const date = map.date ?? map.transaction_date ?? "";
  const amountRaw = map.amount ?? map.net_amount ?? "";
  const note = map.note ?? map.notes ?? map.description ?? "";
  const fromTo = [map.from, map.to].filter(Boolean).join(" -> ");
  const merchant = (map.to || map.from || note || "Unknown").trim();
  const amountAbs = parseAccountingUsd(amountRaw);
  if (!date || amountAbs <= 0) return null;

  const kind = isDebitAmount(amountRaw) ? "debit" : "credit";
  const desc = [map.status, map.type, note, fromTo].filter(Boolean).join(" | ");
  const symbolHint = extractSymbolFromP2pText(`${note} ${desc}`);
  const investing =
    symbolHint === "BTC" ||
    /cash app investing|stock buy|bitcoin buy/i.test(desc);

  return {
    sourceType: "cashapp_csv",
    sourceLine: line,
    date: parseCashAppDate(date),
    merchant,
    description: desc || merchant,
    amountUsd: amountAbs,
    kind,
    categoryHint: investing ? "investments" : "general",
    symbolHint,
    externalId: map.transaction_id ?? map.id,
    investmentPurchase: investing && Boolean(symbolHint),
  };
}

export const cashAppCsvImporter: StatementImporter = {
  id: "cashapp_csv",
  label: "Cash App CSV (P2P)",
  canParse: (headers) => {
    const h = headers.map(normalizeHeader);
    if (h.includes("asset_type") || h.includes("transaction_type")) return false;
    return (
      (h.includes("transaction_id") || h.includes("status")) &&
      (h.includes("amount") || h.includes("net_amount")) &&
      (h.includes("date") || h.includes("transaction_date"))
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
