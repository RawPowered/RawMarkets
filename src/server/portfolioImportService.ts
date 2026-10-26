import { classifySymbol } from "../lib/portfolioTaxonomy";
import { setCustomAsset } from "./db";
import {
  computePositionFromTransactions,
  type InvestmentTransaction,
} from "../features/statements-analyzer/services/computePositionFromTransactions";
import {
  createPortfolioHolding,
  deletePortfolioHolding,
  listPortfolioHoldings,
  updatePortfolioHolding,
  type PortfolioHoldingRow,
} from "./portfolioDb";
import {
  insertPortfolioTransactions,
  listTransactionsBySymbol,
  type InsertPortfolioTransactionInput,
} from "./portfolioTransactionsDb";

export interface RecomputeHoldingResult {
  action: "created" | "updated" | "deleted";
  id?: number;
  symbol: string;
}

export interface ImportStatementTransactionInput {
  symbol: string;
  tx_date: string;
  tx_type: "buy" | "sell";
  shares: number;
  price: number;
  amount_usd: number;
  source_line?: number;
}

export interface ImportStatementsResult {
  success: boolean;
  transactionsImported: number;
  symbolsUpdated: string[];
  consolidated: number;
}

function registerCustomAssetForSymbol(
  symbol: string,
  entryPrice: number,
  taxonomy: ReturnType<typeof classifySymbol>
): void {
  const key = symbol.toUpperCase();
  const category =
    taxonomy.wealth_bucket === "precious_metals"
      ? "METALS"
      : taxonomy.wealth_bucket === "energy"
        ? "ENERGY"
        : "MARKETS";
  setCustomAsset(key, {
    name: key,
    symbol: key,
    unit: "USD per Share",
    current: entryPrice,
    open: entryPrice,
    high: entryPrice,
    low: entryPrice,
    volume: 0,
    change: 0,
    changePercent: "+0.00%",
    history: [],
    category,
    desc: `Portfolio holding — ${taxonomy.barbell_side} / ${taxonomy.fragility}`,
  });
}

function holdingsForSymbol(
  holdings: PortfolioHoldingRow[],
  symbol: string,
  activeOnly = true
): PortfolioHoldingRow[] {
  const sym = symbol.trim().toUpperCase();
  return holdings.filter(
    (h) =>
      h.symbol === sym && (!activeOnly || h.archived_at == null)
  );
}

export function recomputeHoldingForSymbol(
  symbol: string
): RecomputeHoldingResult {
  const sym = symbol.trim().toUpperCase();
  const dbTxs = listTransactionsBySymbol(sym);
  const position = computePositionFromTransactions(
    sym,
    dbTxs.map(txRowToInvestment)
  );
  const allHoldings = listPortfolioHoldings({ activeOnly: false });
  const existing = holdingsForSymbol(allHoldings, sym, true);
  const result = upsertHoldingFromPosition(sym, position, existing);
  return { ...result, symbol: sym };
}

export function insertManualBuyTransaction(input: {
  symbol: string;
  tx_date: string;
  shares: number;
  price: number;
  amount_usd: number;
}): number {
  return insertPortfolioTransactions([
    {
      symbol: input.symbol.trim().toUpperCase(),
      tx_date: input.tx_date,
      tx_type: "buy",
      shares: input.shares,
      price: input.price,
      amount_usd: input.amount_usd,
      source: "manual",
      source_line: null,
    },
  ]);
}

function txRowToInvestment(tx: {
  symbol: string;
  tx_date: string;
  tx_type: "buy" | "sell";
  shares: number;
  price: number;
  amount_usd: number;
}): InvestmentTransaction {
  return {
    symbol: tx.symbol,
    tx_date: tx.tx_date,
    tx_type: tx.tx_type,
    shares: tx.shares,
    price: tx.price,
    amount_usd: tx.amount_usd,
  };
}

