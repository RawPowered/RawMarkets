import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import {
  computeFactorsForHolding,
  computePortfolioLogReturns,
  logReturns,
} from "../src/lib/portfolioFactors";
import { aggregateNews, computeForecast } from "../src/lib/portfolioForecast";
import { computeHoldingAction } from "../src/lib/portfolioResearchMerge";
import { isPythonAvailable } from "../src/server/pythonBridge";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = JSON.parse(
  fs.readFileSync(
    path.join(root, "tests", "fixtures", "research_prices.json"),
    "utf-8"
  )
) as {
  cases: Array<{
    name: string;
    prices: number[];
    market_value: number;
    portfolio_total: number;
    benchmark_prices: number[];
    news: Array<{ sentiment: number; confidence: number; novelty: number }>;
    signal_codes: string[];
    target_pct: number;
    day_change_pct: number;
  }>;
};

function approx(a: number | null | undefined, b: number | null | undefined, eps: number): void {
  if (a == null && b == null) return;
  assert.ok(a != null && b != null, `Expected both numbers, got ${a} vs ${b}`);
  assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b} (eps ${eps})`);
}

function runPythonCase(testCase: (typeof fixtures.cases)[0]) {
  const payload = {
    evaluated_at: Date.now(),
    portfolio_total: testCase.portfolio_total,
    benchmark_prices: testCase.benchmark_prices,
    news_by_symbol: { TEST: testCase.news },
    portfolio_signals: [],
    holdings: [
      {
        holding_id: 1,
        symbol: "TEST",
        prices: testCase.prices,
        market_value: testCase.market_value,
        target_pct: testCase.target_pct,
        day_change_pct: testCase.day_change_pct,
        signal_codes: testCase.signal_codes,
      },
    ],
  };

  const cli = path.join(root, "python", "research_cli.py");
  const r = spawnSync("py", ["-3", cli], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    cwd: root,
    shell: true,
    timeout: 15_000,
  });

  assert.equal(r.status, 0, r.stderr || r.stdout);
  return JSON.parse(r.stdout) as {
    ok: boolean;
    holdings?: Array<{
      factors: Record<string, number | null>;
      forecast: Record<string, unknown>;
      action: Record<string, unknown>;
    }>;
  };
}

describe("pythonTsParity", () => {
  for (const testCase of fixtures.cases) {
    it(`TS mirrors Python for ${testCase.name}`, () => {
      const holdingsPrices = new Map<number, number[]>([[1, testCase.prices]]);
      const weights = new Map<number, number>([[1, testCase.market_value]]);
      const portLogRets = computePortfolioLogReturns(holdingsPrices, weights);
      const benchLogRets =
        testCase.benchmark_prices.length >= 2
          ? logReturns(testCase.benchmark_prices)
          : null;

      const factors = computeFactorsForHolding(
        testCase.prices,
        testCase.market_value,
        testCase.portfolio_total,
        portLogRets,
        benchLogRets
      );
      const forecast = computeForecast(factors, aggregateNews(testCase.news));
      const action = computeHoldingAction(factors, forecast, {
        signalCodes: testCase.signal_codes,
        targetPct: testCase.target_pct,
        dayChangePct: testCase.day_change_pct,
      });

      assert.ok(factors.data_points > 0);

      if (!isPythonAvailable(root)) {
        return;
      }

      const py = runPythonCase(testCase);
      assert.equal(py.ok, true);
      const ph = py.holdings?.[0];
      assert.ok(ph);

      const pf = ph.factors;
      approx(factors.return_5d, pf.return_5d as number, 1e-6);
      approx(factors.return_20d, pf.return_20d as number, 1e-6);
      approx(factors.vol_20d, pf.vol_20d as number, 1e-6);
      approx(factors.drawdown_30d, pf.drawdown_30d as number, 1e-6);
      approx(factors.trend_score, pf.trend_score as number, 1e-6);

      const pfc = ph.forecast;
      approx(forecast.prob_up_5d, Number(pfc.prob_up_5d), 1e-4);
      approx(forecast.prob_up_20d, Number(pfc.prob_up_20d), 1e-4);
      assert.equal(forecast.regime, String(pfc.regime));

      const pa = ph.action;
      assert.equal(action.action, String(pa.action));
      assert.equal(action.reason_code, String(pa.reason_code));
    });
  }
});
