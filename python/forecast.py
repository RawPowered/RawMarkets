"""First-pass forecast heuristics (deterministic)."""
from __future__ import annotations

import json
import math
from typing import Any

EPS = 1e-6


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def n(v: float | None, default: float = 0.0) -> float:
    return default if v is None else float(v)


def aggregate_news(news_items: list[dict[str, Any]]) -> dict[str, float]:
    if not news_items:
        return {"news_sent": 0.0, "news_bull": 0.0, "news_count": 0.0}

    weighted_sum = 0.0
    weight_total = 0.0
    bull = 0
    for item in news_items:
        sentiment = n(item.get("sentiment"))
        confidence = n(item.get("confidence"), 0.3)
        novelty = n(item.get("novelty"), 0.5)
        w = confidence * (1.0 - math.exp(-novelty))
        weighted_sum += sentiment * w
        weight_total += w
        if sentiment > 0.2:
            bull += 1

    news_sent = weighted_sum / weight_total if weight_total > EPS else 0.0
    news_bull = bull / max(1, len(news_items))
    return {
        "news_sent": news_sent,
        "news_bull": news_bull,
        "news_count": float(len(news_items)),
    }


def compute_forecast(
    factors: dict[str, Any],
    news_agg: dict[str, float],
) -> dict[str, Any]:
    trend = n(factors.get("trend_score"))
    mean_rev = n(factors.get("mean_reversion_score"))
    return_20d = n(factors.get("return_20d"))
    vol_20d = n(factors.get("vol_20d"))
    dd_30 = n(factors.get("drawdown_30d"))
    dd_60 = n(factors.get("drawdown_60d"))
    news_sent = n(news_agg.get("news_sent"))

    momentum = 0.45 * trend + 0.25 * mean_rev
    risk_pen = 0.35 * abs(dd_30) + 0.20 * min(vol_20d, 0.8)
    news_adj = 0.15 * news_sent

    score_5d = momentum - risk_pen + news_adj
    score_20d = (
        0.6 * momentum
        + 0.3 * (return_20d / (vol_20d + 0.01))
        - 0.5 * risk_pen
        + 0.1 * news_sent
    )

    prob_up_5d = clamp(0.5 + 0.35 * math.tanh(score_5d), 0.05, 0.95)
    prob_up_20d = clamp(0.5 + 0.30 * math.tanh(score_20d), 0.05, 0.95)

    daily_vol = vol_20d / math.sqrt(252) if vol_20d > 0 else 0.0
    mid = (
        prob_up_5d * (daily_vol * 5)
        - (1.0 - prob_up_5d) * (daily_vol * 3)
    )
    expected_return_low_5d = mid - daily_vol * 2
    expected_return_high_5d = mid + daily_vol * 2
    downside_risk_low_5d = min(0.0, -abs(dd_30) * 0.5 - daily_vol)
    downside_risk_high_5d = min(0.0, -abs(dd_60) * 0.3)

    if vol_20d > 0.45 and dd_30 < -0.10:
        regime = "stress"
    elif vol_20d < 0.20 and abs(trend) < 0.25:
        regime = "range"
    elif trend > 0.35 and news_sent > 0:
        regime = "risk_on"
    elif dd_30 < -0.05 or news_sent < -0.2:
        regime = "risk_off"
    else:
        regime = "range"

    inputs = {
        "factors": factors,
        "news_agg": news_agg,
        "score_5d": score_5d,
        "score_20d": score_20d,
        "momentum": momentum,
        "risk_pen": risk_pen,
    }

    return {
        "prob_up_5d": prob_up_5d,
        "prob_up_20d": prob_up_20d,
        "expected_return_low_5d": expected_return_low_5d,
        "expected_return_high_5d": expected_return_high_5d,
        "downside_risk_low_5d": downside_risk_low_5d,
        "downside_risk_high_5d": downside_risk_high_5d,
        "regime": regime,
        "inputs_json": inputs,
    }


def forecast_to_json(forecast: dict[str, Any]) -> str:
    return json.dumps(forecast)
