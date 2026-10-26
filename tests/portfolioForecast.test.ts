import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeForecast, aggregateNews } from "../src/lib/portfolioForecast";
import type { ComputedFactors } from "../src/lib/portfolioFactors";

const baseFactors: ComputedFactors = {
  return_5d: 0.03,
  return_20d: 0.08,
  vol_20d: 0.25,
  drawdown_30d: -0.04,
  drawdown_60d: -0.06,
  trend_score: 0.4,
  mean_reversion_score: -0.1,
  concentration_pct: 15,
  corr_to_portfolio: 0.5,
  corr_to_benchmark: 0.6,
  data_points: 30,
};

describe("portfolioForecast", () => {
  it("produces prob_up in [0.05, 0.95]", () => {
    const news = aggregateNews([
      { sentiment: 0.3, confidence: 0.8, novelty: 0.6 },
    ]);
    const fc = computeForecast(baseFactors, news);
    assert.ok(fc.prob_up_5d >= 0.05 && fc.prob_up_5d <= 0.95);
    assert.ok(fc.prob_up_20d >= 0.05 && fc.prob_up_20d <= 0.95);
  });

  it("labels risk_on when trend high and news positive", () => {
    const news = aggregateNews([
      { sentiment: 0.5, confidence: 0.9, novelty: 0.7 },
    ]);
    const fc = computeForecast(baseFactors, news);
    assert.equal(fc.regime, "risk_on");
  });

  it("labels stress on high vol and deep drawdown", () => {
    const stressed: ComputedFactors = {
      ...baseFactors,
      vol_20d: 0.5,
      drawdown_30d: -0.15,
      trend_score: -0.2,
    };
    const fc = computeForecast(stressed, aggregateNews([]));
    assert.equal(fc.regime, "stress");
  });
});
