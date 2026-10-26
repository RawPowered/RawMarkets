import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeFactorsForHolding,
  logReturns,
} from "../src/lib/portfolioFactors";

/** Synthetic uptrend with mild noise — 30 daily closes. */
function fixturePrices(): number[] {
  const prices: number[] = [];
  let p = 100;
  for (let i = 0; i < 30; i++) {
    p *= 1 + (i % 3 === 0 ? 0.01 : -0.002);
    prices.push(parseFloat(p.toFixed(4)));
  }
  return prices;
}

describe("portfolioFactors", () => {
  it("computes return_5d and return_20d on 30-bar series", () => {
    const prices = fixturePrices();
    const f = computeFactorsForHolding(prices, 1000, 5000);
    assert.equal(f.data_points, 30);
    assert.ok(f.return_5d != null);
    assert.ok(f.return_20d != null);
    assert.ok(f.vol_20d != null && f.vol_20d > 0);
    assert.ok(f.drawdown_30d != null && f.drawdown_30d <= 0);
    assert.ok(f.trend_score != null);
    assert.equal(f.concentration_pct, 20);
  });

  it("returns null factors when history is too short", () => {
    const f = computeFactorsForHolding([100, 101], 100, 200);
    assert.equal(f.return_20d, null);
    assert.equal(f.vol_20d, null);
    assert.equal(f.concentration_pct, 50);
  });

  it("logReturns length is prices.length - 1", () => {
    const prices = fixturePrices();
    assert.equal(logReturns(prices).length, prices.length - 1);
  });
});
