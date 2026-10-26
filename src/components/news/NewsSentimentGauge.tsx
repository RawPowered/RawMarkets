import React from "react";
import type { NewsItem } from "../../types";
import {
  computeNewsSentimentStats,
  getScoreBackground,
  getScoreColor,
  sentimentVerdict,
} from "../../lib/newsSentimentUi";

interface NewsSentimentGaugeProps {
  items: NewsItem[];
  compact?: boolean;
}

export default function NewsSentimentGauge({
  items,
  compact = false,
}: NewsSentimentGaugeProps) {
  const stats = computeNewsSentimentStats(items);
  const { averageScore, bullishPercent, bearishPercent, neutralPercent } = stats;

  if (compact && items.length === 0) {
    return (
      <p className="text-[10px] text-[#86868B] font-semibold">No headlines to score.</p>
    );
  }

  return (
    <div
      className={`p-5 bg-[#F5F5F7] rounded-3xl border border-[#E5E8EB] flex flex-col justify-between space-y-4 ${
        compact ? "p-4 space-y-3" : ""
      }`}
    >
      <div>
        <span className="text-[9px] font-extrabold text-[#86868B] uppercase tracking-wider block font-mono">
          Combined Sentiment Index
        </span>
        <div className="flex items-baseline gap-1 mt-1">
          <span
            className={`${compact ? "text-2xl" : "text-4xl"} font-extrabold tracking-tighter ${getScoreColor(averageScore)}`}
          >
            {averageScore >= 0 ? "+" : ""}
            {averageScore.toFixed(0)}
          </span>
          {!compact && (
            <span className="text-xs text-[#86868B] font-semibold">/ 100 rating</span>
          )}
        </div>
        <div
          className={`mt-2 px-2.5 py-1 text-[11px] font-bold rounded-lg border inline-block ${getScoreBackground(averageScore)} ${getScoreColor(averageScore)}`}
        >
          {sentimentVerdict(averageScore)}
        </div>
      </div>

      <div className="space-y-1 pt-2">
        <div className="w-full h-2 rounded-full bg-[#E5E8EB] relative overflow-hidden flex">
          <div className="h-full bg-[#FF3B30] w-1/3" />
          <div className="h-full bg-amber-500 w-1/3" />
          <div className="h-full bg-[#34C759] w-1/3" />
          <div
            className="absolute top-0 bottom-0 w-2.5 h-4 -mt-1 bg-[#1D1D1F] rounded-full border border-white shadow-md transition-all duration-500"
            style={{
              left: `calc(${((averageScore + 100) / 200) * 100}% - 5px)`,
            }}
          />
        </div>
        <div className="flex justify-between text-[9px] font-bold text-[#86868B] font-mono">
          <span>Bearish</span>
          <span>Neutral</span>
          <span>Bullish</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 text-center">
        <div className="bg-white p-2 rounded-xl border border-[#E5E8EB]/50">
          <span className="text-[10px] text-[#34C759] font-bold block">
            {bullishPercent}%
          </span>
          <span className="text-[8px] text-[#86868B] uppercase tracking-wider font-extrabold font-mono block">
            Bullish
          </span>
        </div>
        <div className="bg-white p-2 rounded-xl border border-[#E5E8EB]/50">
          <span className="text-[10px] text-[#86868B] font-bold block">
            {neutralPercent}%
          </span>
          <span className="text-[8px] text-[#86868B] uppercase tracking-wider font-extrabold font-mono block">
            Neutral
          </span>
        </div>
        <div className="bg-white p-2 rounded-xl border border-[#E5E8EB]/50">
          <span className="text-[10px] text-[#FF3B30] font-bold block">
            {bearishPercent}%
          </span>
          <span className="text-[8px] text-[#86868B] uppercase tracking-wider font-extrabold font-mono block">
            Bearish
          </span>
        </div>
      </div>
    </div>
  );
}
