import React, { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { apiFetch, readApiJson } from "../../lib/api";
import type { PortfolioEntryMode, SymbolSearchHit, SymbolSearchResponse } from "../../types";

interface HoldingFormProps {
  onAdded: () => void;
}

export default function HoldingForm({ onAdded }: HoldingFormProps) {
  const [symbol, setSymbol] = useState("");
  const [entryDate, setEntryDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [entryMode, setEntryMode] = useState<PortfolioEntryMode>("dollars");
  const [entryPrice, setEntryPrice] = useState("");
  const [shares, setShares] = useState("");
  const [dollars, setDollars] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [targetPct, setTargetPct] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeahead, setTypeahead] = useState<SymbolSearchHit[]>([]);
  const [showTypeahead, setShowTypeahead] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const q = symbol.trim();
    if (q.length < 1) {
      setTypeahead([]);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        try {
          const resp = await apiFetch(
            `/api/search-symbol?q=${encodeURIComponent(q)}&mode=symbol`
          );
          const json = await readApiJson<SymbolSearchResponse>(resp);
          if (resp.ok && json.success) {
            setTypeahead((json.matches ?? []).slice(0, 8));
          }
        } catch {
          setTypeahead([]);
        }
      })();
    }, 280);
    return () => clearTimeout(t);
  }, [symbol]);

  const pickHit = (hit: SymbolSearchHit) => {
    setSymbol(hit.symbol.toUpperCase());
    setShowTypeahead(false);
    if (!entryPrice && hit.defaultPrice > 0) {
      setEntryPrice(String(hit.defaultPrice));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const price = parseFloat(entryPrice);
    if (!symbol.trim() || !entryDate || !Number.isFinite(price) || price <= 0) {
      setError("Symbol, date, and entry price are required.");
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        symbol: symbol.trim().toUpperCase(),
        entry_date: entryDate,
        entry_mode: entryMode,
        entry_price: price,
      };
      if (entryMode === "dollars") {
        const d = parseFloat(dollars);
        if (!Number.isFinite(d) || d <= 0) {
          setError("Dollars invested is required.");
          setSubmitting(false);
          return;
        }
        body.dollars_invested = d;
      } else {
        const s = parseFloat(shares);
        if (!Number.isFinite(s) || s <= 0) {
          setError("Share count is required.");
          setSubmitting(false);
          return;
        }
        body.shares = s;
      }
      if (stopLoss) body.stop_loss_pct = parseFloat(stopLoss);
      if (takeProfit) body.take_profit_pct = parseFloat(takeProfit);
      if (targetPct) body.target_pct = parseFloat(targetPct);

      const resp = await apiFetch("/api/portfolio/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readApiJson<{ success?: boolean; message?: string }>(
        resp
      );
      if (!resp.ok || !data.success) {
        setError(data.message ?? "Failed to add holding.");
        return;
      }
      setSymbol("");
      setEntryPrice("");
      setShares("");
      setDollars("");
      setTypeahead([]);
      onAdded();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="bg-white border border-[#E5E8EB] rounded-[28px] p-6 space-y-4"
    >
      <div>
        <h3 className="text-sm font-bold text-[#1D1D1F]">Add position</h3>
        <p className="text-[10px] text-[#86868B] mt-0.5">
          Any broker or manual entry — merges into an existing symbol when present.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block relative">
          <span className="text-[10px] font-bold text-[#86868B] uppercase font-mono">
            Ticker
          </span>
          <input
            value={symbol}
            onChange={(e) => {
              setSymbol(e.target.value.toUpperCase());
              setShowTypeahead(true);
            }}
            onFocus={() => setShowTypeahead(true)}
            onBlur={() => {
              blurTimer.current = setTimeout(() => setShowTypeahead(false), 150);
            }}
            placeholder="AAPL"
            autoComplete="off"
            className="mt-1 w-full px-3 py-2 rounded-xl border border-[#E5E8EB] text-sm font-mono"
          />
          {showTypeahead && typeahead.length > 0 ? (
            <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#E5E8EB] rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {typeahead.map((hit) => (
                <li key={`${hit.symbol}-${hit.source}`}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-[#F5F5F7] cursor-pointer"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickHit(hit)}
                  >
                    <span className="text-xs font-bold font-mono">{hit.symbol}</span>
                    <span className="text-[10px] text-[#86868B] ml-2 truncate">
                      {hit.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </label>
        <label className="block">
          <span className="text-[10px] font-bold text-[#86868B] uppercase font-mono">
            Entry date
          </span>
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-xl border border-[#E5E8EB] text-sm"
          />
        </label>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setEntryMode("dollars")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold cursor-pointer ${
            entryMode === "dollars"
              ? "bg-[#007AFF] text-white"
              : "bg-[#F5F5F7] text-[#424245]"
          }`}
        >
          Dollars invested
        </button>
        <button
          type="button"
          onClick={() => setEntryMode("shares")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold cursor-pointer ${
            entryMode === "shares"
              ? "bg-[#007AFF] text-white"
              : "bg-[#F5F5F7] text-[#424245]"
          }`}
        >
          Share count
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-[10px] font-bold text-[#86868B] uppercase font-mono">
            Entry price ($)
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={entryPrice}
            onChange={(e) => setEntryPrice(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-xl border border-[#E5E8EB] text-sm font-mono"
          />
        </label>
        {entryMode === "dollars" ? (
          <label className="block sm:col-span-2">
            <span className="text-[10px] font-bold text-[#86868B] uppercase font-mono">
              Dollars invested
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={dollars}
              onChange={(e) => setDollars(e.target.value)}
              placeholder="50.00"
              className="mt-1 w-full px-3 py-2 rounded-xl border border-[#E5E8EB] text-sm font-mono"
            />
          </label>
        ) : (
          <label className="block sm:col-span-2">
            <span className="text-[10px] font-bold text-[#86868B] uppercase font-mono">
              Shares
            </span>
            <input
              type="number"
              step="0.0001"
              min="0"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-[#E5E8EB] text-sm font-mono"
            />
          </label>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="text-[10px] text-[#86868B] font-mono">Stop %</span>
          <input
            type="number"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            placeholder="15"
            className="mt-1 w-full px-2 py-1.5 rounded-lg border border-[#E5E8EB] text-xs"
          />
        </label>
        <label className="block">
          <span className="text-[10px] text-[#86868B] font-mono">Take profit %</span>
          <input
            type="number"
            value={takeProfit}
            onChange={(e) => setTakeProfit(e.target.value)}
            placeholder="25"
            className="mt-1 w-full px-2 py-1.5 rounded-lg border border-[#E5E8EB] text-xs"
          />
        </label>
        <label className="block">
          <span className="text-[10px] text-[#86868B] font-mono">Max weight %</span>
          <input
            type="number"
            value={targetPct}
            onChange={(e) => setTargetPct(e.target.value)}
            placeholder="10"
            className="mt-1 w-full px-2 py-1.5 rounded-lg border border-[#E5E8EB] text-xs"
          />
        </label>
      </div>

      {error ? (
        <p className="text-xs text-rose-600 font-medium">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#1D1D1F] text-white rounded-xl text-xs font-bold hover:bg-zinc-800 cursor-pointer disabled:opacity-60"
      >
        <Plus size={14} />
        {submitting ? "Adding…" : "Add to portfolio"}
      </button>
    </form>
  );
}
