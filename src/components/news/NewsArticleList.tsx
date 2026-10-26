import React from "react";
import type { NewsItem } from "../../types";
import NewsArticleCard from "./NewsArticleCard";

interface NewsArticleListProps {
  items: NewsItem[];
  linkedAssetKey: string;
  clipStatus?: string | null;
  onClip: (item: NewsItem) => void;
  onOpen: (item: NewsItem) => void;
  columns?: 1 | 2;
  showFeedId?: boolean;
  getFeedId?: (item: NewsItem) => string | undefined;
}

export default function NewsArticleList({
  items,
  linkedAssetKey,
  clipStatus,
  onClip,
  onOpen,
  columns = 2,
  showFeedId = false,
  getFeedId,
}: NewsArticleListProps) {
  if (items.length === 0) {
    return (
      <div className="p-6 text-center border border-dashed border-[#E5E8EB] rounded-2xl">
        <p className="text-xs text-[#86868B] font-semibold">
          No recent market bulletins found for this segment.
        </p>
      </div>
    );
  }

  const withImages = items.filter((i) => i.imageUrl).length;

  return (
    <div className="space-y-2">
      {clipStatus && (
        <p className="text-[10px] font-mono font-bold text-[#34C759] px-1">
          {clipStatus}
        </p>
      )}
      {withImages > 0 && (
        <p className="text-[9px] text-[#86868B] font-mono px-1">
          {withImages} of {items.length} with featured images (RSS media / SerpApi)
        </p>
      )}
      <div
        className={`grid grid-cols-1 ${columns === 2 ? "md:grid-cols-2" : ""} gap-4 animate-fade-in`}
      >
        {items.map((item, index) => (
          <div key={`${item.link}-${index}`} className="min-h-0">
            <NewsArticleCard
              item={item}
              linkedAssetKey={linkedAssetKey}
              feedId={getFeedId?.(item)}
              showFeedId={showFeedId}
              onClip={onClip}
              onOpen={onOpen}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
