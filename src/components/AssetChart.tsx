import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { Asset } from "../types";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Award, Circle } from "lucide-react";
import AssetValidationActions from "./AssetValidationActions";
import {
  formatDisplayChangeAmount,
  formatDisplayChangePercent,
  formatDisplayPrice,
  hasRealChartHistory,
  isDisplayChangePositive,
  isRealPriceSource,
} from "../lib/feedDisplay";
import FeedUnavailableHint from "./FeedUnavailableHint";

interface AssetChartProps {
  asset: Asset;
  isCapturing?: boolean;
  captureLabel?: string;
}

export default function AssetChart({
  asset,
  isCapturing = false,
  captureLabel,
}: AssetChartProps) {
  const hasPrice = isRealPriceSource(asset.priceSource);
  const hasChart = hasRealChartHistory(asset.historySource);
  const chartFromScrape = asset.historySource === "scrape";
  const changePct = formatDisplayChangePercent(
    asset.changePercent,
    asset.priceSource
  );
  const isPositive = isDisplayChangePositive(
    asset.changePercent,
    asset.priceSource
  );
  const changeAmt = formatDisplayChangeAmount(asset.change, asset.priceSource);

  // Determine beautiful custom color palettes for different asset types
  const getTheme = () => {
    switch (asset.symbol) {
      case "GOLD":
        return {
          stroke: "#d97706", // amber-600
          fill: "#f59e0b", // amber-500
          accent: "zinc-950",
          desc: "Gold indices serve as sovereign protection markers of the alternative system."
        };
      case "SILVER":
        return {
          stroke: "#4b5563", // gray-600
          fill: "#6b7280", // gray-500
          accent: "zinc-600",
          desc: "Silver indices monitor physical bullion reserves, reflecting both investment and green electronics industrial demands."
        };
      case "COPPER":
        return {
          stroke: "#ea580c", // orange-600
          fill: "#f97316", // orange-500
          accent: "orange-600",
          desc: "Copper acts as the supreme leader of traditional real-economy industrial activity index indicators."
        };
      case "NTDOY":
        return {
          stroke: "#dc2626", // red-600
          fill: "#ef4444", // red-500
          accent: "red-600",
          desc: "Nintendo shares offer proxies into console inventory cycles and major game publication pipelines."
        };
      case "DIS":
        return {
          stroke: "#4f46e5", // indigo-600
          fill: "#6366f1", // indigo-500
          accent: "indigo-600",
          desc: "Disney metrics show macro direct consumer theme-park, advertising, and video subscription health."
        };
      case "HAS":
        return {
          stroke: "#2563eb", // blue-600
          fill: "#3b82f6", // blue-500
          accent: "blue-600",
          desc: "Hasbro serves as a leading indicator of board games and printed trading card supply-chain indicators."
        };
      case "TCG-POKE":
        return {
          stroke: "#e11d48", // rose-600
          fill: "#f43f5e", // rose-500
          accent: "rose-600",
          desc: "The vintage Pokémon card index aggregates auction results for vintage base set boxes, tracking highly liquid alternative hobby funds."
        };
      default:
        return {
          stroke: "#18181b", // zinc-800
          fill: "#3f3f46", // zinc-600
          accent: "zinc-800",
          desc: "Custom index asset tracking current market evaluations."
        };
    }
  };

  const chartTheme = getTheme();

  // Custom high-end Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-zinc-950 text-white p-3 rounded-2xl border border-zinc-900 shadow-xl text-xs font-mono">
          <p className="text-zinc-400 font-sans font-medium mb-1 border-b border-zinc-800 pb-1">
            {data.date}
          </p>
          <p className="text-white font-bold">
            Value: <span className="text-emerald-400">${data.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full bg-white border border-[#E5E8EB] shadow-sm rounded-[32px] p-6 md:p-8 flex flex-col gap-6">

      {/* Chart Title block / Header metrics */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <span className="text-[10px] font-extrabold tracking-wider uppercase text-[#86868B] font-mono block mb-1">
            Active Signal Chart
          </span>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-[#1D1D1F]">
            {asset.name} Historical Trends
          </h2>
          <p className="text-xs text-[#86868B] mt-1 max-w-xl leading-relaxed">
            {chartTheme.desc}
          </p>
        </div>

        <div className="flex flex-col items-stretch sm:items-end gap-3 self-start md:self-auto">
          <div className="flex items-center gap-4 bg-[#F5F5F7] border border-[#E5E8EB] p-4 rounded-2xl">
            <div>
              <span className="text-[10px] font-bold text-[#86868B] block font-mono">
                CURRENT INDEX
              </span>
              <span
                className={`text-xl font-bold leading-none tabular-nums ${
                  hasPrice ? "text-[#1D1D1F]" : "text-[#86868B]"
                }`}
              >
                {formatDisplayPrice(asset.current, asset.priceSource)}
              </span>
              <FeedUnavailableHint note={asset.feedNote} className="max-w-[200px]" />
            </div>
            {hasPrice && changePct != null && isPositive != null ? (
              <div className="flex flex-col items-end">
                <span
                  className={`flex items-center gap-0.5 text-xs font-bold font-mono px-2 py-0.5 rounded-lg ${
                    isPositive
                      ? "text-[#34C759] bg-[#34C759]/10"
                      : "text-[#FF3B30] bg-[#FF3B30]/10"
                  }`}
                >
                  {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {changePct}
                </span>
                {changeAmt != null ? (
                  <span className="text-[10px] text-[#86868B] font-mono mt-0.5">
                    {isPositive ? "Up" : "Down"} ${changeAmt} today
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <AssetValidationActions
            symbol={asset.symbol}
            category={asset.category}
            name={asset.name}
            variant="button"
          />
        </div>
      </div>

      {/* Main Graph Area */}
      <div className="h-64 sm:h-80 w-full mt-2 relative">
        {isCapturing ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-white/85 backdrop-blur-sm border border-violet-200">
            <span className="w-8 h-8 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin mb-2" />
            <p className="text-sm font-bold text-violet-900">Capturing live price</p>
            <p className="text-[11px] text-violet-700 font-mono mt-1 px-4 text-center">
              {captureLabel ?? `Scraping ${asset.symbol} from Yahoo/Kitco…`}
            </p>
          </div>
        ) : null}
        {!hasChart ? (
          <div className="h-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#E5E8EB] bg-[#F5F5F7] text-center px-6">
            <p className="text-sm font-bold text-[#1D1D1F]">No chart data</p>
            <p className="text-xs text-[#86868B] mt-1 max-w-sm">
              Chart appears after a successful market refresh or when you select this symbol.
            </p>
          </div>
        ) : (
        <ResponsiveContainer
          key={`${asset.symbol}-${asset.current}-${asset.history.length}`}
          width="100%"
          height="100%"
        >
          <AreaChart
            data={asset.history}
            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
          >
            <defs>
              <linearGradient id={`gradient-${asset.symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartTheme.fill} stopOpacity={0.25} />
                <stop offset="95%" stopColor={chartTheme.fill} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              stroke="#86868B"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              dy={10}
              tickFormatter={(str) => {
                const date = new Date(str);
                return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              }}
            />
            <YAxis
              stroke="#86868B"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              dx={-5}
              domain={["auto", "auto"]}
              tickFormatter={(num) => `$${num.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={chartTheme.stroke}
              strokeWidth={2.5}
              fillOpacity={1}
              fill={`url(#gradient-${asset.symbol})`}
            />
          </AreaChart>
        </ResponsiveContainer>
        )}
        {hasChart && chartFromScrape ? (
          <p className="text-[10px] text-[#86868B] font-mono mt-2 text-center">
            Chart aligned to today&apos;s market price — historical shape is indicative.
          </p>
        ) : null}
      </div>

      {/* Grid statistics (Samsung-like details cards) */}
      {hasPrice ? (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-[#E5E8EB]">
        <div className="bg-[#F5F5F7] border border-[#E5E8EB] p-4 rounded-2xl">
          <span className="text-[9px] font-extrabold text-[#86868B] tracking-wider font-mono">
            OPEN PRICING
          </span>
          <p className="text-base font-bold text-[#1D1D1F] mt-1 tabular-nums">
            {formatDisplayPrice(asset.open, asset.priceSource)}
          </p>
        </div>
        <div className="bg-[#F5F5F7] border border-[#E5E8EB] p-4 rounded-2xl">
          <span className="text-[9px] font-extrabold text-[#86868B] tracking-wider font-mono">
            DAY RANGE HIGH
          </span>
          <p className="text-base font-bold text-[#34C759] flex items-center gap-1 mt-1 tabular-nums">
            <ArrowUpRight size={14} />
            {formatDisplayPrice(asset.high, asset.priceSource)}
          </p>
        </div>
        <div className="bg-[#F5F5F7] border border-[#E5E8EB] p-4 rounded-2xl">
          <span className="text-[9px] font-extrabold text-[#86868B] tracking-wider font-mono">
            DAY RANGE LOW
          </span>
          <p className="text-base font-bold text-[#FF3B30] flex items-center gap-1 mt-1 tabular-nums">
            <ArrowDownRight size={14} />
            {formatDisplayPrice(asset.low, asset.priceSource)}
          </p>
        </div>
        <div className="bg-[#F5F5F7] border border-[#E5E8EB] p-4 rounded-2xl">
          <span className="text-[9px] font-extrabold text-[#86868B] tracking-wider font-mono">
            TRACKED VOLUME
          </span>
          <p className="text-base font-bold text-[#1D1D1F] mt-1">
            {asset.volume.toLocaleString("en-US")} {asset.unit?.split(" per ")?.[1] || "Units"}
          </p>
        </div>
      </div>
      ) : null}
    </div>
  );
}
