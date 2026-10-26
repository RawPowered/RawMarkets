import React, { useState } from "react";
import { SpecialMetalRate } from "../types";
import CommodityIcon from "./CommodityIcon";
import AssetValidationActions from "./AssetValidationActions";
import {
  formatMetalChangePercent,
  formatMetalSpotPrice,
  isDisplayableMetalPrice,
  isRealMetalSpotLive,
} from "../lib/feedDisplay";
import FeedUnavailableHint from "./FeedUnavailableHint";

interface PreciousMetalsSpotPanelProps {
  rates: Record<string, SpecialMetalRate>;
  source: string;
  fromLive: boolean;
  feedNote?: string | null;
  loading?: boolean;
}

export default function PreciousMetalsSpotPanel({
  rates,
  source,
  fromLive,
  feedNote,
  loading = false,
}: PreciousMetalsSpotPanelProps) {
  const [usdAmount, setUsdAmount] = useState<number>(1000);

  const getSymbolBg = (symbol: string) => {
    switch (symbol) {
      case "XAU":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "XAG":
        return "bg-slate-100 text-slate-800 border-slate-200";
      case "XPT":
        return "bg-teal-50 text-teal-800 border-teal-200";
      case "XPD":
        return "bg-indigo-50 text-indigo-800 border-indigo-200";
      default:
        return "bg-blue-50 text-blue-800 border-blue-200";
    }
  };

  const isKitcoLive = isRealMetalSpotLive(source, fromLive);
  const hasAnyPrice = Object.values(rates).some((r) =>
    isDisplayableMetalPrice(source, r.price)
  );

  return (
    <div className="w-full bg-white border border-[#E5E8EB] rounded-[32px] p-6 lg:p-8 shadow-xs">
      {/* Header index state */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E5E8EB] mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold tracking-tight text-[#1D1D1F]">
              Physical Precious Metals Spot Terminal
            </h3>
            {isKitcoLive ? (
              <span className="px-2 py-0.5 text-[9px] font-bold rounded-full font-mono uppercase border bg-violet-50 border-violet-200 text-violet-700">
                Live metals
              </span>
            ) : hasAnyPrice ? (
              <span className="px-2 py-0.5 text-[9px] font-bold rounded-full font-mono uppercase border bg-slate-50 border-slate-200 text-slate-600">
                {source.includes("yahoo") ? "Yahoo futures" : "Cached spot"}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-[#86868B] mt-1 leading-normal">
            Spot from{" "}
            <span className="font-mono text-violet-700 font-bold">Kitco bid</span>{" "}
            with <span className="font-mono text-violet-700 font-bold">Yahoo XAUUSD/XAGUSD</span>{" "}
            fallback. Same sources as Validate links on each metal card.
            {!hasAnyPrice && (
              <span className="block mt-1 text-amber-800">
                No live pull this refresh — prices stay blank until Refresh Spot Feed succeeds.
              </span>
            )}
          </p>
          <FeedUnavailableHint note={feedNote} className="mt-2" />
          {loading ? (
            <p className="text-[10px] font-mono text-violet-700 mt-2 animate-pulse">
              Capturing Kitco spot…
            </p>
          ) : (
            <p className="text-[10px] text-[#86868B] mt-2 font-mono">
              Use the violet <strong>Refresh Spot Feed</strong> button in the header.
            </p>
          )}
        </div>
      </div>

      {/* Spot Price Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {Object.entries(rates).map(([symbol, detail]) => {
          const changePct = formatMetalChangePercent(
            detail.changePercent,
            source,
            fromLive,
            detail.price
          );
          const isPositive =
            changePct != null ? !changePct.startsWith("-") : null;
          const spotPrice = formatMetalSpotPrice(detail.price, source, fromLive);
          return (
            <div
              key={symbol}
              className="p-5 border border-[#E5E8EB] rounded-2xl bg-[#F5F5F7]/30 hover:bg-white hover:shadow-md transition-all duration-300 relative group overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <span className={`px-2.5 py-1 text-xs font-black tracking-wider rounded-xl border ${getSymbolBg(symbol)}`}>
                  {symbol}
                </span>
                <div className="flex items-center gap-1">
                  <AssetValidationActions
                    symbol={symbol}
                    category="METALS"
                    name={detail.name}
                    variant="icon"
                  />
                  <span className="block group-hover:scale-110 transition-transform duration-300">
                    <CommodityIcon symbol={symbol} size="sm" />
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#86868B] font-mono block mb-1">
                  {detail.name}
                </span>
                <span className="text-2xl font-black text-[#86868B] tracking-tight block tabular-nums">
                  {spotPrice}
                </span>

                {changePct != null && isPositive != null ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span
                      className={`text-xs font-extrabold font-mono ${
                        isPositive ? "text-[#34C759]" : "text-[#FF3B30]"
                      }`}
                    >
                      {changePct}
                    </span>
                    <span className="text-[10px] text-[#86868B]">- Today</span>
                  </div>
                ) : null}
              </div>

              <div className="mt-3">
                <AssetValidationActions
                  symbol={symbol}
                  category="METALS"
                  name={detail.name}
                  variant="button"
                  className="w-full justify-center"
                />
              </div>

              {isDisplayableMetalPrice(source, detail.price) ? (
                <div className="mt-4 pt-4 border-t border-[#E5E8EB] space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#86868B]">
                    <span>1 USD In Ounce:</span>
                    <span className="font-bold text-[#1D1D1F]">{detail.rate.toFixed(7)} oz</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#86868B]">
                    <span>Gram Weight Cost:</span>
                    <span className="font-bold text-[#1D1D1F]">
                      ${(detail.price / 31.1035).toFixed(2)} /g
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Advanced Precious Metals Signal Tool: Conversion Box */}
      <div className="mt-8 bg-[#F5F5F7] border border-[#E5E8EB] rounded-2xl p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <span className="p-1 px-2.5 bg-white text-[#007AFF] text-[9px] font-extrabold tracking-widest uppercase rounded-full border border-[#E5E8EB] font-mono">
              PRECIOUS METALS CALCULATOR
            </span>
            <h4 className="text-sm font-extrabold text-[#1D1D1F] mt-1.5">
              Alternative Ounces Purchase Planner
            </h4>
            <p className="text-xs text-[#86868B]">
              Simulate standard cash allocation into precious metal weights for physical alternative holdings.
            </p>
          </div>

          <div className="flex items-center bg-white border border-[#E5E8EB] rounded-xl px-3.5 py-1.5 shadow-xs shrink-0">
            <span className="text-xs font-bold text-[#1D1D1F] mr-1.5">$</span>
            <input
              type="number"
              value={usdAmount}
              onChange={(e) => setUsdAmount(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-24 outline-none text-xs text-[#1D1D1F] font-bold font-mono text-right"
              placeholder="1000"
            />
            <span className="text-[10px] font-bold text-[#86868B] font-mono ml-1.5">USD</span>
          </div>
        </div>

        {/* Calculation Table */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          {Object.entries(rates).map(([symbol, detail]) => {
            const ouncesBuy =
              isDisplayableMetalPrice(source, detail.price) && detail.rate > 0
                ? usdAmount * detail.rate
                : null;
            const gramsBuy =
              ouncesBuy != null ? ouncesBuy * 31.1035 : null;

            return (
              <div key={symbol} className="bg-white border border-[#E5E8EB]/70 p-4 rounded-xl shadow-xs">
                <span className="text-[10px] font-bold text-[#86868B] font-mono block uppercase">
                  {detail.name.split(" ")[0]} Buying Power
                </span>
                <div className="mt-2 text-sm font-black text-[#86868B]">
                  {ouncesBuy != null ? (
                    <>
                      {ouncesBuy.toFixed(4)}{" "}
                      <span className="text-xs font-normal">oz</span>
                    </>
                  ) : (
                    "—"
                  )}
                </div>
                <div className="text-[10px] text-[#86868B] font-mono mt-0.5">
                  {gramsBuy != null ? `or ${gramsBuy.toFixed(2)} grams` : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
