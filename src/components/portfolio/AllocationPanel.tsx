import React from "react";
import type { PortfolioAggregates, PortfolioEnrichedHolding } from "../../types";
import { WEALTH_BUCKET_TARGETS } from "../../lib/portfolioTaxonomy";

interface AllocationPanelProps {
  holdings: PortfolioEnrichedHolding[];
  aggregates: PortfolioAggregates;
  safeTarget: number;
  aggressiveTarget: number;
}

export default function AllocationPanel({
  holdings,
  aggregates,
  safeTarget,
  aggressiveTarget,
}: AllocationPanelProps) {
  const safePct = aggregates.safePct ?? 100;
  const aggressivePct = aggregates.aggressivePct ?? 0;
  const bucketTotals: Record<string, number> = {};
  for (const h of holdings) {
    const pct =
      aggregates.totalValue > 0
        ? (h.market_value / aggregates.totalValue) * 100
        : 0;
    bucketTotals[h.wealth_bucket] = (bucketTotals[h.wealth_bucket] ?? 0) + pct;
  }

  return (
    <div className="bg-white border border-[#E5E8EB] rounded-[28px] p-6 space-y-5">
      <h3 className="text-sm font-bold text-[#1D1D1F]">Allocation</h3>

      <div>
        <div className="flex justify-between text-[10px] font-mono text-[#86868B] mb-1">
          <span>Barbell — Safe</span>
          <span>
            {safePct.toFixed(1)}% / {safeTarget}%
          </span>
        </div>
        <div className="h-2 bg-[#F5F5F7] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#34C759] rounded-full transition-all"
            style={{ width: `${Math.min(100, safePct)}%` }}
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[10px] font-mono text-[#86868B] mb-1">
          <span>Barbell — Aggressive</span>
          <span>
            {aggressivePct.toFixed(1)}% / {aggressiveTarget}%
          </span>
        </div>
        <div className="h-2 bg-[#F5F5F7] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#007AFF] rounded-full transition-all"
            style={{ width: `${Math.min(100, aggressivePct)}%` }}
          />
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-[#E5E8EB]">
        <span className="text-[9px] font-extrabold text-[#86868B] uppercase tracking-wider font-mono">
          Wealth buckets (seed targets)
        </span>
        {Object.entries(WEALTH_BUCKET_TARGETS).map(([bucket, target]) => {
          const actual = bucketTotals[bucket] ?? 0;
          return (
            <div key={bucket}>
              <div className="flex justify-between text-[10px] mb-0.5">
                <span className="text-[#424245] capitalize">
                  {bucket.replace(/_/g, " ")}
                </span>
                <span className="font-mono text-[#86868B]">
                  {actual.toFixed(1)}% / {target}%
                </span>
              </div>
              <div className="h-1.5 bg-[#F5F5F7] rounded-full overflow-hidden">
                <div
                  className="h-full bg-zinc-700 rounded-full"
                  style={{ width: `${Math.min(100, (actual / target) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
