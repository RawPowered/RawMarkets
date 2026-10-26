import React, { useEffect, useState } from "react";
import { Activity, RefreshCw, RotateCcw, Wallet } from "lucide-react";
import { marketFeedStatusLabel, type MarketFeedDisplaySource } from "../lib/feedDisplay";

interface HeaderProps {
  source: MarketFeedDisplaySource;
  onRefreshAll: () => void;
  onReloadApp: () => void;
  onRefreshPortfolio?: () => void;
  showPortfolioRefresh?: boolean;
  isMarketRefreshing: boolean;
  isPortfolioRefreshing?: boolean;
  livePriceCount?: number;
  simulatedPriceCount?: number;
  metalSource?: string;
}

export default function Header({
  source,
  onRefreshAll,
  onReloadApp,
  onRefreshPortfolio,
  showPortfolioRefresh = false,
  isMarketRefreshing,
  isPortfolioRefreshing = false,
  livePriceCount = 0,
  simulatedPriceCount = 0,
  metalSource,
}: HeaderProps) {
  const [time, setTime] = useState("");
  const staleCount = simulatedPriceCount;
  const statusLabel = marketFeedStatusLabel(source, livePriceCount, staleCount);
  const isLive =
    source === "scrape" ||
    source === "alphavantage" ||
    (source === "mixed-fallback" && livePriceCount > 0);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-30 h-auto min-h-[4.5rem] bg-white/90 backdrop-blur-md flex flex-col md:flex-row items-center justify-between px-6 md:px-10 border-b border-[#E5E8EB] shrink-0 gap-3 py-3 md:py-2">
      <div className="flex items-center space-x-3 self-start md:self-auto w-full md:w-auto">
        <div className="w-8 h-8 bg-[#007AFF] rounded-lg flex items-center justify-center shrink-0">
          <Activity size={16} className="text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-[#1D1D1F]">
            Market Intelligence
          </h1>
          <p className="text-xs text-[#86868B] tracking-tight truncate">
            Live market data — refresh to update quotes
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3 self-stretch md:self-auto justify-end w-full md:w-auto">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F5F5F7] rounded-full text-[11px] font-medium text-[#424245] border border-[#E5E8EB]">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              isLive ? "bg-[#34C759] animate-pulse" : "bg-amber-500"
            }`}
          />
          <span className="font-mono whitespace-nowrap">{statusLabel}</span>
        </div>

        {metalSource ? (
          <div
            className={`px-3 py-1.5 rounded-full text-[11px] font-mono border whitespace-nowrap ${
              metalSource.includes("kitco") || metalSource.includes("yahoo")
                ? "bg-violet-50 text-violet-700 border-violet-200"
                : "bg-amber-50 text-amber-800 border-amber-200"
            }`}
          >
            Metals:{" "}
            {metalSource.includes("kitco") || metalSource.includes("yahoo")
              ? "Live"
              : "Cached"}
          </div>
        ) : null}

        <span className="text-[11px] font-mono text-[#86868B] hidden sm:inline">
          {time}
        </span>

        {showPortfolioRefresh && onRefreshPortfolio ? (
          <button
            onClick={onRefreshPortfolio}
            disabled={isPortfolioRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5F5F7] hover:bg-[#E5E8EB] border border-[#E5E8EB] rounded-full text-[11px] font-bold text-[#1D1D1F] transition-all disabled:opacity-50 cursor-pointer"
          >
            <Wallet size={14} />
            {isPortfolioRefreshing ? "Refreshing…" : "Portfolio"}
          </button>
        ) : null}

        <button
          onClick={onRefreshAll}
          disabled={isMarketRefreshing}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-[#007AFF] hover:bg-[#0066CC] text-white rounded-full text-[11px] font-bold transition-all disabled:opacity-60 cursor-pointer shadow-xs"
        >
          <RefreshCw size={14} className={isMarketRefreshing ? "animate-spin" : ""} />
          {isMarketRefreshing ? "Refreshing…" : "Refresh All"}
        </button>

        <button
          onClick={onReloadApp}
          className="p-2 bg-[#F5F5F7] hover:bg-[#E5E8EB] border border-[#E5E8EB] rounded-full text-[#424245] transition-all cursor-pointer"
          title="Reload application"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </header>
  );
}
