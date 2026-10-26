import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAccountingUsd,
  parseCashAppDate,
  normalizeTickerSymbol,
  normalizeHeader,
} from "../src/features/statements-analyzer/importers/csvMoney";

test("parseAccountingUsd handles parentheses and currency", () => {
  assert.equal(parseAccountingUsd("($1.00)"), 1);
  assert.equal(parseAccountingUsd("$88.07"), 88.07);
  assert.equal(parseAccountingUsd("-25.00"), 25);
});

test("parseCashAppDate extracts ISO date prefix", () => {
  assert.equal(parseCashAppDate("2026-06-02 12:59:10 CDT"), "2026-06-02");
});

test("normalizeTickerSymbol maps BRK.B and bitcoin", () => {
  assert.equal(normalizeTickerSymbol("BRK.B"), "BRK-B");
  assert.equal(normalizeTickerSymbol("bitcoin"), "BTC");
});

test("normalizeHeader strips BOM", () => {
  assert.equal(normalizeHeader("\uFEFFDate"), "date");
});
