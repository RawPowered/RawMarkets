import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NewsBayItem,
  NewsBayPrefsResponse,
  NewsBayResponse,
  NewsBaySourcesResponse,
  NewsBayWatchlistResponse,
  NewsFeedLane,
  NewsItem,
  NewsResponse,
  NewsSourceClass,
  JournalEntryResponse,
} from "../../types";
import { apiFetch, apiUrl, readApiJson } from "../../lib/api";
import { useReader } from "../../context/ReaderContext";
import { useRegisterPageDetail } from "../../context/PlatformContext";
import NewsSentimentGauge from "./NewsSentimentGauge";
import NewsArticleList from "./NewsArticleList";
import NewsSourceChips, { type SentimentFilter } from "./NewsSourceChips";
import { Newspaper, Search, X, AlertCircle } from "lucide-react";
import SymbolLogo from "../SymbolLogo";

type TabId = "rss" | "serpapi";

const LANE_TABS: { id: NewsFeedLane; label: string }[] = [
  { id: "company", label: "Company" },
  { id: "macro", label: "Macro Impact" },
  { id: "context", label: "Energy & Futures" },
  { id: "crowd", label: "Crowd" },
];

interface NewsBayPageProps {
  hasSerpapiKey?: boolean;
  initialSymbol?: string;
}

