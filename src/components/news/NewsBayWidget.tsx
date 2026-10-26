import React, { useEffect, useRef, useState } from "react";
import { Newspaper, ArrowRight } from "lucide-react";
import type { NewsBayItem, NewsBayResponse } from "../../types";
import { apiUrl } from "../../lib/api";
import NewsSentimentGauge from "./NewsSentimentGauge";
import NewsArticleList from "./NewsArticleList";
import { useReader } from "../../context/ReaderContext";
import { apiFetch, readApiJson } from "../../lib/api";
import type { JournalEntryResponse, NewsItem } from "../../types";

interface NewsBayWidgetProps {
  symbol: string;
  assetName?: string;
  onOpenNewsBay?: () => void;
  maxItems?: number;
}

const WIDGET_FEEDS =
  "sec_8k,sec_10q,sec_10k,sec_form4,company_ir,globenewswire,prnewswire";

export default function NewsBayWidget({
  symbol,
  assetName,
  onOpenNewsBay,
  maxItems = 5,
}: NewsBayWidgetProps) {
  const { openUrl } = useReader();
  const [items, setItems] = useState<NewsBayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clipStatus, setClipStatus] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, NewsBayItem[]>>(new Map());

  useEffect(() => {
    if (!symbol) return;

    const cacheKey = symbol.toUpperCase();
    const cached = cacheRef.current.get(cacheKey);
    if (cached?.length) {
      setItems(cached.slice(0, maxItems));
    }

    const hadItems = (cached?.length ?? 0) > 0;
    if (!hadItems) setLoading(true);
    else setRefreshing(true);

    let cancelled = false;

    const apply = (next: NewsBayItem[]) => {
      if (cancelled) return;
      const slice = next.slice(0, maxItems);
      setItems(slice);
      if (slice.length > 0) cacheRef.current.set(cacheKey, next);
    };

    void (async () => {
      try {
        const base = new URLSearchParams({
          lane: "company",
          symbol,
          feeds: WIDGET_FEEDS,
        });

        const instant = new URLSearchParams(base);
        instant.set("booted", "1");
        instant.set("fast", "1");
        const resInstant = await fetch(
          apiUrl(`/api/news-bay?${instant.toString()}`)
        );
        const dataInstant: NewsBayResponse = await resInstant.json();
        if (dataInstant.success && (dataInstant.items?.length ?? 0) > 0) {
          apply(dataInstant.items ?? []);
          setLoading(false);
        }

        const resFull = await fetch(apiUrl(`/api/news-bay?${base.toString()}`));
        const dataFull: NewsBayResponse = await resFull.json();
        if (dataFull.success) {
          apply(dataFull.items ?? []);
        }
      } catch {
        if (!cacheRef.current.get(cacheKey)?.length) apply([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [symbol, maxItems]);

  const handleClip = async (item: NewsItem) => {
    try {
      const resp = await apiFetch("/api/journal/clip-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item, linked_asset_key: symbol }),
      });
      const data = await readApiJson<JournalEntryResponse>(resp);
      setClipStatus(
        data.duplicate ? "Already in journal" : "Saved to Investors Journal"
      );
      setTimeout(() => setClipStatus(null), 2500);
    } catch (err: unknown) {
      setClipStatus(err instanceof Error ? err.message : String(err));
    }
  };

  const handleOpen = (item: NewsItem) => {
    if (item.link && item.link !== "#") {
      openUrl(item.link, { title: item.title, openDrawer: true });
    } else {
      openUrl("#", {
        previewOnly: true,
        previewTitle: item.title,
        previewSnippet: item.snippet,
        title: item.title,
        openDrawer: true,
      });
    }
  };

  return (
    <div className="bg-white border border-[#E5E8EB] rounded-[32px] p-5 md:p-6 space-y-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Newspaper size={14} className="text-[#007AFF]" />
            <span className="text-[10px] font-extrabold uppercase font-mono text-[#007AFF] bg-[#F0F7FF] px-2 py-0.5 rounded-lg">
              News Bay
            </span>
            <span className="text-[9px] font-mono text-[#34C759] font-bold">
              FREE RSS
            </span>
          </div>
          <h3 className="text-sm font-bold text-[#1D1D1F] mt-1">
            {assetName ?? symbol} headlines
          </h3>
        </div>
        {onOpenNewsBay && (
          <button
            type="button"
            onClick={onOpenNewsBay}
            className="inline-flex items-center gap-1 text-[10px] font-bold text-[#007AFF] hover:underline shrink-0"
          >
            Open News Bay
            <ArrowRight size={12} />
          </button>
        )}
      </div>

      {refreshing && items.length > 0 && (
        <p className="text-[9px] font-mono font-bold text-[#007AFF] flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 border-2 border-[#007AFF]/30 border-t-[#007AFF] rounded-full animate-spin" />
          Updating…
        </p>
      )}

      {loading && items.length === 0 ? (
        <div className="h-24 flex items-center justify-center">
          <span className="w-4 h-4 border-2 border-[#E5E8EB] border-t-[#007AFF] rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-[11px] text-[#86868B] font-semibold py-4 text-center border border-dashed border-[#E5E8EB] rounded-xl">
          No RSS headlines yet for {symbol}.
        </p>
      ) : (
        <>
          <NewsSentimentGauge items={items} compact />
          <NewsArticleList
            items={items}
            linkedAssetKey={symbol}
            clipStatus={clipStatus}
            onClip={handleClip}
            onOpen={handleOpen}
            columns={1}
          />
        </>
      )}
    </div>
  );
}
