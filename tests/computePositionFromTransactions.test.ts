import test from "node:test";
import assert from "node:assert/strict";
import {
  computePositionFromTransactions,
  computePositionsBySymbol,
  type InvestmentTransaction,
} from "../src/features/statements-analyzer/services/computePositionFromTransactions";

function buy(
  symbol: string,
  date: string,
  shares: number,
  price: number
): InvestmentTransaction {
  return {
    symbol,
    tx_date: date,
    tx_type: "buy",
    shares,
    price,
    amount_usd: shares * price,
  };
}

function sell(
  symbol: string,
  date: string,
  shares: number,
  price: number
): InvestmentTransaction {
  return {
    symbol,
    tx_date: date,
    tx_type: "sell",
    shares,
    price,
    amount_usd: shares * price,
  };
}

test("multiple buys produce weighted average cost", () => {
  const pos = computePositionFromTransactions("BTC", [
    buy("BTC", "2026-01-01", 1, 100),
    buy("BTC", "2026-01-15", 1, 200),
  ]);
  assert.equal(pos.netShares, 2);
  assert.equal(pos.avgEntryPrice, 150);
  assert.equal(pos.totalCost, 300);
  assert.equal(pos.firstEntryDate, "2026-01-01");
  assert.equal(pos.history.buys.length, 2);
  assert.equal(pos.history.sells.length, 0);
});

test("buy then partial sell keeps avg cost on remaining shares", () => {
  const pos = computePositionFromTransactions("HOOD", [
    buy("HOOD", "2026-01-01", 10, 10),
    sell("HOOD", "2026-02-01", 4, 12),
  ]);
  assert.equal(pos.netShares, 6);
  assert.equal(pos.avgEntryPrice, 10);
  assert.equal(pos.totalCost, 60);
  assert.equal(pos.history.sells.length, 1);
  assert.equal(pos.history.sells[0].shares, 4);
});

test("full exit zeroes position", () => {
  const pos = computePositionFromTransactions("CRWD", [
    buy("CRWD", "2026-01-01", 5, 20),
    sell("CRWD", "2026-03-01", 5, 25),
  ]);
  assert.equal(pos.netShares, 0);
  assert.equal(pos.avgEntryPrice, 0);
  assert.equal(pos.totalCost, 0);
});

test("computePositionsBySymbol groups by ticker", () => {
  const positions = computePositionsBySymbol([
    buy("BTC", "2026-01-01", 0.01, 50000),
    buy("ETH", "2026-01-02", 1, 3000),
    buy("BTC", "2026-01-10", 0.01, 60000),
  ]);
  assert.equal(positions.length, 2);
  const btc = positions.find((p) => p.symbol === "BTC");
  assert.ok(btc);
  assert.equal(btc?.netShares, 0.02);
  assert.equal(btc?.avgEntryPrice, 55000);
});