export default function NewsBayPage({
  hasSerpapiKey = false,
  initialSymbol,
}: NewsBayPageProps) {
  const { openUrl } = useReader();
  const [tab, setTab] = useState<TabId>("rss");
  const [activeLane, setActiveLane] = useState<NewsFeedLane>("company");
  const [watchlist, setWatchlist] = useState<
    NewsBayWatchlistResponse["symbols"]
  >([]);
  const [feedDefs, setFeedDefs] = useState<
    NewsBaySourcesResponse["sources"]
  >([]);
  const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol ?? "");
  const [aggregateAll, setAggregateAll] = useState(false);
  const [enabledFeedIds, setEnabledFeedIds] = useState<Set<string>>(new Set());
  const [sentimentFilter, setSentimentFilter] =
    useState<SentimentFilter>("all");
  const [rssItems, setRssItems] = useState<NewsBayItem[]>([]);
  const [serpItems, setSerpItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rssCacheRef = useRef<Map<string, NewsBayItem[]>>(new Map());
  const serpCacheRef = useRef<Map<string, NewsItem[]>>(new Map());
  const [clipStatus, setClipStatus] = useState<string | null>(null);
  const [queryInput, setQueryInput] = useState("");
  const [activeSerpQuery, setActiveSerpQuery] = useState("");
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useRegisterPageDetail("news-bay", {
    newsBaySymbol: aggregateAll ? undefined : selectedSymbol || undefined,
    newsBayLane: activeLane,
  });

  useEffect(() => {
    void (async () => {
      try {
        const [wl, src, prefsRes] = await Promise.all([
          readApiJson<NewsBayWatchlistResponse>(
            await apiFetch("/api/news-bay/watchlist")
          ),
          readApiJson<NewsBaySourcesResponse>(
            await apiFetch("/api/news-bay/sources?lane=all")
          ),
          readApiJson<NewsBayPrefsResponse>(
            await apiFetch("/api/news-bay/prefs")
          ).catch(() => ({ success: true, prefs: {} } as NewsBayPrefsResponse)),
        ]);
        setWatchlist(wl.symbols ?? []);
        const sources = src.sources ?? [];
        setFeedDefs(sources);
        const prefs = prefsRes.prefs ?? {};
        const enabled = new Set<string>();
        for (const s of sources) {
          const on = prefs[s.id] !== undefined ? prefs[s.id] : s.enabledDefault;
          if (on) enabled.add(s.id);
        }
        setEnabledFeedIds(enabled);
        setPrefsLoaded(true);
        if (!selectedSymbol && wl.symbols?.length) {
          const init =
            initialSymbol &&
            wl.symbols.some((s) => s.symbol === initialSymbol)
              ? initialSymbol
              : wl.symbols[0].symbol;
          setSelectedSymbol(init);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [initialSymbol]);

  const persistPrefs = useCallback(async (feedIds: Set<string>) => {
    const prefs: Record<string, boolean> = {};
    for (const f of feedDefs) {
      prefs[f.id] = feedIds.has(f.id);
    }
    try {
      await apiFetch("/api/news-bay/prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefs }),
      });
    } catch {
      /* ignore */
    }
  }, [feedDefs]);

  const laneFeedDefs = useMemo(
    () => feedDefs.filter((f) => f.lane === activeLane),
    [feedDefs, activeLane]
  );

  const buildRssQuery = useCallback(
    (
      feedList: string,
      sym: string,
      mode: string,
      opts?: { booted?: boolean; fast?: boolean; forceFresh?: boolean }
    ) => {
      const params = new URLSearchParams({
        lane: activeLane,
        symbol: sym,
        mode,
        feeds: feedList || "all",
      });
      if (opts?.forceFresh) params.set("fresh", "1");
      if (opts?.booted) params.set("booted", "1");
      if (opts?.fast) params.set("fast", "1");
      return params.toString();
    },
    [activeLane]
  );

  const fetchRss = useCallback(
    async (options?: { forceFresh?: boolean }) => {
      const laneFeeds = laneFeedDefs.filter((f) => enabledFeedIds.has(f.id));
      const feedList = laneFeeds.map((f) => f.id).join(",");
      const sym = aggregateAll ? "ALL" : selectedSymbol;
      const mode = aggregateAll ? "all" : "single";
      const needsSymbol = activeLane === "company" || activeLane === "crowd";
      if (needsSymbol && !aggregateAll && !selectedSymbol) {
        setRssItems([]);
        return;
      }

      const cacheKey = `${activeLane}|${sym}|${mode}|${feedList}`;
      const cached = rssCacheRef.current.get(cacheKey);
      if (cached?.length && !options?.forceFresh) {
        setRssItems(cached);
      }

      const hadItems = (cached?.length ?? 0) > 0;
      if (!hadItems) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const applyItems = (items: NewsBayItem[]) => {
        setRssItems(items);
        if (items.length > 0) rssCacheRef.current.set(cacheKey, items);
      };

      try {
        if (!options?.forceFresh) {
          const instantQs = buildRssQuery(feedList, sym, mode, {
            booted: true,
            fast: true,
          });
          const resInstant = await fetch(apiUrl(`/api/news-bay?${instantQs}`));
          const dataInstant: NewsBayResponse = await resInstant.json();
          if (dataInstant.success && (dataInstant.items?.length ?? 0) > 0) {
            applyItems(dataInstant.items ?? []);
            setLoading(false);
          }
        }

        const fullQs = buildRssQuery(feedList, sym, mode, {
          forceFresh: options?.forceFresh,
        });
        const resFull = await fetch(apiUrl(`/api/news-bay?${fullQs}`));
        const dataFull: NewsBayResponse = await resFull.json();
        if (!dataFull.success) {
          throw new Error(dataFull.message ?? "News bay fetch failed");
        }
        applyItems(dataFull.items ?? []);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        const stillHave =
          (rssCacheRef.current.get(cacheKey)?.length ?? 0) > 0;
        if (!stillHave) setRssItems([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      aggregateAll,
      selectedSymbol,
      enabledFeedIds,
      activeLane,
      laneFeedDefs,
      buildRssQuery,
    ]
  );

  const fetchSerp = useCallback(async (q: string) => {
    const cacheKey = q.trim().toUpperCase();
    const cached = serpCacheRef.current.get(cacheKey);
    if (cached?.length) setSerpItems(cached);

    const hadItems = (cached?.length ?? 0) > 0;
    if (!hadItems) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const res = await fetch(
        apiUrl(`/api/news?q=${encodeURIComponent(q)}&manual=1`)
      );
      const data: NewsResponse = await res.json();
      if (!data.success) throw new Error("SerpApi request failed");
      const items = data.items ?? [];
      setSerpItems(items);
      if (items.length > 0) serpCacheRef.current.set(cacheKey, items);
      if (data.source !== "serpapi" && data.message) {
        setError(data.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      if (!serpCacheRef.current.get(cacheKey)?.length) setSerpItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (tab !== "rss" || !prefsLoaded) return;
    const needsSymbol = activeLane === "company" || activeLane === "crowd";
    if (needsSymbol && !selectedSymbol && !aggregateAll) return;
    void fetchRss();
  }, [tab, fetchRss, selectedSymbol, aggregateAll, prefsLoaded, activeLane]);

  const displayItems = useMemo(() => {
    const base: NewsItem[] = tab === "rss" ? rssItems : serpItems;
    if (sentimentFilter === "all") return base;
    return base.filter((n) => n.sentiment === sentimentFilter);
  }, [tab, rssItems, serpItems, sentimentFilter]);

  const linkedKey = aggregateAll
    ? selectedSymbol || watchlist[0]?.symbol || ""
    : selectedSymbol;

  const handleClip = async (item: NewsItem) => {
    try {
      const resp = await apiFetch("/api/journal/clip-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item, linked_asset_key: linkedKey }),
      });
      const data = await readApiJson<JournalEntryResponse>(resp);
      setClipStatus(
        data.duplicate ? "Already in journal" : "Saved to Investors Journal"
      );
      setTimeout(() => setClipStatus(null), 2500);
    } catch (err: unknown) {
      setClipStatus(err instanceof Error ? err.message : String(err));
      setTimeout(() => setClipStatus(null), 3000);
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

  const toggleFeed = (id: string) => {
    setEnabledFeedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      void persistPrefs(next);
      return next;
    });
  };

  const toggleClass = (sourceClass: NewsSourceClass, enable: boolean) => {
    setEnabledFeedIds((prev) => {
      const next = new Set(prev);
      for (const f of laneFeedDefs) {
        if (f.sourceClass === sourceClass) {
          if (enable) next.add(f.id);
          else next.delete(f.id);
        }
      }
      void persistPrefs(next);
      return next;
    });
  };

  const handleSerpSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (queryInput.trim()) setActiveSerpQuery(queryInput.trim());
  };

  const showSymbolPicker =
    tab === "rss" &&
    (activeLane === "company" || activeLane === "crowd");

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Newspaper size={18} className="text-[#007AFF]" />
            <span className="p-1 px-2.5 bg-[#F0F7FF] text-[#007AFF] text-[10px] font-extrabold uppercase font-mono rounded-lg">
              News Bay
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-[#1D1D1F] mt-2">
            Multi-Source News Terminal
          </h2>
          <p className="text-xs text-[#86868B] mt-1 max-w-xl">
            SEC filings, company IR, newswires, and market feeds ranked by source
            class. Macro and crowd lanes stay separate from company headlines.
          </p>
        </div>
        <div className="flex gap-1 p-1 bg-[#F5F5F7] rounded-xl border border-[#E5E8EB]">
          <button
            type="button"
            onClick={() => setTab("rss")}
            className={`px-4 py-2 text-[11px] font-bold rounded-lg ${
              tab === "rss"
                ? "bg-white shadow-sm text-[#007AFF]"
                : "text-[#86868B]"
            }`}
          >
            RSS Feeds
          </button>
          <button
            type="button"
            onClick={() => setTab("serpapi")}
            className={`px-4 py-2 text-[11px] font-bold rounded-lg ${
              tab === "serpapi"
                ? "bg-white shadow-sm text-[#007AFF]"
                : "text-[#86868B]"
            }`}
          >
            SerpApi Search
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#E5E8EB] rounded-[32px] p-6 md:p-8 space-y-6 shadow-xs">
        {tab === "rss" && (
          <div className="flex flex-wrap gap-1 p-1 bg-[#F5F5F7] rounded-xl border border-[#E5E8EB]">
            {LANE_TABS.map((lt) => (
              <button
                key={lt.id}
                type="button"
                onClick={() => setActiveLane(lt.id)}
                className={`px-3 py-2 text-[10px] font-bold rounded-lg ${
                  activeLane === lt.id
                    ? "bg-white shadow-sm text-[#007AFF]"
                    : "text-[#86868B]"
                }`}
              >
                {lt.label}
              </button>
            ))}
          </div>
        )}

        {tab === "rss" && activeLane === "crowd" && (
          <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 font-semibold">
            Crowd lane: sentiment and attention only — not verified news. X/Twitter
            is manual capture only (no automated scrape).
          </p>
        )}

        <div className="flex flex-wrap gap-3 items-center">
          {showSymbolPicker && (
            <>
              <label className="text-[10px] font-bold text-[#86868B] uppercase font-mono">
                Symbol
              </label>
              {!aggregateAll && selectedSymbol ? (
                <SymbolLogo symbol={selectedSymbol} size="sm" resolveRemote />
              ) : null}
              <select
                value={aggregateAll ? "" : selectedSymbol}
                disabled={aggregateAll}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="text-xs font-semibold border border-[#E5E8EB] rounded-xl px-3 py-2 bg-[#F5F5F7]"
              >
                {watchlist.map((w) => (
                  <option key={w.symbol} value={w.symbol}>
                    {w.symbol}
                    {w.name ? ` — ${w.name}` : ""} ({w.from})
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-[11px] font-semibold text-[#1D1D1F] cursor-pointer">
                <input
                  type="checkbox"
                  checked={aggregateAll}
                  onChange={(e) => setAggregateAll(e.target.checked)}
                  className="rounded"
                />
                All my symbols
              </label>
            </>
          )}
          <button
            type="button"
            onClick={() =>
              tab === "rss"
                ? void fetchRss({ forceFresh: true })
                : void fetchSerp(activeSerpQuery || selectedSymbol)
            }
            className="ml-auto px-3 py-1.5 bg-[#007AFF] text-white text-[10px] font-bold rounded-lg"
          >
            Refresh
          </button>
        </div>

        {tab === "rss" && laneFeedDefs.length > 0 && (
          <NewsSourceChips
            feeds={laneFeedDefs.map((f) => ({
              id: f.id,
              label: f.label,
              domain: f.domain,
              sourceClass: f.sourceClass,
              lane: f.lane,
              secFormType: f.secFormType,
            }))}
            enabledFeedIds={enabledFeedIds}
            onToggleFeed={toggleFeed}
            onToggleClass={toggleClass}
            sentimentFilter={sentimentFilter}
            onSentimentFilter={setSentimentFilter}
            activeLane={activeLane}
          />
        )}

        {tab === "serpapi" && (
          <p className="text-[10px] text-[#86868B]">
            SerpApi does not load automatically. Use Search or Refresh to fetch live
            headlines.
          </p>
        )}

        {tab === "serpapi" && (
          <form onSubmit={handleSerpSearch} className="space-y-2">
            <label className="text-xs font-bold text-[#1D1D1F] block">
              SerpApi custom query
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#86868B]">
                <Search size={14} />
              </span>
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Fed rates, sector news, or leave empty for selected symbol"
                className="w-full pl-9 pr-20 py-2 bg-[#F5F5F7] border border-[#E5E8EB] rounded-xl text-xs outline-none"
              />
              <div className="absolute right-1.5 top-1.5 flex gap-1">
                {activeSerpQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setQueryInput("");
                      setActiveSerpQuery("");
                    }}
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
            {!hasSerpapiKey && (
              <p className="text-[10px] text-amber-700 font-semibold">
                No SerpApi key — add one under Config → API Keys (paid API).
              </p>
            )}
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-5">
            <NewsSentimentGauge items={displayItems} />
          </div>
          <div className="md:col-span-7 flex items-center">
            <p className="text-[11px] text-[#86868B] leading-relaxed">
              Headlines ranked by source weight, event type, freshness, and
              duplicate penalty. SEC and IR feeds surface first in the company lane.
            </p>
          </div>
        </div>

        {refreshing && displayItems.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-[#F0F7FF] border border-[#007AFF]/20 rounded-xl text-[10px] font-bold text-[#007AFF] font-mono">
            <span className="w-3 h-3 border-2 border-[#007AFF]/30 border-t-[#007AFF] rounded-full animate-spin shrink-0" />
            Updating headlines — current stories stay on screen
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl text-[11px] text-rose-800 flex gap-2">
            <AlertCircle size={14} className="shrink-0" />
            {error}
            {displayItems.length > 0 && (
              <span className="text-rose-600/80"> — showing last loaded batch</span>
            )}
          </div>
        )}

        {loading && displayItems.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center border border-[#E5E8EB] rounded-2xl bg-[#F5F5F7]/30">
            <span className="w-5 h-5 border-2 border-[#E5E8EB] border-t-[#007AFF] rounded-full animate-spin" />
            <span className="text-[11px] font-bold mt-2 font-mono">
              Loading news bay…
            </span>
          </div>
        ) : (
          <NewsArticleList
            items={displayItems}
            linkedAssetKey={linkedKey}
            clipStatus={clipStatus}
            onClip={handleClip}
            onOpen={handleOpen}
            showFeedId={tab === "rss"}
            getFeedId={(item) =>
              "feedId" in item ? (item as NewsBayItem).feedId : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
