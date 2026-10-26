"""Deterministic portfolio factor math."""
from __future__ import annotations

import math
from typing import Any

EPS = 1e-6


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def pearson(a: list[float], b: list[float]) -> float | None:
    n = min(len(a), len(b))
    if n < 2:
        return None
    a = a[-n:]
    b = b[-n:]
    ma = sum(a) / n
    mb = sum(b) / n
    num = sum((a[i] - ma) * (b[i] - mb) for i in range(n))
    da = math.sqrt(sum((x - ma) ** 2 for x in a))
    db = math.sqrt(sum((x - mb) ** 2 for x in b))
    if da < EPS or db < EPS:
        return None
    return num / (da * db)


def log_returns(prices: list[float]) -> list[float]:
    out: list[float] = []
    for i in range(1, len(prices)):
        p0, p1 = prices[i - 1], prices[i]
        if p0 > 0 and p1 > 0:
            out.append(math.log(p1 / p0))
    return out


def std_dev(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    m = sum(values) / len(values)
    var = sum((x - m) ** 2 for x in values) / (len(values) - 1)
    return math.sqrt(max(0.0, var))


def compute_drawdown(prices: list[float], window: int) -> float | None:
    if len(prices) < window:
        return None
    window_prices = prices[-window:]
    peak = max(window_prices)
    last = window_prices[-1]
    if peak <= 0:
        return None
    return (last - peak) / peak


def compute_factors_for_holding(
    prices: list[float],
    market_value: float,
    portfolio_total: float,
    log_returns_portfolio: list[float] | None = None,
    log_returns_benchmark: list[float] | None = None,
) -> dict[str, Any]:
    """Compute factor snapshot fields from daily close series (oldest first)."""
    t = len(prices)
    data_points = t

    result: dict[str, Any] = {
        "return_5d": None,
        "return_20d": None,
        "vol_20d": None,
        "drawdown_30d": None,
        "drawdown_60d": None,
        "trend_score": None,
        "mean_reversion_score": None,
        "concentration_pct": None,
        "corr_to_portfolio": None,
        "corr_to_benchmark": None,
        "data_points": data_points,
    }

    if portfolio_total > 0:
        result["concentration_pct"] = (market_value / portfolio_total) * 100.0

    if t >= 6 and prices[-6] > 0:
        result["return_5d"] = (prices[-1] / prices[-6]) - 1.0

    if t >= 21 and prices[-21] > 0:
        result["return_20d"] = (prices[-1] / prices[-21]) - 1.0

    rets = log_returns(prices)
    if len(rets) >= 20:
        vol_slice = rets[-20:]
        result["vol_20d"] = std_dev(vol_slice) * math.sqrt(252)

    result["drawdown_30d"] = compute_drawdown(prices, 30)
    result["drawdown_60d"] = compute_drawdown(prices, 60)

    return_5d = result["return_5d"]
    return_20d = result["return_20d"]
    vol_20d = result["vol_20d"]

    if return_5d is not None and return_20d is not None and vol_20d is not None:
        raw_trend = (return_5d - return_20d / 4.0) / (vol_20d + EPS)
        result["trend_score"] = clamp(raw_trend, -3.0, 3.0) / 3.0

    if t >= 21 and vol_20d is not None and prices[-1] > 0:
        sma_20 = sum(prices[-20:]) / 20.0
        raw_mr = -(prices[-1] - sma_20) / (vol_20d * prices[-1] + EPS)
        result["mean_reversion_score"] = clamp(raw_mr, -1.0, 1.0)

    holding_rets = log_returns(prices)
    if log_returns_portfolio and len(holding_rets) >= 20 and len(log_returns_portfolio) >= 20:
        n = min(len(holding_rets), len(log_returns_portfolio), 20)
        result["corr_to_portfolio"] = pearson(holding_rets[-n:], log_returns_portfolio[-n:])

    if log_returns_benchmark and len(holding_rets) >= 20 and len(log_returns_benchmark) >= 20:
        n = min(len(holding_rets), len(log_returns_benchmark), 20)
        result["corr_to_benchmark"] = pearson(holding_rets[-n:], log_returns_benchmark[-n:])

    return result


def compute_portfolio_log_returns(
    holdings_prices: dict[int, list[float]],
    weights: dict[int, float],
) -> list[float]:
    """Weighted portfolio log-return series aligned by index."""
    if not holdings_prices:
        return []
    min_len = min(len(p) for p in holdings_prices.values())
    if min_len < 2:
        return []

    total_w = sum(weights.values()) or 1.0
    out: list[float] = []
    for i in range(1, min_len):
        port_ret = 0.0
        for hid, prices in holdings_prices.items():
            w = weights.get(hid, 0.0) / total_w
            p0, p1 = prices[i - 1], prices[i]
            if p0 > 0 and p1 > 0:
                port_ret += w * math.log(p1 / p0)
        out.append(port_ret)
    return out
