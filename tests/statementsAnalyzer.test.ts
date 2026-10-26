import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseStatementCsv } from "../src/features/statements-analyzer/services/parseStatementCsv";
import { classifyInvestmentRows } from "../src/features/statements-analyzer/services/classifyInvestmentRows";
import {
  classifyInvestmentTransactions,
  investmentTransactionsFromRows,
} from "../src/features/statements-analyzer/services/classifyInvestmentTransactions";
import { mapToPortfolioDrafts } from "../src/features/statements-analyzer/services/mapToPortfolioDrafts";
import { buildExpenseBreakdown } from "../src/features/statements-analyzer/services/buildExpenseBreakdown";

function fixture(name: string): string {
  return fs.readFileSync(
    path.join(process.cwd(), "tests", "fixtures", "statements", name),
    "utf8"
  );
}

test("cash app investing csv maps asset type and prices", () => {
  const parsed = parseStatementCsv(fixture("cashapp_investing_sample.csv"));
  assert.equal(parsed.importerId, "cashapp_investing_csv");
  const investmentRows = classifyInvestmentRows(parsed.rows);
  assert.equal(investmentRows.length, 4);
  const drafts = mapToPortfolioDrafts(investmentRows);
  assert.equal(drafts[0].symbol, "DEMO");
  assert.equal(drafts[0].entry_price, 25);
  assert.equal(drafts[0].dollars_invested, 2.5);
  assert.equal(drafts[0].entry_date, "2025-06-02");
  const btc = drafts.find((d) => d.symbol === "BTC");
  assert.ok(btc);
  assert.equal(btc?.entry_price, 100000);
  assert.equal(btc?.dollars_invested, 1);
  const testAsset = drafts.find((d) => d.symbol === "TST-B");
  assert.ok(testAsset);
  assert.equal(testAsset?.entry_price, 40);
  assert.equal(testAsset?.dollars_invested, 4);
  assert.ok(!drafts.some((d) => d.symbol === "OF"));
});

test("cash app investing csv parses stock sell rows", () => {
  const parsed = parseStatementCsv(
    fixture("cashapp_investing_sell_sample.csv")
  );
  const investmentRows = classifyInvestmentTransactions(parsed.rows);
  assert.equal(investmentRows.length, 2);
  const txs = investmentTransactionsFromRows(parsed.rows);
  assert.equal(txs.length, 2);
  const sell = txs.find((t) => t.tx_type === "sell");
  assert.ok(sell);
  assert.equal(sell?.symbol, "DEMO");
  assert.equal(sell?.shares, 0.1);
  assert.equal(sell?.price, 100);
});

test("cash app p2p csv parsing detects explicit buy tickers", () => {
  const parsed = parseStatementCsv(fixture("cashapp_sample.csv"));
  assert.equal(parsed.importerId, "cashapp_csv");
  const investmentRows = classifyInvestmentRows(parsed.rows);
  assert.equal(investmentRows.length, 2);
  const drafts = mapToPortfolioDrafts(investmentRows);
  assert.equal(drafts.length, 2);
  assert.ok(drafts.some((d) => d.symbol === "BTC"));
  assert.ok(!drafts.some((d) => d.symbol === "OF"));
});

test("generic csv builds expense breakdown and wealth checks", () => {
  const parsed = parseStatementCsv(fixture("generic_bank_sample.csv"));
  assert.equal(parsed.importerId, "generic_csv");
  const breakdown = buildExpenseBreakdown(parsed.rows);
  assert.equal(breakdown.totalSpendUsd > 0, true);
  assert.equal(breakdown.categories.length > 0, true);
  assert.equal(breakdown.wealthChecks.length >= 3, true);
});
