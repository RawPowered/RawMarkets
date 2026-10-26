export type InvestmentTxType = "buy" | "sell";

export interface InvestmentTransaction {
  symbol: string;
  tx_date: string;
  tx_type: InvestmentTxType;
  shares: number;
  price: number;
  amount_usd: number;
  source_line?: number;
}

export interface PositionHistoryEntry extends InvestmentTransaction {
  avgCostAfter?: number;
}

export interface ComputedSymbolPosition {
  symbol: string;
  netShares: number;
  avgEntryPrice: number;
  totalCost: number;
  firstEntryDate: string | null;
  history: {
    buys: PositionHistoryEntry[];
    sells: PositionHistoryEntry[];
  };
}

function sortTxs(txs: InvestmentTransaction[]): InvestmentTransaction[] {
  return [...txs].sort((a, b) => {
    const d = a.tx_date.localeCompare(b.tx_date);
    if (d !== 0) return d;
    return (a.source_line ?? 0) - (b.source_line ?? 0);
  });
}

export function computePositionFromTransactions(
  symbol: string,
  txs: InvestmentTransaction[]
): ComputedSymbolPosition {
  const sym = symbol.trim().toUpperCase();
  let netShares = 0;
  let totalCost = 0;
  let firstEntryDate: string | null = null;
  const buys: PositionHistoryEntry[] = [];
  const sells: PositionHistoryEntry[] = [];

  for (const tx of sortTxs(txs)) {
    if (tx.tx_type === "buy") {
      const shares = Math.max(0, tx.shares);
      const amount = tx.amount_usd > 0 ? tx.amount_usd : shares * tx.price;
      if (shares <= 0) continue;
      netShares += shares;
      totalCost += amount;
      if (!firstEntryDate) firstEntryDate = tx.tx_date;
      buys.push({
        ...tx,
        avgCostAfter: netShares > 0 ? totalCost / netShares : tx.price,
      });
    } else {
      const sellShares = Math.max(0, tx.shares);
      if (sellShares <= 0) continue;
      const avgBefore = netShares > 0 ? totalCost / netShares : tx.price;
      const applied = Math.min(sellShares, netShares);
      netShares = Math.max(0, netShares - applied);
      totalCost = netShares > 0 ? netShares * avgBefore : 0;
      sells.push({
        ...tx,
        shares: applied,
        avgCostAfter: netShares > 0 ? totalCost / netShares : 0,
      });
    }
  }

  const avgEntryPrice =
    netShares > 0 ? parseFloat((totalCost / netShares).toFixed(6)) : 0;

  return {
    symbol: sym,
    netShares: parseFloat(netShares.toFixed(6)),
    avgEntryPrice,
    totalCost: parseFloat(totalCost.toFixed(2)),
    firstEntryDate,
    history: { buys, sells },
  };
}

export function computePositionsBySymbol(
  txs: InvestmentTransaction[]
): ComputedSymbolPosition[] {
  const bySymbol = new Map<string, InvestmentTransaction[]>();
  for (const tx of txs) {
    const sym = tx.symbol.trim().toUpperCase();
    const list = bySymbol.get(sym) ?? [];
    list.push(tx);
    bySymbol.set(sym, list);
  }
  return [...bySymbol.entries()].map(([symbol, list]) =>
    computePositionFromTransactions(symbol, list)
  );
}
