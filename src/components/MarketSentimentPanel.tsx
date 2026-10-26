import React, { useEffect, useState } from "react";
import { NewsItem, NewsResponse, JournalEntryResponse } from "../types";
import { apiFetch, apiUrl, readApiJson } from "../lib/api";
import { useReader } from "../context/ReaderContext";
import NewsSentimentGauge from "./news/NewsSentimentGauge";
import NewsArticleList from "./news/NewsArticleList";
import { Search, X, AlertCircle } from "lucide-react";

interface MarketSentimentPanelProps {
  selectedSymbol: string;
  selectedAssetName: string;
  onSerpApiStatusFound?: (active: boolean) => void;
}

export default function MarketSentimentPanel({
  selectedSymbol,
  selectedAssetName,
  onSerpApiStatusFound,
}: MarketSentimentPanelProps) {
  const { openUrl } = useReader();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [source, setSource] = useState<string>("pending");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [queryInput, setQueryInput] = useState<string>("");
  const [activeSearchQuery, setActiveSearchQuery] = useState<string>("");
  const [clipStatus, setClipStatus] = useState<string | null>(null);

  const handleAccessArticle = (item: NewsItem) => {
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

  const handleClipNews = async (item: NewsItem) => {
    try {
      const resp = await apiFetch("/api/journal/clip-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...item,
          linked_asset_key: selectedSymbol,
        }),
      });
      const data = await readApiJson<JournalEntryResponse>(resp);
      setClipStatus(
        data.duplicate ? "Already in journal" : "Saved to Investors Journal"
      );
      setTimeout(() => setClipStatus(null), 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setClipStatus(msg);
      setTimeout(() => setClipStatus(null), 3000);
    }
  };

  const fetchNews = async (symbolQuery: string, customQuery: string) => {
    setLoading(true);
    setError(null);
    try {
      const searchParam = customQuery ? customQuery : symbolQuery;
      const res = await fetch(
        apiUrl(
          `/api/news?q=${encodeURIComponent(searchParam)}&manual=1`
        )
      );
      if (!res.ok) {
        throw new Error(`HTTP Error status: ${res.status}`);
      }
      const data: NewsResponse = await res.json();
      if (data.success && data.items) {
        setNews(data.items);
        setSource(data.source);
        if (onSerpApiStatusFound) {
          onSerpApiStatusFound(data.source === "serpapi");
        }
        if (data.source !== "serpapi" && data.message) {
          setError(data.message);
        }
      } else {
        throw new Error("Invalid SerpApi response payload.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Unable to parse sentiment reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setNews([]);
    setSource("pending");
    setError(null);
    setActiveSearchQuery("");
    setQueryInput("");
  }, [selectedSymbol]);

  const handleCustomSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = queryInput.trim() || selectedSymbol;
    if (!q) return;
    setActiveSearchQuery(q);
    void fetchNews(selectedSymbol, queryInput.trim());
  };

  const handleLoadSymbolNews = () => {
    setActiveSearchQuery(selectedSymbol);
    void fetchNews(selectedSymbol, "");
  };

  const handleClearSearch = () => {
    setQueryInput("");
    setActiveSearchQuery("");
    setNews([]);
    setSource("pending");
    setError(null);
    setLoading(false);
  };

  return (
    <div className="bg-white border border-[#E5E8EB] rounded-[32px] p-6 md:p-8 space-y-6 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E5E8EB]">
        <div>
          <span className="p-1 px-2.5 bg-[#F0F7FF] text-[#007AFF] text-[10px] font-extrabold uppercase font-mono rounded-lg">
            SerpApi Search
          </span>
          <h3 className="text-base font-bold tracking-tight text-[#1D1D1F] mt-1.5">
            Paid Google News Search
          </h3>
          <p className="text-xs text-[#86868B]">
            SerpApi does not auto-fetch. Search manually for{" "}
            {activeSearchQuery ? `"${activeSearchQuery}"` : selectedAssetName}.
            Use News Bay for free RSS.
          </p>
        </div>
        <span
          className={`px-3 py-1 text-[10px] font-extrabold rounded-full font-mono border self-start md:self-auto ${
            source === "serpapi"
              ? "bg-[#34C759]/5 border-[#34C759]/20 text-[#34C759]"
              : "bg-blue-500/5 border-blue-500/20 text-[#007AFF]"
          }`}
        >
          {source === "serpapi" ? "LIVE SERPAPI" : "KEY REQUIRED"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-5">
          <NewsSentimentGauge items={news} />
        </div>
        <div className="md:col-span-7">
          <div className="flex flex-wrap gap-2 mb-2">
            <button
              type="button"
              onClick={handleLoadSymbolNews}
              disabled={loading || !selectedSymbol}
              className="px-3 py-1.5 bg-[#007AFF] text-white text-[10px] font-bold rounded-lg disabled:opacity-50 cursor-pointer"
            >
              Fetch SerpApi for {selectedSymbol}
            </button>
          </div>
          <form onSubmit={handleCustomSearch} className="space-y-2">
            <label className="text-xs font-bold text-[#1D1D1F] block">
              Custom SerpApi query
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#86868B]">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Fed rates, sector news…"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                className="w-full pl-9 pr-20 py-2 bg-[#F5F5F7] border border-[#E5E8EB] rounded-xl text-xs outline-none"
              />
              <div className="absolute right-1.5 top-1.5 flex gap-1">
                {activeSearchQuery && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="p-1 hover:bg-[#E5E8EB] rounded-lg"
                  >
                    <X size={12} />
                  </button>
                )}
                <button
                  type="submit"
                  className="px-2.5 py-1 bg-[#007AFF] text-white text-[10px] font-bold rounded-lg"
                >
                  Search
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {loading ? (
        <div className="w-full h-40 bg-[#F5F5F7]/30 border border-[#E5E8EB] rounded-2xl flex flex-col items-center justify-center">
          <span className="w-5 h-5 border-2 border-[#E5E8EB] border-t-[#007AFF] rounded-full animate-spin" />
          <span className="text-[11px] font-bold mt-2 font-mono">
            Fetching SerpApi…
          </span>
        </div>
      ) : error && news.length === 0 ? (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-[11px] text-rose-800 flex gap-2">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <NewsArticleList
          items={news}
          linkedAssetKey={selectedSymbol}
          clipStatus={clipStatus}
          onClip={handleClipNews}
          onOpen={handleAccessArticle}
        />
      )}
    </div>
  );
}
