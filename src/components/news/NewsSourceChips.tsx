import React, { useMemo } from "react";
import NewsFaviconLogo from "./NewsFaviconLogo";
import { FEED_ID_DOMAINS } from "../../lib/newsSourceDomains";
import type { NewsFeedLane, NewsSourceClass } from "../../types";

export type SentimentFilter = "all" | "Bullish" | "Neutral" | "Negative";

interface FeedChip {
  id: string;
  label: string;
  domain?: string;
  sourceClass?: NewsSourceClass;
  lane?: NewsFeedLane;
  secFormType?: string;
}

interface NewsSourceChipsProps {
  feeds: FeedChip[];
  enabledFeedIds: Set<string>;
  onToggleFeed: (id: string) => void;
  onToggleClass?: (sourceClass: NewsSourceClass, enable: boolean) => void;
  sentimentFilter: SentimentFilter;
  onSentimentFilter: (f: SentimentFilter) => void;
  activeLane?: NewsFeedLane;
}

const CLASS_ORDER: NewsSourceClass[] = [
  "primary",
  "newswire",
  "market",
  "aggregator",
  "crowd",
];

const CLASS_LABELS: Record<NewsSourceClass, string> = {
  primary: "Primary",
  newswire: "Newswire",
  market: "Market News",
  aggregator: "Search / Aggregator",
  crowd: "Crowd",
};

export default function NewsSourceChips({
  feeds,
  enabledFeedIds,
  onToggleFeed,
  onToggleClass,
  sentimentFilter,
  onSentimentFilter,
  activeLane = "company",
}: NewsSourceChipsProps) {
  const sentiments: SentimentFilter[] = [
    "all",
    "Bullish",
    "Neutral",
    "Negative",
  ];

  const laneFeeds = useMemo(
    () => feeds.filter((f) => !f.lane || f.lane === activeLane),
    [feeds, activeLane]
  );

  const grouped = useMemo(() => {
    const map = new Map<NewsSourceClass, FeedChip[]>();
    for (const f of laneFeeds) {
      const cls = f.sourceClass ?? "market";
      if (!map.has(cls)) map.set(cls, []);
      map.get(cls)!.push(f);
    }
    return CLASS_ORDER.filter((c) => map.has(c)).map((c) => ({
      sourceClass: c,
      feeds: map.get(c)!,
    }));
  }, [laneFeeds]);

  return (
    <div className="space-y-3">
      {grouped.map(({ sourceClass, feeds: classFeeds }) => {
        const allOn = classFeeds.every((f) => enabledFeedIds.has(f.id));
        return (
          <div key={sourceClass}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold text-[#86868B]">
                {CLASS_LABELS[sourceClass].toUpperCase()}
              </span>
              {onToggleClass && (
                <button
                  type="button"
                  onClick={() => onToggleClass(sourceClass, !allOn)}
                  className="text-[9px] font-bold text-[#007AFF] hover:underline"
                >
                  {allOn ? "Disable all" : "Enable all"}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {classFeeds.map((f) => {
                const on = enabledFeedIds.has(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onToggleFeed(f.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold border transition-colors ${
                      on
                        ? "bg-white border-[#007AFF] ring-1 ring-[#007AFF] text-[#007AFF]"
                        : "bg-[#F5F5F7]/70 border-[#E5E8EB] text-[#86868B]"
                    }`}
                  >
                    <NewsFaviconLogo
                      domain={f.domain ?? FEED_ID_DOMAINS[f.id]}
                      label={f.label}
                      size="xs"
                      ringClass="ring-1 ring-[#E5E8EB]"
                    />
                    {f.label}
                    {f.secFormType ? (
                      <span className="opacity-70 font-mono text-[8px]">
                        {f.secFormType}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <div>
        <span className="text-[10px] font-mono font-bold text-[#86868B] block mb-2">
          SENTIMENT
        </span>
        <div className="flex flex-wrap gap-1.5">
          {sentiments.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSentimentFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-semibold border transition-colors ${
                sentimentFilter === s
                  ? "bg-[#1D1D1F] text-white border-[#1D1D1F]"
                  : "bg-[#F5F5F7]/70 border-[#E5E8EB] text-[#1D1D1F]"
              }`}
            >
              {s === "all" ? "All" : s === "Negative" ? "Bearish" : s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
