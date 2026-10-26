import React from "react";
import type { PortfolioAggregates } from "../../types";

interface PortfolioSummaryBarProps {
  aggregates: PortfolioAggregates;
  holdingCount: number;
  refreshedAt: string | null;
  loading?: boolean;
  onRefresh: () => void;
}

function fmtUsd(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function pctLabel(value: number | null | undefined, fallback = 0): string {
  const n = value ?? fallback;
  return Number.isFinite(n) ? n.toFixed(0) : "—";
}

export default function PortfolioSummaryBar({
  aggregates,
  holdingCount,
  refreshedAt,
  loading,
  onRefresh,
}: PortfolioSummaryBarProps) {
  const dayPositive = aggregates.dayPnlUsd >= 0;

  return (
    <div className="bg-white border border-[#E5E8EB] rounded-[32px] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 className="text-lg font-bold text-[#1D1D1F] tracking-tight">
          Seed capital portfolio
        </h2>
        <p className="text-xs text-[#86868B] mt-1">
          {holdingCount} position{holdingCount !== 1 ? "s" : ""} · Yahoo live
          prices
          {refreshedAt
            ? ` · ${new Date(refreshedAt).toLocaleTimeString()}`
            : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="px-4 py-2.5 bg-[#F5F5F7] rounded-2xl border border-[#E5E8EB] min-w-[120px]">
          <span className="text-[9px] font-extrabold text-[#86868B] uppercase font-mono block">
            Total value
          </span>
          <span className="text-base font-bold tabular-nums">
            {fmtUsd(aggregates.totalValue)}
          </span>
        </div>
        <div className="px-4 py-2.5 bg-[#F5F5F7] rounded-2xl border border-[#E5E8EB] min-w-[120px]">
          <span className="text-[9px] font-extrabold text-[#86868B] uppercase font-mono block">
            Day P/L
          </span>
          <span
            className={`text-base font-bold tabular-nums font-mono ${
              dayPositive ? "text-[#34C759]" : "text-[#FF3B30]"
            }`}
          >
            {dayPositive ? "+" : ""}
            {fmtUsd(aggregates.dayPnlUsd)}
          </span>
        </div>
        <div className="px-4 py-2.5 bg-[#F5F5F7] rounded-2xl border border-[#E5E8EB] min-w-[100px]">
          <span className="text-[9px] font-extrabold text-[#86868B] uppercase font-mono block">
            Safe / Agg
          </span>
          <span className="text-sm font-bold font-mono">
            {pctLabel(aggregates.safePct, 100)} / {pctLabel(aggregates.aggressivePct, 0)}%
          </span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="px-4 py-2.5 bg-[#007AFF] text-white rounded-2xl text-xs font-bold hover:opacity-90 cursor-pointer disabled:opacity-60"
        >
          {loading ? "Refreshing…" : "Refresh Portfolio"}
        </button>
      </div>
    </div>
  );
}
