import type { FeedSource } from "../types";
import {
  feedHistorySourceLabel,
  feedPriceSourceLabel,
  isDisplayablePriceSource,
  hasRealChartHistory,
} from "../lib/feedDisplay";

export default function FeedSourceBadge({
  priceSource,
  historySource,
  compact = false,
}: {
  priceSource?: FeedSource;
  historySource?: FeedSource;
  compact?: boolean;
}) {
  const priceLabel = feedPriceSourceLabel(priceSource);
  const chartLabel = feedHistorySourceLabel(historySource);
  const showPrice = priceLabel != null;
  const showChart = chartLabel != null && hasRealChartHistory(historySource);

  if (!showPrice && !showChart) return null;

  const priceClass =
    priceSource === "live" || priceSource === "scrape"
      ? "bg-emerald-100 text-emerald-800"
      : priceSource === "cached"
        ? "bg-amber-100 text-amber-900"
        : "bg-sky-100 text-sky-800";

  if (compact) {
    return (
      <span
        className={`text-[9px] font-extrabold px-1.5 py-0.5 font-mono rounded-[5px] uppercase ${priceClass}`}
        title={
          showChart
            ? "Chart from market feed"
            : priceSource === "cached"
              ? "Last price check stored locally"
              : "Live market price"
        }
      >
        {showPrice ? priceLabel : chartLabel}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {showPrice && (
        <span
          className={`text-[9px] font-extrabold px-1.5 py-0.5 font-mono rounded-[5px] uppercase ${priceClass}`}
        >
          {priceLabel}
        </span>
      )}
      {showChart && (
        <span className="text-[9px] font-extrabold px-1.5 py-0.5 font-mono rounded-[5px] uppercase bg-violet-100 text-violet-800">
          {chartLabel}
        </span>
      )}
    </div>
  );
}
