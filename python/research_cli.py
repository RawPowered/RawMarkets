#!/usr/bin/env python3
"""Portfolio research CLI — stdin JSON, stdout JSON."""
from __future__ import annotations

import json
import sys

from actions import compute_holding_action, compute_portfolio_actions
from factors import compute_factors_for_holding, compute_portfolio_log_returns
from forecast import aggregate_news, compute_forecast


def run(payload: dict) -> dict:
    holdings = payload.get("holdings") or []
    portfolio_total = float(payload.get("portfolio_total") or 0)
    benchmark_prices = payload.get("benchmark_prices") or []
    news_by_symbol = payload.get("news_by_symbol") or {}
    portfolio_signals = payload.get("portfolio_signals") or []
    evaluated_at = int(payload.get("evaluated_at") or 0)

    holdings_prices: dict[int, list[float]] = {}
    weights: dict[int, float] = {}
    for h in holdings:
        hid = int(h["holding_id"])
        prices = [float(p) for p in h.get("prices") or []]
        holdings_prices[hid] = prices
        weights[hid] = float(h.get("market_value") or 0)

    port_log_rets = compute_portfolio_log_returns(holdings_prices, weights)
    bench_log_rets = None
    if len(benchmark_prices) >= 2:
        from factors import log_returns

        bench_log_rets = log_returns([float(p) for p in benchmark_prices])

    results = []
    for h in holdings:
        hid = int(h["holding_id"])
        symbol = str(h.get("symbol") or "").upper()
        prices = holdings_prices.get(hid) or []
        market_value = float(h.get("market_value") or 0)

        factors = compute_factors_for_holding(
            prices,
            market_value,
            portfolio_total,
            port_log_rets,
            bench_log_rets,
        )

        news_items = news_by_symbol.get(symbol) or []
        news_agg = aggregate_news(news_items)
        forecast = compute_forecast(factors, news_agg)

        context = {
            "signal_codes": h.get("signal_codes") or [],
            "target_pct": h.get("target_pct"),
            "day_change_pct": h.get("day_change_pct"),
        }
        action = compute_holding_action(factors, forecast, context)

        results.append(
            {
                "holding_id": hid,
                "symbol": symbol,
                "factors": factors,
                "forecast": forecast,
                "action": action,
            }
        )

    portfolio_actions = compute_portfolio_actions(portfolio_signals, evaluated_at)

    return {
        "ok": True,
        "engine": "python",
        "evaluated_at": evaluated_at,
        "holdings": results,
        "portfolio_actions": portfolio_actions,
    }


def main() -> int:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
        out = run(payload)
        sys.stdout.write(json.dumps(out))
        return 0
    except Exception as exc:
        sys.stdout.write(json.dumps({"ok": False, "error": str(exc)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
