import type { NewsItem } from "../types";

export interface NewsSentimentStats {
  totalCount: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  bullishPercent: number;
  bearishPercent: number;
  neutralPercent: number;
  averageScore: number;
}

export function computeNewsSentimentStats(items: NewsItem[]): NewsSentimentStats {
  const totalCount = items.length;
  const bullishCount = items.filter((n) => n.sentiment === "Bullish").length;
  const bearishCount = items.filter((n) => n.sentiment === "Negative").length;
  const neutralCount = items.filter((n) => n.sentiment === "Neutral").length;

  return {
    totalCount,
    bullishCount,
    bearishCount,
    neutralCount,
    bullishPercent:
      totalCount > 0 ? Math.round((bullishCount / totalCount) * 100) : 0,
    bearishPercent:
      totalCount > 0 ? Math.round((bearishCount / totalCount) * 100) : 0,
    neutralPercent:
      totalCount > 0 ? Math.round((neutralCount / totalCount) * 100) : 0,
    averageScore:
      totalCount > 0
        ? (items.reduce((acc, curr) => acc + curr.score, 0) / totalCount) * 100
        : 0,
  };
}

export function sentimentVerdict(averageScore: number): string {
  if (averageScore > 25) return "Aggressively Bullish";
  if (averageScore > 10) return "Moderately Optimistic";
  if (averageScore < -25) return "Highly Bearish";
  if (averageScore < -10) return "Slight Sell Resistance";
  return "Balanced Neutral";
}

export function getScoreColor(score: number): string {
  if (score > 15) return "text-[#34C759]";
  if (score < -15) return "text-[#FF3B30]";
  return "text-amber-500";
}

export function getScoreBackground(score: number): string {
  if (score > 15) return "bg-[#34C759]/10 border-[#34C759]/20";
  if (score < -15) return "bg-[#FF3B30]/10 border-[#FF3B30]/20";
  return "bg-amber-500/10 border-amber-500/20";
}
