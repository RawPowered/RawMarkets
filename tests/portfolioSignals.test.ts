import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifySymbol } from "../src/lib/portfolioTaxonomy";
import {
  fractionalKelly,
  computeAggregates,
  computePortfolioSignals,
} from "../src/lib/portfolioSignals";
import type { PortfolioHoldingRow } from "../src/server/portfolioDb";

function mockHolding(
  partial: Partial<PortfolioHoldingRow> & { id: number; symbol: string }
): PortfolioHoldingRow {
  return {
    id: partial.id,
    symbol: partial.symbol,
    entry_date: "2026-01-01",
    entry_mode: "dollars",
    shares: 1,
    entry_price: 100,
    dollars_invested: 100,
    barbell_side: partial.barbell_side ?? "aggressive",
    wealth_bucket: partial.wealth_bucket ?? "public_equities",
    fragility: partial.fragility ?? "speculative",
    target_pct: partial.target_pct ?? null,
    take_profit_pct: partial.take_profit_pct ?? null,
    stop_loss_pct: partial.stop_loss_pct ?? null,
    kelly_p: partial.kelly_p ?? null,
    kelly_b: partial.kelly_b ?? null,
    archived_at: partial.archived_at ?? null,
    created_at: 0,
    updated_at: 0,
  };
}

describe("portfolioTaxonomy", () => {
  it("classifies GLD as safe metals", () => {
    const t = classifySymbol("GLD");
    assert.equal(t.barbell_side, "safe");
    assert.equal(t.wealth_bucket, "precious_metals");
    assert.equal(t.fragility, "hedged");
  });

  it("classifies meme tickers as ponzi fragility", () => {
    const t = classifySymbol("GME");
    assert.equal(t.fragility, "ponzi");
  });
});

describe("portfolioSignals", () => {
  it("computes half-Kelly", () => {
    const half = fractionalKelly(0.55, 2, 0.5);
    assert.ok(half != null && half > 0 && half < 0.5);
  });

  it("flags barbell drift", () => {
    const holding = mockHolding({
      id: 1,
      symbol: "GME",
      barbell_side: "aggressive",
      fragility: "ponzi",
    });
    const enriched = [
      {
        holding,
        currentPrice: 150,
        dayChangePct: 2,
        marketValue: 150,
        costBasis: 100,
        pnlUsd: 50,
        pnlPct: 50,
      },
    ];
    const agg = computeAggregates(enriched, 0);
    assert.equal(agg.aggressivePct, 100);

    const signals = computePortfolioSignals(enriched, {
      id: 1,
      safe_target_pct: 80,
      aggressive_target_pct: 20,
      rebalance_drift_pct: 5,
      last_rebalance_date: null,
      cash_buffer_usd: 0,
      research_enabled: 1,
      research_min_history_days: 25,
      ollama_news_enabled: 1,
      last_research_at: null,
      updated_at: 0,
    });
    assert.ok(signals.some((s) => s.code === "BARBELL_DRIFT"));
  });

  it("emits CUT when stop loss breached", () => {
    const holding = mockHolding({
      id: 2,
      symbol: "XYZ",
      stop_loss_pct: 10,
    });
    const enriched = [
      {
        holding,
        currentPrice: 80,
        dayChangePct: -1,
        marketValue: 80,
        costBasis: 100,
        pnlUsd: -20,
        pnlPct: -20,
      },
    ];
    const signals = computePortfolioSignals(enriched, {
      id: 1,
      safe_target_pct: 80,
      aggressive_target_pct: 20,
      rebalance_drift_pct: 5,
      last_rebalance_date: "2026-01-01",
      cash_buffer_usd: 0,
      research_enabled: 1,
      research_min_history_days: 25,
      ollama_news_enabled: 1,
      last_research_at: null,
      updated_at: 0,
    });
    assert.ok(signals.some((s) => s.code === "CUT"));
  });
});
