import type { PortfolioImportDraft, ConsolidatedSymbolDraft } from "../types";
import {
  computePositionsBySymbol,
  type InvestmentTransaction,
} from "./computePositionFromTransactions";

export function mapRowsToImportDrafts(
  txs: InvestmentTransaction[],
  notesByLine: Map<number, string>
): PortfolioImportDraft[] {
  return txs.map((tx, idx) => ({
    draftId: `draft-${idx}-${tx.source_line ?? idx}`,
    sourceLine: tx.source_line ?? idx + 2,
    symbol: tx.symbol,
    entry_date: tx.tx_date,
    entry_mode: "dollars" as const,
    entry_price: tx.price,
    dollars_invested: tx.amount_usd,
    shares: tx.shares,
    tx_type: tx.tx_type,
    notes: notesByLine.get(tx.source_line ?? 0) ?? "",
    confidence: 0.95,
    status: "pending" as const,
    valid: true,
  }));
}

export function consolidateDraftsBySymbol(
  drafts: PortfolioImportDraft[]
): ConsolidatedSymbolDraft[] {
  const accepted = drafts.filter((d) => d.status !== "rejected" && d.valid);
  const txs: InvestmentTransaction[] = accepted.map((d) => ({
    symbol: d.symbol,
    tx_date: d.entry_date,
    tx_type: d.tx_type ?? "buy",
    shares: d.shares ?? d.dollars_invested / Math.max(d.entry_price, 0.0001),
    price: d.entry_price,
    amount_usd: d.dollars_invested,
    source_line: d.sourceLine,
  }));

  const positions = computePositionsBySymbol(txs);
  const lotsBySymbol = new Map<string, PortfolioImportDraft[]>();
  for (const d of accepted) {
    const list = lotsBySymbol.get(d.symbol) ?? [];
    list.push(d);
    lotsBySymbol.set(d.symbol, list);
  }

  return positions.map((pos) => {
    const lots = lotsBySymbol.get(pos.symbol) ?? [];
    const rejected = lots.some((l) => l.status === "rejected");
    return {
      symbol: pos.symbol,
      netShares: pos.netShares,
      avgEntryPrice: pos.avgEntryPrice,
      totalCost: pos.totalCost,
      firstEntryDate: pos.firstEntryDate ?? lots[0]?.entry_date ?? "",
      lotCount: lots.length,
      lots,
      status: rejected ? ("rejected" as const) : ("pending" as const),
      valid: pos.netShares > 0 && pos.avgEntryPrice > 0,
    };
  });
}
