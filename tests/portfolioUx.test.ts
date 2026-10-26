import test from "node:test";
import assert from "node:assert/strict";
import {
  computePositionFromTransactions,
  type InvestmentTransaction,
} from "../src/features/statements-analyzer/services/computePositionFromTransactions";
import { computeAggregates, type EnrichedHoldingInput } from "../src/lib/portfolioSignals";
import type { PortfolioHoldingRow } from "../src/server/portfolioDb";

function holdingRow(
  partial: Partial<PortfolioHoldingRow> & { symbol: string; shares: number; entry_price: number }
): PortfolioHoldingRow {
  return {
    id: partial.id ?? 1,
    symbol: partial.symbol,
    entry_date: partial.entry_date ?? "2026-01-01",
    entry_mode: partial.entry_mode ?? "shares",
    shares: partial.shares,
    entry_price: partial.entry_price,
    dollars_invested: partial.dollars_invested ?? partial.shares * partial.entry_price,
    barbell_side: partial.barbell_side ?? "aggressive",
    wealth_bucket: partial.wealth_bucket ?? "public_equities",
    fragility: partial.fragility ?? "speculative",
    target_pct: null,
    take_profit_pct: null,
    stop_loss_pct: null,
    kelly_p: null,
    kelly_b: null,
    archived_at: partial.archived_at ?? null,
    created_at: 0,
    updated_at: 0,
  };
}

function enrichedInput(h: PortfolioHoldingRow): EnrichedHoldingInput {
  const cost = h.dollars_invested ?? h.shares * h.entry_price;
  return {
    holding: h,
    currentPrice: h.entry_price,
    dayChangePct: 0,
    marketValue: cost,
    costBasis: cost,
    pnlUsd: 0,
    pnlPct: 0,
  };
}

test("flipping buy to sell recalculates net shares", () => {
  const txs: InvestmentTransaction[] = [
    {
      symbol: "HOOD",
      tx_date: "2026-01-01",
      tx_type: "buy",
      shares: 10,
      price: 10,
      amount_usd: 100,
    },
    {
      symbol: "HOOD",
      tx_date: "2026-02-01",
      tx_type: "sell",
      shares: 4,
      price: 12,
      amount_usd: 48,
    },
  ];
  const partial = computePositionFromTransactions("HOOD", txs);
  assert.equal(partial.netShares, 6);
  const fullExit = computePositionFromTransactions("HOOD", [
    txs[0],
    { ...txs[1], shares: 10 },
  ]);
  assert.equal(fullExit.netShares, 0);
});

test("aggregates use only non-archived positions in caller filter", () => {
  const active = holdingRow({ symbol: "AAPL", shares: 2, entry_price: 100 });
  const archived = holdingRow({
    symbol: "MSFT",
    shares: 5,
    entry_price: 200,
    archived_at: Date.now(),
  });
  const activeOnly = [enrichedInput(active)];
  const withArchived = [enrichedInput(active), enrichedInput(archived)];
  const aggActive = computeAggregates(activeOnly, 0);
  const aggAll = computeAggregates(withArchived, 0);
  assert.equal(aggActive.totalCost, 200);
  assert.equal(aggAll.totalCost, 1200);
});

test("manual merge weighted average from two buys", () => {
  const pos = computePositionFromTransactions("AAPL", [
    {
      symbol: "AAPL",
      tx_date: "2026-01-01",
      tx_type: "buy",
      shares: 1,
      price: 100,
      amount_usd: 100,
    },
    {
      symbol: "AAPL",
      tx_date: "2026-02-01",
      tx_type: "buy",
      shares: 1,
      price: 200,
      amount_usd: 200,
    },
  ]);
  assert.equal(pos.netShares, 2);
  assert.equal(pos.avgEntryPrice, 150);
});
