/** Deterministic portfolio factor math (TypeScript mirror of python/factors.py). */

const EPS = 1e-6;

export interface ComputedFactors {
  return_5d: number | null;
  return_20d: number | null;
  vol_20d: number | null;
  drawdown_30d: number | null;
  drawdown_60d: number | null;
  trend_score: number | null;
  mean_reversion_score: number | null;
  concentration_pct: number | null;
  corr_to_portfolio: number | null;
  corr_to_benchmark: number | null;
  data_points: number;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function pearson(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 2) return null;
  const xs = a.slice(-n);
  const ys = b.slice(-n);
  const ma = xs.reduce((s, v) => s + v, 0) / n;
  const mb = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const xa = xs[i] - ma;
    const xb = ys[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  if (da < EPS || db < EPS) return null;
  return num / (Math.sqrt(da) * Math.sqrt(db));
}

export function logReturns(prices: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const p0 = prices[i - 1];
    const p1 = prices[i];
    if (p0 > 0 && p1 > 0) out.push(Math.log(p1 / p0));
  }
  return out;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((s, v) => s + v, 0) / values.length;
  const v =
    values.reduce((s, x) => s + (x - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(Math.max(0, v));
}

function computeDrawdown(prices: number[], window: number): number | null {
  if (prices.length < window) return null;
  const slice = prices.slice(-window);
  const peak = Math.max(...slice);
  const last = slice[slice.length - 1];
  if (peak <= 0) return null;
  return (last - peak) / peak;
}

export function computeFactorsForHolding(
  prices: number[],
  marketValue: number,
  portfolioTotal: number,
  logReturnsPortfolio?: number[] | null,
  logReturnsBenchmark?: number[] | null
): ComputedFactors {
  const t = prices.length;
  const result: ComputedFactors = {
    return_5d: null,
    return_20d: null,
    vol_20d: null,
    drawdown_30d: null,
    drawdown_60d: null,
    trend_score: null,
    mean_reversion_score: null,
    concentration_pct: null,
    corr_to_portfolio: null,
    corr_to_benchmark: null,
    data_points: t,
  };

  if (portfolioTotal > 0) {
    result.concentration_pct = (marketValue / portfolioTotal) * 100;
  }

  if (t >= 6 && prices[t - 6] > 0) {
    result.return_5d = prices[t - 1] / prices[t - 6] - 1;
  }

  if (t >= 21 && prices[t - 21] > 0) {
    result.return_20d = prices[t - 1] / prices[t - 21] - 1;
  }

  const rets = logReturns(prices);
  if (rets.length >= 20) {
    const volSlice = rets.slice(-20);
    result.vol_20d = stdDev(volSlice) * Math.sqrt(252);
  }

  result.drawdown_30d = computeDrawdown(prices, 30);
  result.drawdown_60d = computeDrawdown(prices, 60);

  const return5d = result.return_5d;
  const return20d = result.return_20d;
  const vol20d = result.vol_20d;

  if (return5d != null && return20d != null && vol20d != null) {
    const rawTrend = (return5d - return20d / 4) / (vol20d + EPS);
    result.trend_score = clamp(rawTrend, -3, 3) / 3;
  }

  if (t >= 21 && vol20d != null && prices[t - 1] > 0) {
    const sma20 = prices.slice(-20).reduce((s, v) => s + v, 0) / 20;
    const rawMr = -(prices[t - 1] - sma20) / (vol20d * prices[t - 1] + EPS);
    result.mean_reversion_score = clamp(rawMr, -1, 1);
  }

  const holdingRets = logReturns(prices);
  if (
    logReturnsPortfolio &&
    holdingRets.length >= 20 &&
    logReturnsPortfolio.length >= 20
  ) {
    const n = Math.min(holdingRets.length, logReturnsPortfolio.length, 20);
    result.corr_to_portfolio = pearson(
      holdingRets.slice(-n),
      logReturnsPortfolio.slice(-n)
    );
  }

  if (
    logReturnsBenchmark &&
    holdingRets.length >= 20 &&
    logReturnsBenchmark.length >= 20
  ) {
    const n = Math.min(holdingRets.length, logReturnsBenchmark.length, 20);
    result.corr_to_benchmark = pearson(
      holdingRets.slice(-n),
      logReturnsBenchmark.slice(-n)
    );
  }

  return result;
}

export function computePortfolioLogReturns(
  holdingsPrices: Map<number, number[]>,
  weights: Map<number, number>
): number[] {
  if (holdingsPrices.size === 0) return [];
  const minLen = Math.min(
    ...[...holdingsPrices.values()].map((p) => p.length)
  );
  if (minLen < 2) return [];

  const totalW =
    [...weights.values()].reduce((s, v) => s + v, 0) || 1;
  const out: number[] = [];

  for (let i = 1; i < minLen; i++) {
    let portRet = 0;
    for (const [hid, prices] of holdingsPrices) {
      const w = (weights.get(hid) ?? 0) / totalW;
      const p0 = prices[i - 1];
      const p1 = prices[i];
      if (p0 > 0 && p1 > 0) portRet += w * Math.log(p1 / p0);
    }
    out.push(portRet);
  }
  return out;
}
