import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { HistoryPoint } from "../../types";

type ChartRange = "today" | "7d" | "30d";

interface PortfolioChartProps {
  symbol: string;
  entryDate: string;
  entryPrice: number;
  currentPrice: number | null;
  history7d: HistoryPoint[];
  history30d: HistoryPoint[];
}

export default function PortfolioChart({
  symbol,
  entryDate,
  entryPrice,
  currentPrice,
  history7d,
  history30d,
}: PortfolioChartProps) {
  const [range, setRange] = useState<ChartRange>("7d");

  const data = useMemo(() => {
    if (range === "30d") return history30d;
    if (range === "7d") return history7d;
    const last = history7d[history7d.length - 1];
    if (last) return [last];
    if (currentPrice != null) {
      return [
        {
          date: new Date().toISOString().slice(0, 10),
          value: currentPrice,
        },
      ];
    }
    return [];
  }, [range, history7d, history30d, currentPrice]);

  const entryInRange = data.some((d) => d.date >= entryDate.slice(0, 10));

  return (
    <div className="h-48 w-full">
      <div className="flex gap-1 mb-2">
        {(["today", "7d", "30d"] as ChartRange[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
              range === r
                ? "bg-[#007AFF] text-white"
                : "bg-[#F5F5F7] text-[#424245] hover:bg-[#E5E8EB]"
            }`}
          >
            {r === "today" ? "Today" : r.toUpperCase()}
          </button>
        ))}
      </div>
      {data.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-xs text-[#86868B] border border-dashed border-[#E5E8EB] rounded-2xl">
          Refresh prices to load chart data
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`pf-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#007AFF" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#007AFF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: "#86868B" }}
              tickFormatter={(v) => String(v).slice(5)}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 9, fill: "#86868B" }}
              width={48}
              tickFormatter={(v) => `$${Number(v).toFixed(0)}`}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                fontSize: 11,
                border: "1px solid #E5E8EB",
              }}
              formatter={(v: number) => [`$${v.toFixed(2)}`, symbol]}
            />
            <ReferenceLine
              y={entryPrice}
              stroke="#86868B"
              strokeDasharray="4 4"
              label={{
                value: "Entry",
                position: "insideTopRight",
                fontSize: 9,
                fill: "#86868B",
              }}
            />
            {entryInRange ? (
              <ReferenceLine
                x={entryDate.slice(0, 10)}
                stroke="#34C759"
                strokeDasharray="3 3"
              />
            ) : null}
            <Area
              type="monotone"
              dataKey="value"
              stroke="#007AFF"
              fill={`url(#pf-${symbol})`}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
