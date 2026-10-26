import React from "react";
import type { PortfolioEnrichedHolding, PortfolioResearchMeta } from "../../types";

interface ResearchPanelProps {
  selected: PortfolioEnrichedHolding | null;
  meta?: PortfolioResearchMeta | null;
}

function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(digits);
}

function FactorCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#FAFAFC] rounded-xl px-2.5 py-2">
      <p className="text-[9px] text-[#86868B] font-bold">{label}</p>
      <p className="text-[11px] font-bold text-[#1D1D1F] tabular-nums">{value}</p>
    </div>
  );
}

export default function ResearchPanel({ selected, meta }: ResearchPanelProps) {
  const r = selected?.research;
  const factors = r?.factors;
  const forecast = r?.forecast;
  const action = r?.action;

  if (!selected) {
    return (
      <div className="bg-white border border-[#E5E8EB] rounded-[24px] p-5">
        <p className="text-xs text-[#86868B]">Select a holding to view research.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E5E8EB] rounded-[24px] p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-black text-[#1D1D1F]">
          Research — {selected.symbol}
        </h3>
        {r?.engine ? (
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#F5F5F7] text-[#424245]">
            {r.engine === "python" ? "Python" : "TS fallback"}
          </span>
        ) : null}
      </div>

      {!r ? (
        <p className="text-xs text-[#86868B]">
          Refresh portfolio to run factor analysis.
        </p>
      ) : (
        <>
          {action ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                  action.action === "reduce"
                    ? "bg-rose-100 text-rose-700"
                    : action.action === "add"
                      ? "bg-emerald-100 text-emerald-700"
                      : action.action === "trim" || action.action === "no_add"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-[#F0F7FF] text-[#007AFF]"
                }`}
              >
                {action.action.replace("_", " ")}
              </span>
              <span className="text-[10px] text-[#86868B]">{action.reason}</span>
            </div>
          ) : null}

          {forecast ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <FactorCell label="P(up) 5d" value={fmtPct(forecast.prob_up_5d)} />
              <FactorCell label="P(up) 20d" value={fmtPct(forecast.prob_up_20d)} />
              <FactorCell label="Regime" value={forecast.regime} />
              <FactorCell
                label="Return band 5d"
                value={`${fmtPct(forecast.expected_return_low_5d)} … ${fmtPct(forecast.expected_return_high_5d)}`}
              />
            </div>
          ) : null}

          {factors ? (
            <div>
              <p className="text-[10px] font-bold text-[#86868B] mb-2 uppercase tracking-wide">
                Factors ({factors.data_points} bars)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
                <FactorCell label="Return 5d" value={fmtPct(factors.return_5d)} />
                <FactorCell label="Return 20d" value={fmtPct(factors.return_20d)} />
                <FactorCell label="Vol 20d" value={fmtPct(factors.vol_20d)} />
                <FactorCell label="Trend" value={fmtNum(factors.trend_score)} />
                <FactorCell label="DD 30d" value={fmtPct(factors.drawdown_30d)} />
                <FactorCell
                  label="Conc."
                  value={
                    factors.concentration_pct != null
                      ? `${factors.concentration_pct.toFixed(1)}%`
                      : "—"
                  }
                />
              </div>
            </div>
          ) : null}

          {r.evaluated_at ? (
            <p className="text-[9px] text-[#86868B] font-mono">
              Evaluated {new Date(r.evaluated_at).toLocaleString()}
              {meta?.ollama ? " · local AI news" : ""}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
