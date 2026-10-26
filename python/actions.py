"""Deterministic portfolio action recommendations."""
from __future__ import annotations

from typing import Any


def compute_holding_action(
    factors: dict[str, Any],
    forecast: dict[str, Any],
    context: dict[str, Any],
) -> dict[str, Any]:
    """Return action dict for one holding."""
    signal_codes = set(context.get("signal_codes") or [])
    target_pct = context.get("target_pct")
    concentration_pct = factors.get("concentration_pct") or 0.0
    day_change_pct = context.get("day_change_pct")
    prob_up_5d = forecast.get("prob_up_5d", 0.5)
    prob_up_20d = forecast.get("prob_up_20d", 0.5)
    regime = forecast.get("regime", "range")
    dd_30 = factors.get("drawdown_30d")

    if "CUT" in signal_codes or "STOP_LOSS" in signal_codes:
        return {
            "action": "reduce",
            "severity": "critical",
            "reason_code": "signal_stop_loss",
            "reason": "Existing stop-loss or cut signal is active.",
            "precedence": 0,
        }

    if prob_up_5d < 0.35 and dd_30 is not None and dd_30 < -0.12:
        return {
            "action": "reduce",
            "severity": "warn",
            "reason_code": "forecast_bearish_dd",
            "reason": "Low 5d probability with deep 30d drawdown.",
            "precedence": 1,
        }

    if target_pct is not None and concentration_pct > target_pct + 5:
        return {
            "action": "trim",
            "severity": "warn",
            "reason_code": "overweight",
            "reason": f"Position {concentration_pct:.1f}% exceeds target {target_pct}% + 5%.",
            "precedence": 2,
        }

    if "KELLY_CAP" in signal_codes:
        return {
            "action": "trim",
            "severity": "warn",
            "reason_code": "overweight",
            "reason": "Above half-Kelly or target weight cap.",
            "precedence": 2,
        }

    if "FOMO_COOLDOWN" in signal_codes or (
        day_change_pct is not None
        and day_change_pct > 8
        and prob_up_5d > 0.7
    ):
        return {
            "action": "no_add",
            "severity": "warn",
            "reason_code": "fomo_guard",
            "reason": "Reflexivity spike — avoid hype adds.",
            "precedence": 3,
        }

    if (
        prob_up_20d > 0.60
        and target_pct is not None
        and concentration_pct < target_pct - 3
        and regime != "stress"
    ):
        return {
            "action": "add",
            "severity": "info",
            "reason_code": "forecast_underweight",
            "reason": "Favorable 20d outlook with room below target weight.",
            "precedence": 4,
        }

    if 0.45 <= prob_up_5d <= 0.65:
        return {
            "action": "hold",
            "severity": "info",
            "reason_code": "neutral_forecast",
            "reason": "Neutral 5d forecast — maintain position.",
            "precedence": 5,
        }

    return {
        "action": "hold",
        "severity": "info",
        "reason_code": "default",
        "reason": "No strong research signal — default hold.",
        "precedence": 99,
    }


def compute_portfolio_actions(
    portfolio_signals: list[dict[str, Any]],
    evaluated_at: int,
) -> list[dict[str, Any]]:
    """Map existing portfolio-level signals to research actions."""
    actions: list[dict[str, Any]] = []
    for sig in portfolio_signals:
        code = sig.get("code")
        if code == "BARBELL_DRIFT":
            actions.append(
                {
                    "holding_id": None,
                    "symbol": None,
                    "evaluated_at": evaluated_at,
                    "action": "trim",
                    "severity": "warn",
                    "reason_code": "barbell_drift",
                    "reason": sig.get("detail", "Barbell sleeve drift."),
                    "precedence": 10,
                }
            )
        elif code == "FRAGILITY_ALERT":
            actions.append(
                {
                    "holding_id": None,
                    "symbol": None,
                    "evaluated_at": evaluated_at,
                    "action": "reduce",
                    "severity": "critical",
                    "reason_code": "fragility_alert",
                    "reason": sig.get("detail", "High fragility exposure."),
                    "precedence": 5,
                }
            )
        elif code == "REBALANCE":
            actions.append(
                {
                    "holding_id": None,
                    "symbol": None,
                    "evaluated_at": evaluated_at,
                    "action": "hold",
                    "severity": "info",
                    "reason_code": "rebalance_nudge",
                    "reason": sig.get("detail", "Quarterly rebalance window."),
                    "precedence": 20,
                }
            )
    return actions
