import React, { useState } from "react";
import { ArrowUpRight, BookmarkPlus } from "lucide-react";
import type { NewsBayItem, NewsItem } from "../../types";
import NewsArticleLogos from "./NewsArticleLogos";

interface NewsArticleCardProps {
  item: NewsItem;
  linkedAssetKey: string;
  feedId?: string;
  showFeedId?: boolean;
  onClip: (item: NewsItem) => void;
  onOpen: (item: NewsItem) => void;
}

function sentimentChipClass(sentiment: NewsItem["sentiment"]): string {
  if (sentiment === "Bullish") {
    return "bg-[#34C759]/95 text-white border-[#34C759]/30 shadow-sm";
  }
  if (sentiment === "Negative") {
    return "bg-[#FF3B30]/95 text-white border-[#FF3B30]/30 shadow-sm";
  }
  return "bg-[#1D1D1F]/75 text-white border-white/20 shadow-sm backdrop-blur-sm";
}

export default function NewsArticleCard({
  item,
  linkedAssetKey,
  feedId,
  showFeedId,
  onClip,
  onOpen,
}: NewsArticleCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const hasImage = Boolean(item.imageUrl && !imgFailed);

  const metaRow = (
    <div className="flex items-center gap-2.5 min-w-0">
      <NewsArticleLogos
        item={item}
        defaultStockSymbol={linkedAssetKey}
        feedId={feedId}
      />
      <div className="min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-extrabold text-[#1D1D1F] truncate max-w-[160px]">
            {item.source}
          </span>
          {"sourceClass" in item && (item as NewsBayItem).sourceClass && (
            <span className="text-[8px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-[#F0F7FF] text-[#007AFF]">
              {(item as NewsBayItem).sourceClass}
            </span>
          )}
          {"eventType" in item && (item as NewsBayItem).eventType && (
            <span className="text-[8px] font-mono font-bold text-[#86868B]">
              {(item as NewsBayItem).eventType}
            </span>
          )}
          {showFeedId && feedId && (
            <span className="text-[9px] text-[#007AFF] font-mono font-bold">
              {feedId}
            </span>
          )}
        </div>
        <span className="text-[9px] text-[#86868B] font-mono font-bold">
          {item.date}
          {item.stockSymbol ? (
            <span className="text-[#007AFF] ml-1.5">· {item.stockSymbol}</span>
          ) : null}
        </span>
      </div>
    </div>
  );

  const actions = (
    <div className="flex items-center justify-between pt-3 border-t border-[#E5E8EB]/55">
      <span className="text-[9px] font-bold text-[#86868B] font-mono">
        {"rankScore" in item && (item as NewsBayItem).rankScore != null
          ? `Rank ${(item as NewsBayItem).rankScore!.toFixed(2)}`
          : null}
        {"rankScore" in item && (item as NewsBayItem).rankScore != null
          ? " · "
          : ""}
        Sentiment {(item.score * 100).toFixed(0)}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void onClip(item)}
          className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#86868B] hover:text-[#007AFF]"
          title="Clip to Investors Journal"
        >
          <BookmarkPlus size={10} />
          Clip
        </button>
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#007AFF] hover:underline"
        >
          Open
          <ArrowUpRight size={10} />
        </button>
      </div>
    </div>
  );

  if (!hasImage) {
    return (
      <article className="group p-4 bg-white border border-[#E5E8EB] hover:border-[#86868B] hover:shadow-md rounded-2xl transition-all duration-300 flex flex-col justify-between min-h-[180px]">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            {metaRow}
            <span
              className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md font-mono shrink-0 border ${
                item.sentiment === "Bullish"
                  ? "bg-[#34C759]/10 text-[#34C759] border-[#34C759]/20"
                  : item.sentiment === "Negative"
                    ? "bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/20"
                    : "bg-[#86868B]/10 text-[#86868B] border-[#86868B]/20"
              }`}
            >
              {item.sentiment}
            </span>
          </div>
          <h4 className="text-sm font-bold text-[#1D1D1F] group-hover:text-[#007AFF] transition-colors leading-snug line-clamp-3">
            {item.title}
          </h4>
          <p className="text-[11px] text-[#86868B] leading-relaxed line-clamp-2">
            {item.snippet}
          </p>
        </div>
        <div className="mt-3">{actions}</div>
      </article>
    );
  }

  return (
    <article className="group overflow-hidden bg-white border border-[#E5E8EB] hover:border-[#86868B] hover:shadow-lg rounded-2xl transition-all duration-300 flex flex-col">
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="relative block w-full aspect-[16/9] overflow-hidden bg-[#F5F5F7] text-left cursor-pointer"
      >
        <img
          src={item.imageUrl!}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1D1D1F]/85 via-[#1D1D1F]/25 to-transparent pointer-events-none" />
        <div className="absolute top-2.5 right-2.5 pointer-events-none">
          <span
            className={`text-[9px] font-extrabold px-2 py-1 rounded-md font-mono border ${sentimentChipClass(item.sentiment)}`}
          >
            {item.sentiment}
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-3 pt-8 pointer-events-none">
          <div className="flex items-end gap-2.5">
            <div className="pointer-events-auto shrink-0 drop-shadow-md">
              <NewsArticleLogos
                item={item}
                defaultStockSymbol={linkedAssetKey}
                feedId={feedId}
              />
            </div>
            <div className="min-w-0 text-white">
              <p className="text-[10px] font-extrabold truncate drop-shadow-sm">
                {item.source}
              </p>
              <p className="text-[9px] font-mono opacity-90">
                {item.date}
                {item.stockSymbol ? ` · ${item.stockSymbol}` : ""}
              </p>
            </div>
          </div>
        </div>
      </button>

      <div className="p-4 flex flex-col flex-1 gap-2">
        <h4 className="text-sm font-bold text-[#1D1D1F] group-hover:text-[#007AFF] transition-colors leading-snug line-clamp-2">
          {item.title}
        </h4>
        <p className="text-[11px] text-[#86868B] leading-relaxed line-clamp-2 flex-1">
          {item.snippet}
        </p>
        {actions}
      </div>
    </article>
  );
}