function upsertHoldingFromPosition(
  symbol: string,
  position: ReturnType<typeof computePositionFromTransactions>,
  existing: PortfolioHoldingRow[]
): { action: "created" | "updated" | "deleted"; id?: number } {
  const sym = symbol.trim().toUpperCase();
  const taxonomy = classifySymbol(sym);

  if (position.netShares <= 0 || position.avgEntryPrice <= 0) {
    for (const h of existing) {
      deletePortfolioHolding(h.id);
    }
    return { action: "deleted" };
  }

  const primary = existing.sort((a, b) => a.id - b.id)[0];
  const payload = {
    symbol: sym,
    entry_date: position.firstEntryDate ?? new Date().toISOString().slice(0, 10),
    entry_mode: "shares" as const,
    shares: position.netShares,
    entry_price: position.avgEntryPrice,
    dollars_invested: parseFloat(
      (position.netShares * position.avgEntryPrice).toFixed(2)
    ),
    barbell_side: taxonomy.barbell_side,
    wealth_bucket: taxonomy.wealth_bucket,
    fragility: taxonomy.fragility,
  };

  if (primary) {
    updatePortfolioHolding(primary.id, payload);
    registerCustomAssetForSymbol(sym, payload.entry_price, taxonomy);
    for (const extra of existing.filter((h) => h.id !== primary.id)) {
      deletePortfolioHolding(extra.id);
    }
    return { action: "updated", id: primary.id };
  }

  registerCustomAssetForSymbol(sym, payload.entry_price, taxonomy);
  const created = createPortfolioHolding(payload);
  return { action: "created", id: created.id };
}

export function importStatementTransactions(
  inputs: ImportStatementTransactionInput[]
): ImportStatementsResult {
  const toInsert: InsertPortfolioTransactionInput[] = inputs.map((t) => ({
    symbol: t.symbol.trim().toUpperCase(),
    tx_date: t.tx_date,
    tx_type: t.tx_type,
    shares: t.shares,
    price: t.price,
    amount_usd: t.amount_usd,
    source: "statement_import",
    source_line: t.source_line ?? null,
  }));

  const transactionsImported = insertPortfolioTransactions(toInsert);

  const symbols = [...new Set(toInsert.map((t) => t.symbol))];
  const symbolsUpdated: string[] = [];
  let consolidated = 0;

  for (const symbol of symbols) {
    const allHoldings = listPortfolioHoldings({ activeOnly: false });
    const existing = holdingsForSymbol(allHoldings, symbol, true);
    if (existing.length > 1) consolidated += existing.length - 1;
    const result = recomputeHoldingForSymbol(symbol);
    if (result.action !== "deleted") symbolsUpdated.push(symbol);
  }

  return {
    success: true,
    transactionsImported,
    symbolsUpdated,
    consolidated,
  };
}

export function consolidateDuplicateHoldings(): {
  success: boolean;
  symbolsConsolidated: number;
  rowsRemoved: number;
} {
  const holdings = listPortfolioHoldings({ activeOnly: true });
  const bySymbol = new Map<string, PortfolioHoldingRow[]>();
  for (const h of holdings) {
    const list = bySymbol.get(h.symbol) ?? [];
    list.push(h);
    bySymbol.set(h.symbol, list);
  }

  let symbolsConsolidated = 0;
  let rowsRemoved = 0;

  for (const [symbol, rows] of bySymbol) {
    if (rows.length <= 1) continue;
    symbolsConsolidated += 1;
    rowsRemoved += rows.length - 1;

    let totalShares = 0;
    let totalCost = 0;
    let earliest = rows[0].entry_date;
    for (const r of rows) {
      const cost = r.dollars_invested ?? r.shares * r.entry_price;
      totalShares += r.shares;
      totalCost += cost;
      if (r.entry_date < earliest) earliest = r.entry_date;
    }
    const avgPrice = totalShares > 0 ? totalCost / totalShares : 0;
    const position = computePositionFromTransactions(symbol, [
      {
        symbol,
        tx_date: earliest,
        tx_type: "buy",
        shares: totalShares,
        price: avgPrice,
        amount_usd: totalCost,
      },
    ]);
    position.firstEntryDate = earliest;
    upsertHoldingFromPosition(symbol, position, rows);
  }

  return { success: true, symbolsConsolidated, rowsRemoved };
}

export function findDuplicatePortfolioSymbols(): string[] {
  const counts = new Map<string, number>();
  for (const h of listPortfolioHoldings({ activeOnly: true })) {
    counts.set(h.symbol, (counts.get(h.symbol) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n > 1)
    .map(([sym]) => sym);
}
