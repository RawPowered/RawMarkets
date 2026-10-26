/** First-pass forecast heuristics (TypeScript mirror of python/forecast.py). */

import type { ComputedFactors } from "./portfolioFactors";

const EPS = 1e-6;

export type PortfolioRegime = "risk_on" | "risk_off" | "range" | "stress";

export interface NewsAgg {
  news_sent: number;
  news_bull: number;
  news_count: number;
}

export interface NewsItemInput {
  sentiment?: number | null;
  confidence?: number | null;
  novelty?: number | null;
}

export interface ComputedForecast {
  prob_up_5d: number;
  prob_up_20d: number;
  expected_return_low_5d: number;
  expected_return_high_5d: number;
  downside_risk_low_5d: number;
  downside_risk_high_5d: number;
  regime: PortfolioRegime;
  inputs_json: Record<string, unknown>;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function n(v: number | null | undefined, defaultVal = 0): number {
  return v == null ? defaultVal : v;
}

export function aggregateNews(newsItems: NewsItemInput[]): NewsAgg {
  if (newsItems.length === 0) {
    return { news_sent: 0, news_bull: 0, news_count: 0 };
  }

  let weightedSum = 0;
  let weightTotal = 0;
  let bull = 0;

  for (const item of newsItems) {
    const sentiment = n(item.sentiment);
    const confidence = n(item.confidence, 0.3);
    const novelty = n(item.novelty, 0.5);
    const w = confidence * (1 - Math.exp(-novelty));
    weightedSum += sentiment * w;
    weightTotal += w;
    if (sentiment > 0.2) bull++;
  }

  return {
    news_sent: weightTotal > EPS ? weightedSum / weightTotal : 0,
    news_bull: bull / Math.max(1, newsItems.length),
    news_count: newsItems.length,
  };
}

export function computeForecast(
  factors: ComputedFactors,
  newsAgg: NewsAgg
): ComputedForecast {
  const trend = n(factors.trend_score);
  const meanRev = n(factors.mean_reversion_score);
  const return20d = n(factors.return_20d);
  const vol20d = n(factors.vol_20d);
  const dd30 = n(factors.drawdown_30d);
  const dd60 = n(factors.drawdown_60d);
  const newsSent = n(newsAgg.news_sent);

  const momentum = 0.45 * trend + 0.25 * meanRev;
  const riskPen = 0.35 * Math.abs(dd30) + 0.2 * Math.min(vol20d, 0.8);
  const newsAdj = 0.15 * newsSent;

  const score5d = momentum - riskPen + newsAdj;
  const score20d =
    0.6 * momentum +
    0.3 * (return20d / (vol20d + 0.01)) -
    0.5 * riskPen +
    0.1 * newsSent;

  const probUp5d = clamp(0.5 + 0.35 * Math.tanh(score5d), 0.05, 0.95);
  const probUp20d = clamp(0.5 + 0.3 * Math.tanh(score20d), 0.05, 0.95);

  const dailyVol = vol20d > 0 ? vol20d / Math.sqrt(252) : 0;
  const mid =
    probUp5d * (dailyVol * 5) - (1 - probUp5d) * (dailyVol * 3);
  const expectedReturnLow5d = mid - dailyVol * 2;
  const expectedReturnHigh5d = mid + dailyVol * 2;
  const downsideRiskLow5d = Math.min(0, -Math.abs(dd30) * 0.5 - dailyVol);
  const downsideRiskHigh5d = Math.min(0, -Math.abs(dd60) * 0.3);

  let regime: PortfolioRegime;
  if (vol20d > 0.45 && dd30 < -0.1) regime = "stress";
  else if (vol20d < 0.2 && Math.abs(trend) < 0.25) regime = "range";
  else if (trend > 0.35 && newsSent > 0) regime = "risk_on";
  else if (dd30 < -0.05 || newsSent < -0.2) regime = "risk_off";
  else regime = "range";

  return {
    prob_up_5d: probUp5d,
    prob_up_20d: probUp20d,
    expected_return_low_5d: expectedReturnLow5d,
    expected_return_high_5d: expectedReturnHigh5d,
    downside_risk_low_5d: downsideRiskLow5d,
    downside_risk_high_5d: downsideRiskHigh5d,
    regime,
    inputs_json: {
      factors,
      news_agg: newsAgg,
      score_5d: score5d,
      score_20d: score20d,
      momentum,
      risk_pen: riskPen,
    },
  };
}
