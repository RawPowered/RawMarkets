import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeFactorsForHolding,
  computePortfolioLogReturns,
} from "../src/lib/portfolioFactors";
import { aggregateNews, computeForecast } from "../src/lib/portfolioForecast";
import { computeHoldingAction } from "../src/lib/portfolioResearchMerge";

describe("portfolioResearchJob fallback path", () => {
  it("typescript fallback produces factors, forecast, and action", () => {
    const prices: number[] = [];
    let p = 50;
    for (let i = 0; i < 30; i++) {
      p *= 1.005;
      prices.push(p);
    }

    const factors = computeFactorsForHolding(prices, 500, 1000);
    const forecast = computeForecast(factors, aggregateNews([]));
    const action = computeHoldingAction(factors, forecast, {
      signalCodes: [],
      targetPct: 10,
      dayChangePct: 1,
    });

    assert.ok(factors.return_20d != null);
    assert.ok(forecast.prob_up_5d > 0);
    assert.ok(["add", "hold", "trim", "reduce", "no_add"].includes(action.action));
  });

  it("portfolio log returns align with holdings", () => {
    const map = new Map<number, number[]>([
      [1, [100, 101, 102]],
      [2, [200, 202, 204]],
    ]);
    const weights = new Map<number, number>([
      [1, 100],
      [2, 200],
    ]);
    const rets = computePortfolioLogReturns(map, weights);
    assert.equal(rets.length, 2);
  });
});
