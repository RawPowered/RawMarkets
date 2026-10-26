import React, { useState } from "react";
import type { ConsolidatedSymbolDraft, PortfolioImportDraft } from "../types";

interface ConsolidatedImportReviewProps {
  groups: ConsolidatedSymbolDraft[];
  onToggleGroup: (symbol: string, status: PortfolioImportDraft["status"]) => void;
}

function fmtUsd(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

export default function ConsolidatedImportReview({
  groups,
  onToggleGroup,
}: ConsolidatedImportReviewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E5E8EB] bg-white p-6 text-xs text-[#86868B]">
        No investment transactions detected yet.
      </div>
    );
  }

  const toggle = (symbol: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <div
          key={g.symbol}
          className="rounded-2xl border border-[#E5E8EB] bg-white overflow-hidden"
        >
          <div className="flex flex-wrap items-center gap-3 p-4">
            <button
              type="button"
              onClick={() => toggle(g.symbol)}
              className="text-sm font-black text-[#1D1D1F] cursor-pointer"
            >
              {expanded.has(g.symbol) ? "▾" : "▸"} {g.symbol}
            </button>
            <span className="text-[11px] text-[#86868B] font-mono">
              {g.netShares.toFixed(4)} sh @ {fmtUsd(g.avgEntryPrice)} avg ·{" "}
              {fmtUsd(g.totalCost)} cost · {g.lotCount} tx
            </span>
            <select
              value={g.status}
              onChange={(e) =>
                onToggleGroup(
                  g.symbol,
                  e.target.value as PortfolioImportDraft["status"]
                )
              }
              className="ml-auto rounded-md border border-[#E5E8EB] px-2 py-1 text-xs"
            >
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          {expanded.has(g.symbol) ? (
            <div className="border-t border-[#E5E8EB] px-4 py-2 space-y-1">
              {g.lots.map((lot) => (
                <div
                  key={lot.draftId}
                  className="flex flex-wrap gap-3 text-[10px] font-mono text-[#424245] py-1"
                >
                  <span>L{lot.sourceLine}</span>
                  <span className="uppercase">{lot.tx_type ?? "buy"}</span>
                  <span>{lot.entry_date}</span>
                  <span>{lot.shares?.toFixed(6) ?? "—"} sh</span>
                  <span>@ {fmtUsd(lot.entry_price)}</span>
                  <span>{fmtUsd(lot.dollars_invested)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
