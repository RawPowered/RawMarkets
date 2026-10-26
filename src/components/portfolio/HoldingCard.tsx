import React, { useCallback, useEffect, useState } from "react";
import { Trash2, ChevronDown, ChevronUp, Archive, ArchiveRestore } from "lucide-react";
import { apiFetch, readApiJson } from "../../lib/api";
import type { PortfolioEnrichedHolding, PortfolioTransaction } from "../../types";
import PortfolioChart from "./PortfolioChart";

interface HoldingCardProps {
  holding: PortfolioEnrichedHolding;
  selected: boolean;
  onSelect: () => void;
  onDelete: (id: number) => void;
  onArchive?: (id: number) => void;
  onRestore?: (id: number) => void;
  onHoldingUpdated?: () => void;
  deleting?: boolean;
  archiving?: boolean;
  archived?: boolean;
}

function fmtUsd(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

export default function HoldingCard({
  holding,
  selected,
  onSelect,
  onDelete,
  onArchive,
  onRestore,
  onHoldingUpdated,
  deleting,
  archiving,
  archived = false,
}: HoldingCardProps) {
  const [expanded, setExpanded] = useState(selected);
  const [transactions, setTransactions] = useState<PortfolioTransaction[] | null>(
    null
  );
  const [txLoading, setTxLoading] = useState(false);
  const [txSavingId, setTxSavingId] = useState<number | null>(null);

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const resp = await apiFetch(
        `/api/portfolio/holdings/${holding.id}/transactions`
      );
      const json = await readApiJson<{
        success?: boolean;
        transactions?: PortfolioTransaction[];
      }>(resp);
      if (resp.ok && json.success) {
        setTransactions(json.transactions ?? []);
      }
    } catch {
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  }, [holding.id]);

  useEffect(() => {
    if (!expanded) return;
    void loadTransactions();
  }, [expanded, loadTransactions]);

  const setTxType = async (txId: number, tx_type: "buy" | "sell") => {
    setTxSavingId(txId);
    try {
      const resp = await apiFetch(`/api/portfolio/transactions/${txId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tx_type }),
      });
      const json = await readApiJson<{
        success?: boolean;
        transactions?: PortfolioTransaction[];
      }>(resp);
      if (resp.ok && json.success) {
        setTransactions(json.transactions ?? []);
        onHoldingUpdated?.();
      }
    } finally {
      setTxSavingId(null);
    }
  };

  const live =
    holding.price_source === "yahoo_chart" ||
    holding.price_source === "scrape" ||
    holding.price_source === "cached";

  const companyLabel =
    holding.company_name && holding.company_name !== holding.symbol
      ? holding.company_name
      : undefined;

  return (
    <div
      className={`bg-white border rounded-[24px] overflow-hidden transition-shadow ${
        archived
          ? "border-[#E5E8EB]/80 opacity-75"
          : selected
            ? "border-[#007AFF] shadow-md shadow-blue-500/10"
            : "border-[#E5E8EB]"
      }`}
    >
      <button
        type="button"
        onClick={() => {
          onSelect();
          setExpanded(true);
        }}
        className="w-full text-left p-4 cursor-pointer hover:bg-[#FAFAFC]"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="text-lg font-black text-[#1D1D1F]"
                title={companyLabel ?? holding.symbol}
                aria-label={companyLabel ?? holding.symbol}
              >
                {holding.symbol}
              </span>
              {archived ? (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#F5F5F7] text-[#86868B]">
                  archived
                </span>
              ) : (
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    live
                      ? "bg-[#34C759]/10 text-[#34C759]"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {live ? holding.price_source : "stale"}
                </span>
              )}
            </div>
            <p className="text-[10px] text-[#86868B] font-mono mt-0.5">
              Entry {holding.entry_date} @ {fmtUsd(holding.entry_price)} ·{" "}
              {holding.shares.toFixed(4)} sh
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold tabular-nums">
              {holding.current_price != null
                ? fmtUsd(holding.current_price)
                : "—"}
            </p>
            {holding.pnl_pct != null ? (
              <p
                className={`text-xs font-bold font-mono ${
                  holding.pnl_pct >= 0 ? "text-[#34C759]" : "text-[#FF3B30]"
                }`}
              >
                {holding.pnl_pct >= 0 ? "+" : ""}
                {holding.pnl_pct.toFixed(2)}%
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#F5F5F7] text-[#424245]">
            {holding.barbell_side}
          </span>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#F5F5F7] text-[#424245]">
            {holding.fragility}
          </span>
          {!archived &&
            holding.signals.slice(0, 2).map((s) => (
              <span
                key={s.code}
                className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#F0F7FF] text-[#007AFF]"
              >
                {s.action}
              </span>
            ))}
        </div>
      </button>

      <div className="px-4 pb-2 flex flex-wrap justify-between gap-2 border-t border-[#E5E8EB]/60">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] font-bold text-[#007AFF] flex items-center gap-1 py-2 cursor-pointer"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          Chart
        </button>
        <div className="flex items-center gap-3">
          {archived && onRestore ? (
            <button
              type="button"
              disabled={archiving}
              onClick={() => onRestore(holding.id)}
              className="text-[10px] font-bold text-[#007AFF] flex items-center gap-1 py-2 cursor-pointer disabled:opacity-50"
            >
              <ArchiveRestore size={12} />
              Restore
            </button>
          ) : onArchive ? (
            <button
              type="button"
              disabled={archiving}
              onClick={() => onArchive(holding.id)}
              className="text-[10px] font-bold text-[#86868B] flex items-center gap-1 py-2 cursor-pointer disabled:opacity-50"
            >
              <Archive size={12} />
              Archive
            </button>
          ) : null}
          <button
            type="button"
            disabled={deleting}
            onClick={() => onDelete(holding.id)}
            className="text-[10px] font-bold text-rose-600 flex items-center gap-1 py-2 cursor-pointer disabled:opacity-50"
          >
            <Trash2 size={12} />
            Remove
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="px-4 pb-4">
          {!archived ? (
            <PortfolioChart
              symbol={holding.symbol}
              entryDate={holding.entry_date}
              entryPrice={holding.entry_price}
              currentPrice={holding.current_price}
              history7d={holding.history_7d}
              history30d={holding.history_30d}
            />
          ) : null}
          {holding.feed_note ? (
            <p className="text-[10px] text-amber-700 mt-2">{holding.feed_note}</p>
          ) : null}
          <div className="mt-4 border-t border-[#E5E8EB]/60 pt-3">
            <p className="text-[10px] font-bold text-[#86868B] uppercase tracking-wide mb-2">
              Buy / sell history
            </p>
            {txLoading ? (
              <p className="text-[10px] text-[#86868B]">Loading transactions…</p>
            ) : transactions && transactions.length > 0 ? (
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {transactions.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-[10px]"
                  >
                    <div className="flex rounded-lg overflow-hidden border border-[#E5E8EB]">
                      <button
                        type="button"
                        disabled={txSavingId === tx.id}
                        onClick={() => void setTxType(tx.id, "buy")}
                        className={`px-2 py-0.5 font-bold uppercase cursor-pointer disabled:opacity-50 ${
                          tx.tx_type === "buy"
                            ? "bg-emerald-600 text-white"
                            : "bg-white text-emerald-700"
                        }`}
                      >
                        Buy
                      </button>
                      <button
                        type="button"
                        disabled={txSavingId === tx.id}
                        onClick={() => void setTxType(tx.id, "sell")}
                        className={`px-2 py-0.5 font-bold uppercase cursor-pointer disabled:opacity-50 ${
                          tx.tx_type === "sell"
                            ? "bg-rose-600 text-white"
                            : "bg-white text-rose-700"
                        }`}
                      >
                        Sell
                      </button>
                    </div>
                    <span className="text-[#86868B] font-mono">{tx.tx_date}</span>
                    <span className="font-mono tabular-nums">
                      {tx.shares.toFixed(4)} @ {fmtUsd(tx.price)}
                    </span>
                    <span className="font-mono tabular-nums text-[#424245]">
                      {fmtUsd(tx.amount_usd)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[10px] text-[#86868B]">
                No ledger rows yet. Import a statement or add a position manually to
                record buy/sell lots.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
