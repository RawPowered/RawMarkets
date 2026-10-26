import React, { useCallback, useEffect, useRef, useState } from "react";
import Header from "./components/Header";
import AISignalPanel from "./components/AISignalPanel";
import ApiConfigInfo from "./components/ApiConfigInfo";
import AdminApiKeys from "./components/AdminApiKeys";
import { apiFetch, apiFetchWithTimeout, readApiJson } from "./lib/api";
import FeedRefreshBar, {
  type FeedRefreshPhase,
  type ScrapeActivityCurrent,
} from "./components/FeedRefreshBar";
import { patchAssetsFromMetalRates, isMetalDashboardKey } from "./lib/metalAssets";
import { isCryptoSymbol } from "./server/scrapers/types";
import DashboardOverview from "./components/DashboardOverview";
import { useDashboardLayout } from "./hooks/useDashboardLayout";
import SearchTerminal from "./components/SearchTerminal";
import InvestorsBible from "./components/InvestorsBible";
import GamblersBible from "./components/GamblersBible";
import BibleOfWealth from "./components/BibleOfWealth";
import PortfolioPage from "./components/portfolio/PortfolioPage";
import InvestorsJournalPage from "./components/journal/InvestorsJournalPage";
import { ReaderProvider } from "./context/ReaderContext";
import {
  PlatformContextProvider,
  type PlatformSnapshotInput,
} from "./context/PlatformContext";
import GlobalReaderDrawer from "./components/reader/GlobalReaderDrawer";
import LocalAiChatDrawer from "./components/localAi/LocalAiChatDrawer";
import { Asset, MarketDataResponse, SpecialMetalRate } from "./types";
import MarketLinksPage from "./components/links/MarketLinksPage";
import NewsBayPage from "./components/news/NewsBayPage";
import { StatementsAnalyzerTab } from "./features/statements-analyzer";
import {
  LayoutDashboard,
  Search,
  BrainCircuit,
  Settings,
  BookOpen,
  BookMarked,
  Wallet,
  Link2,
  Newspaper,
  FileSpreadsheet,
} from "lucide-react";
import {
  normalizeMarketFeedDisplaySource,
  sanitizeFeedNoteForDisplay,
  type MarketFeedDisplaySource,
} from "./lib/feedDisplay";

const MARKET_DEPENDENT_PAGES = ["overview", "terminal", "insights"] as const;
const QUOTE_FRESH_MS = 5 * 60 * 1000;

function isQuoteFresh(asset: Asset | undefined): boolean {
  if (!asset?.lastPriceCheckAt) return false;
  const age = Date.now() - new Date(asset.lastPriceCheckAt).getTime();
  const source = asset.priceSource;
  if (!source || !["live", "scrape", "cached"].includes(source)) return false;
  return age < QUOTE_FRESH_MS;
}

export default function App() {
  const [assets, setAssets] = useState<Record<string, Asset>>({});
  const [source, setSource] = useState<MarketFeedDisplaySource>("unavailable");
  const [marketMessage, setMarketMessage] = useState<string>("");
  const [livePriceCount, setLivePriceCount] = useState(0);
  const [simulatedPriceCount, setSimulatedPriceCount] = useState(0);
  const [forceOfflineFallback, setForceOfflineFallback] = useState(false);
  const [avRateLimited, setAvRateLimited] = useState(false);
  const [metalpriceKeyConfigured, setMetalpriceKeyConfigured] = useState(false);
  const [avDailyLimitExhausted, setAvDailyLimitExhausted] = useState(false);
  const [avQuotaResetsAt, setAvQuotaResetsAt] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string>("GOLD");
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activePage, setActivePage] = useState<
    | "overview"
    | "terminal"
    | "portfolio"
    | "insights"
    | "config"
    | "bible"
    | "gambler-bible"
    | "wealth-bible"
    | "investors-journal"
    | "market-links"
    | "news-bay"
    | "statements-analyzer"
  >("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasSerpapiKey, setHasSerpapiKey] = useState(false);
  const [metalRates, setMetalRates] = useState<Record<string, SpecialMetalRate>>({});
  const [metalSource, setMetalSource] = useState<string>("");
  const [metalsFromLive, setMetalsFromLive] = useState(false);
  const [metalsFeedNote, setMetalsFeedNote] = useState<string | null>(null);
  const [metalLoading, setMetalLoading] = useState<boolean>(false);
  const [hasMetalPriceKey, setHasMetalPriceKey] = useState<boolean>(false);
  const [feedPhase, setFeedPhase] = useState<FeedRefreshPhase>("idle");
  const [feedDetail, setFeedDetail] = useState("");
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [scrapeLog, setScrapeLog] = useState<string[]>([]);
  const [scrapeCurrent, setScrapeCurrent] = useState<ScrapeActivityCurrent | null>(
    null
  );
  const activityPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [capturingKeys, setCapturingKeys] = useState<Set<string>>(new Set());
  const [scrapersEnabled, setScrapersEnabled] = useState<boolean | null>(null);
  const [portfolioRefreshNonce, setPortfolioRefreshNonce] = useState(0);
  const [portfolioReloadNonce, setPortfolioReloadNonce] = useState(0);
  const [portfolioRefreshing, setPortfolioRefreshing] = useState(false);
  const [hiddenSymbols, setHiddenSymbols] = useState<Set<string>>(new Set());
  const [customSymbols, setCustomSymbols] = useState<Set<string>>(new Set());
  const [showHiddenSymbols, setShowHiddenSymbols] = useState(false);
  const refreshInFlight = useRef(false);
  const [localAiOpen, setLocalAiOpen] = useState(false);

  // Initialize pinned symbols state from localStorage
  const [pinnedSymbols, setPinnedSymbols] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("signalnode_pinned");
      return saved ? JSON.parse(saved) : ["GOLD", "TCG-POKE", "NTDOY"];
    } catch {
      return ["GOLD", "TCG-POKE", "NTDOY"];
    }
  });

  const dashboardLayout = useDashboardLayout({
    pinnedSymbols,
    setPinnedSymbols,
    assets,
  });

  // Fetch precious metals rates direct index
  const loadChartHistoryForKey = async (key: string) => {
    try {
      const resp = await apiFetch(
        `/api/chart-history/${encodeURIComponent(key)}`
      );
      if (!resp.ok) return;
      const data = await readApiJson<{
        success?: boolean;
        history?: Asset["history"];
        historySource?: Asset["historySource"];
        open?: number;
        high?: number;
        low?: number;
      }>(resp);
      if (!data.success || !data.history || data.history.length < 2) return;
      setAssets((prev) => {
        const item = prev[key];
        if (!item) return prev;
        return {
          ...prev,
          [key]: {
            ...item,
            history: data.history!,
            historySource: data.historySource ?? "scrape",
            open: data.open ?? item.open,
            high: data.high ?? item.high,
            low: data.low ?? item.low,
          },
        };
      });
    } catch {
      /* optional backfill */
    }
  };

  const fetchPreciousMetals = async (forceFresh = false) => {
    setMetalLoading(true);
    try {
      const params = new URLSearchParams();
      if (forceFresh) params.set("fresh", "1");
      params.set("allMetals", "1");
      const resp = await apiFetch(`/api/precious-metals?${params}`);
      if (resp.ok) {
        const data = await readApiJson<{
          success?: boolean;
          rates?: Record<string, SpecialMetalRate>;
          source?: string;
          fromLive?: boolean;
          feedNote?: string;
          message?: string;
        }>(resp);
        if (data.success && data.rates) {
          setMetalRates(data.rates);
          setMetalSource(data.source);
          setMetalsFromLive(!!data.fromLive);
          setMetalsFeedNote(data.feedNote ?? data.message ?? null);
          if (data.fromLive || /yahoo|kitco/.test(data.source ?? "")) {
            setAssets((prev) =>
              patchAssetsFromMetalRates(prev, data.rates!, true)
            );
          }
          await Promise.all([
            loadChartHistoryForKey("GOLD"),
            loadChartHistoryForKey("SILVER"),
          ]);
          return data;
        }
      }
    } catch (err) {
      console.error("Failed to load spot metals list:", err);
    } finally {
      setMetalLoading(false);
    }
    return null;
  };

  const isLauncherBoot = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("launch") === "1";
  };

  const buildMarketDataQuery = (forceFresh: boolean) => {
    const params = new URLSearchParams();
    if (isLauncherBoot() && !forceFresh) {
      params.set("booted", "1");
    } else if (forceFresh) {
      params.set("fresh", "1");
    }
    const focus = [selectedKey, ...pinnedSymbols].filter(
      (k, i, arr) => k && arr.indexOf(k) === i
    );
    if (focus.length) params.set("focus", focus.join(","));
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  };

  const pollScrapeActivity = async () => {
    try {
      const resp = await apiFetch("/api/scrape/activity");
      if (!resp.ok) return;
      const data = await readApiJson<{
        current?: ScrapeActivityCurrent | null;
        logLines?: string[];
      }>(resp);
      if (data.current && data.current.phase !== "fail") {
        setScrapeCurrent(data.current);
        const shortUrl =
          data.current.url.length > 50
            ? `${data.current.url.slice(0, 47)}…`
            : data.current.url;
        setFeedDetail(`${data.current.provider} → ${data.current.symbol} → ${shortUrl}`);
      }
      if (data.logLines?.length) {
        setScrapeLog(data.logLines.slice(-20));
      }
    } catch {
      /* polling optional */
    }
  };

  const startActivityPolling = () => {
    void pollScrapeActivity();
    if (activityPollRef.current) clearInterval(activityPollRef.current);
    activityPollRef.current = setInterval(() => void pollScrapeActivity(), 1000);
  };

  const stopActivityPolling = () => {
    if (activityPollRef.current) {
      clearInterval(activityPollRef.current);
      activityPollRef.current = null;
    }
    void pollScrapeActivity();
    setScrapeCurrent(null);
  };

  // Fetch all indicators from full-stack proxy
  const fetchMarketData = async (forceFresh = false, timeoutMs?: number) => {
    setLoading(true);
    setError(null);
    if (forceFresh) {
      setFeedPhase("market");
      setFeedDetail(
        "Market capture (API-first: metals + focus symbols in parallel)…"
      );
      startActivityPolling();
    }
    try {
      const res = await apiFetchWithTimeout(
        `/api/market-data${buildMarketDataQuery(forceFresh)}`,
        undefined,
        timeoutMs ?? (forceFresh ? 240_000 : 60_000)
      );
      if (!res.ok) {
        throw new Error(`HTTP Error Status: ${res.status}`);
      }
      const data: MarketDataResponse = await readApiJson(res);
      if (data.success && data.items) {
        const itemCount = Object.keys(data.items).length;
        if (itemCount === 0 && !forceFresh) {
          try {
            await apiFetch("/api/engine/restore-catalog", { method: "POST" });
            const retry = await apiFetchWithTimeout(
              `/api/market-data${buildMarketDataQuery(false)}`,
              undefined,
              120_000
            );
            if (retry.ok) {
              const retryData: MarketDataResponse = await readApiJson(retry);
              if (retryData.success && retryData.items && Object.keys(retryData.items).length > 0) {
                data.items = retryData.items;
                data.message = retryData.message ?? data.message;
                data.source = retryData.source ?? data.source;
              }
            }
          } catch {
            /* restore retry optional */
          }
        }
        setAssets(data.items);
        setSource(normalizeMarketFeedDisplaySource(data.source));
        setMarketMessage(sanitizeFeedNoteForDisplay(data.message) ?? data.message ?? "");
        setLivePriceCount(data.livePriceCount ?? 0);
        setSimulatedPriceCount(data.simulatedPriceCount ?? Object.keys(data.items).length);
        setForceOfflineFallback(!!data.forceOfflineFallback);
        setAvRateLimited(!!data.avRateLimited);
        setMetalpriceKeyConfigured(!!data.metalpriceKeyConfigured);
        setAvDailyLimitExhausted(!!data.avDailyLimitExhausted);
        setAvQuotaResetsAt(data.avQuotaResetsAt ?? null);
        if (data.metalsSource) setMetalSource(data.metalsSource);
        setMetalsFromLive(!!data.metalsFromLive);
        setMetalsFeedNote(data.metalsFeedNote ?? null);
        if (data.fetchedAt) setLastFetchedAt(data.fetchedAt);
        if (data.lastMarketFeedAt) setLastFetchedAt(data.lastMarketFeedAt);
        if (data.scrapeLog?.length) setScrapeLog(data.scrapeLog);
        if (data.metalsSource) setMetalSource(data.metalsSource);
        if (data.metalRates) setMetalRates(data.metalRates);
        if (data.metalsFromLive != null) setMetalsFromLive(!!data.metalsFromLive);
        if (data.metalsFeedNote != null) setMetalsFeedNote(data.metalsFeedNote);
        if (data.engine) setScrapersEnabled(!!data.engine.usePlaywrightScrapers);
        if (!data.items[selectedKey]) {
          setSelectedKey(Object.keys(data.items)[0] || "GOLD");
        }
        if (forceFresh) {
          setFeedPhase("done");
          setFeedDetail(data.message || "Capture complete.");
        }
        return data;
      }
      throw new Error("Invalid response format received from backend market endpoint.");
    } catch (err: unknown) {
      let msg = err instanceof Error ? err.message : String(err);
      if (err instanceof Error && err.name === "AbortError") {
        msg =
          "Market feed timed out. Use Refresh Spot Feed to retry, or turn on Force offline fallback in Engine Settings.";
      }
      setError(msg || "Failed to fetch indicators.");
      if (forceFresh) {
        setFeedPhase("error");
        setFeedDetail(msg);
      }
    } finally {
      if (forceFresh) stopActivityPolling();
      setLoading(false);
    }
    return null;
  };

  const refreshSpotFeed = async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setScrapeLog([]);
    setScrapeCurrent(null);
    try {
      setFeedPhase("market");
      setFeedDetail("Refreshing spot feed (metals + focus symbols)…");
      startActivityPolling();
      await fetchMarketData(true);
    } finally {
      stopActivityPolling();
      refreshInFlight.current = false;
    }
  };

  const marketRefreshBusy =
    loading ||
    metalLoading ||
    feedPhase === "metals" ||
    feedPhase === "market" ||
    feedPhase === "symbol";

  const showGlobalMarketLoader =
    loading &&
    Object.keys(assets).length === 0 &&
    (MARKET_DEPENDENT_PAGES as readonly string[]).includes(activePage);

  useEffect(() => {
    const page = new URLSearchParams(window.location.search).get("page");
    if (page === "config") setActivePage("config");
    void (async () => {
      try {
        const h = await apiFetch("/api/scrape/health");
        if (h.ok) {
          const d = await readApiJson<{ usePlaywrightScrapers?: boolean }>(h);
          setScrapersEnabled(!!d.usePlaywrightScrapers);
        } else {
          setScrapersEnabled(false);
        }
      } catch {
        /* server starting */
      }
      const fromLauncher = isLauncherBoot();
      if (fromLauncher) {
        setFeedDetail("Hydrating from launcher preload…");
        await fetchMarketData(false, 30_000);
        void fetchPreciousMetals(false);
      } else {
        let bootTimeout = 60_000;
        try {
          const settingsResp = await apiFetch("/api/engine/settings");
          if (settingsResp.ok) {
            const settingsData = await readApiJson<{
              telemetry?: { marketNeedsBootstrap?: boolean };
            }>(settingsResp);
            if (settingsData.telemetry?.marketNeedsBootstrap) {
              bootTimeout = 120_000;
              setFeedDetail("First populate — scraping Kitco/Yahoo (may take 1–2 min)…");
            }
          }
        } catch {
          /* optional */
        }
        await fetchMarketData(false, bootTimeout);
        void fetchPreciousMetals(false);
      }
      try {
        const catalogResp = await apiFetch("/api/catalog/status");
        if (catalogResp.ok) {
          const catalog = await readApiJson<{
            instrumentCount?: number;
            needsBootstrap?: boolean;
          }>(catalogResp);
          if ((catalog.instrumentCount ?? 0) === 0) {
            await apiFetch("/api/engine/restore-catalog", { method: "POST" });
            await fetchMarketData(false, 120_000);
          }
        }
      } catch {
        /* catalog repair optional */
      }
      try {
        const pinnedResp = await apiFetch("/api/terminal/pinned");
        if (pinnedResp.ok) {
          const pinnedData = await readApiJson<{ symbols?: string[] }>(pinnedResp);
          if (pinnedData.symbols && pinnedData.symbols.length > 0) {
            setPinnedSymbols(pinnedData.symbols);
            try {
              localStorage.setItem(
                "signalnode_pinned",
                JSON.stringify(pinnedData.symbols)
              );
            } catch {
              /* ignore */
            }
          } else {
            try {
              const local = localStorage.getItem("signalnode_pinned");
              const localPins = local ? (JSON.parse(local) as string[]) : [];
              if (localPins.length > 0) {
                await apiFetch("/api/terminal/pinned/sync", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ symbols: localPins }),
                });
              }
            } catch {
              /* optional migration */
            }
          }
        }
      } catch {
        /* pinned optional on boot */
      }
      try {
        const [hiddenResp, customResp] = await Promise.all([
          apiFetch("/api/terminal/hidden"),
          apiFetch("/api/terminal/custom-symbols"),
        ]);
        if (hiddenResp.ok) {
          const hiddenData = await readApiJson<{ symbols?: string[] }>(hiddenResp);
          setHiddenSymbols(new Set((hiddenData.symbols ?? []).map((s) => s.toUpperCase())));
        }
        if (customResp.ok) {
          const customData = await readApiJson<{ symbols?: string[] }>(customResp);
          setCustomSymbols(new Set((customData.symbols ?? []).map((s) => s.toUpperCase())));
        }
      } catch {
        /* terminal prefs optional on boot */
      }
    })();
  }, []);

  const initialFocusSyncDone = useRef(false);

  const captureSymbol = async (key: string, forceFresh = false) => {
    if (!assets[key] || capturingKeys.has(key)) return;
    if (scrapersEnabled === false) return;
    if (avDailyLimitExhausted && source !== "scrape") return;
    if (!forceFresh && isQuoteFresh(assets[key])) return;

    setCapturingKeys((prev) => new Set(prev).add(key));
    setFeedPhase("symbol");
    const sym = assets[key].symbol?.toUpperCase() ?? key;
    setFeedDetail(
      isMetalDashboardKey(key)
        ? `Metal capture for ${key} (API or Kitco)…`
        : isCryptoSymbol(key, sym)
          ? `Coinbase spot for ${sym}…`
          : `Market capture for ${sym}…`
    );
    if (!activityPollRef.current) startActivityPolling();

    try {
      const quoteQs = new URLSearchParams({ fresh: "1", priority: "high" });
      const resp = await apiFetchWithTimeout(
        `/api/quote/${encodeURIComponent(key)}?${quoteQs}`,
        undefined,
        90_000
      );
      if (!resp.ok) return;
      const data = await readApiJson<{
        success?: boolean;
        item?: Asset;
        priceSource?: string;
        feedNote?: string;
        scrapeLog?: string[];
      }>(resp);
      if (data.scrapeLog?.length) {
        setScrapeLog((log) => [...log, ...data.scrapeLog!]);
      }
      if (data.success && data.item) {
        const live =
          data.priceSource === "live" ||
          data.priceSource === "scrape" ||
          data.priceSource === "cached";
        setAssets((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            ...data.item,
            priceSource: live
              ? data.priceSource === "scrape"
                ? "scrape"
                : data.priceSource === "cached"
                  ? "cached"
                  : "live"
              : data.item!.priceSource ?? prev[key]?.priceSource,
            feedNote: live ? undefined : data.feedNote ?? data.item!.feedNote,
          },
        }));
        if (live) {
          setFeedPhase("done");
          setFeedDetail(
            `Captured ${key} at $${data.item.current?.toFixed?.(2) ?? data.item.current}`
          );
          if (isMetalDashboardKey(key)) {
            void fetchPreciousMetals(true);
          }
        } else if (data.feedNote) {
          setFeedPhase("error");
          setFeedDetail(data.feedNote);
        }
      }
    } catch (err: unknown) {
      console.warn("captureSymbol failed:", err);
    } finally {
      setCapturingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      if (!refreshInFlight.current && !loading) {
        stopActivityPolling();
      }
    }
  };

  const handleSelectAsset = (key: string) => {
    setSelectedKey(key);
    if (Object.keys(assets).length > 0) {
      void captureSymbol(key, false);
    }
  };

  const handleAssetAdded = (
    symbol: string,
    item: Asset,
    meta?: { captured?: boolean }
  ) => {
    const key = symbol.toUpperCase();
    setAssets((prev) => ({ ...prev, [key]: item }));
    setCustomSymbols((prev) => new Set(prev).add(key));
    setSelectedKey(key);
    if (
      meta?.captured ||
      item.priceSource === "scrape" ||
      item.priceSource === "cached" ||
      item.priceSource === "live"
    ) {
      if (item.priceSource === "scrape" || item.priceSource === "cached") {
        setFeedPhase("done");
        setFeedDetail(
          `Captured ${key} at $${item.current?.toFixed?.(2) ?? item.current}`
        );
      }
      return;
    }
    if (!isQuoteFresh(item)) {
      void captureSymbol(key, true);
    }
  };

  const handleHideSymbol = async (symbol: string, hidden: boolean) => {
    const key = symbol.toUpperCase();
    try {
      const resp = await apiFetch("/api/terminal/hidden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: key, hidden }),
      });
      if (!resp.ok) return;
      setHiddenSymbols((prev) => {
      const next = new Set(prev);
      if (hidden) next.add(key);
      else next.delete(key);
      if (hidden && selectedKey === key) {
        const visible = Object.keys(assets).filter(
          (k) => k !== key && (showHiddenSymbols || !next.has(k.toUpperCase()))
        );
        if (visible.length) setSelectedKey(visible[0]);
      }
      return next;
    });
    } catch (err) {
      console.warn("Hide symbol failed:", err);
    }
  };

  const handleDeleteSymbol = async (symbol: string) => {
    const key = symbol.toUpperCase();
    if (
      !window.confirm(
        `Permanently delete ${key} from your custom catalog? This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      const resp = await apiFetch(`/api/terminal/symbols/${encodeURIComponent(key)}`, {
        method: "DELETE",
      });
      const data = await readApiJson<{ success?: boolean; message?: string }>(resp);
      if (!resp.ok || !data.success) {
        alert(data.message ?? "Delete failed.");
        return;
      }
      setAssets((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setCustomSymbols((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setHiddenSymbols((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      if (selectedKey === key) {
        const remaining = Object.keys(assets).filter((k) => k !== key);
        setSelectedKey(remaining[0] ?? "GOLD");
      }
    } catch (err) {
      console.warn("Delete symbol failed:", err);
    }
  };

  const handleRestoreAllHidden = async () => {
    try {
      const resp = await apiFetch("/api/terminal/hidden/restore-all", {
        method: "POST",
      });
      if (resp.ok) setHiddenSymbols(new Set());
    } catch (err) {
      console.warn("Restore hidden failed:", err);
    }
  };

  useEffect(() => {
    if (Object.keys(assets).length === 0) return;
    const item = assets[selectedKey];
    if (item && (item.history?.length ?? 0) < 2 && item.current > 0) {
      void loadChartHistoryForKey(selectedKey);
    }
    if (!initialFocusSyncDone.current) {
      initialFocusSyncDone.current = true;
    }
  }, [selectedKey, assets]);

  // Sync pinned assets to localstorage
  const handleTogglePin = (key: string) => {
    setPinnedSymbols((prev) => {
      const isPinned = prev.includes(key);
      const updated = isPinned ? prev.filter((item) => item !== key) : [...prev, key];
      try {
        localStorage.setItem("signalnode_pinned", JSON.stringify(updated));
      } catch (err) {
        console.warn("Storage write failed:", err);
      }
      void apiFetch("/api/terminal/pinned/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: updated }),
      }).catch(() => {});
      return updated;
    });
  };

  const hasApiKeyOnBackend =
    source === "alphavantage" ||
    source === "mixed-fallback" ||
    source === "scrape";

  // Filter assets by search query
  const filteredAssetsList = Object.entries(assets).filter(([key, asset]) => {
    const a = asset as Asset;
    if (!showHiddenSymbols && hiddenSymbols.has(key.toUpperCase())) {
      return false;
    }
    const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          key.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const filteredAssetsObj = Object.fromEntries(filteredAssetsList) as Record<string, Asset>;

  const getSnapshotInput = useCallback(
    (): PlatformSnapshotInput => ({
      activePage,
      selectedKey,
      activeCategory,
      searchQuery,
      pinnedSymbols,
      assets,
    }),
    [activePage, selectedKey, activeCategory, searchQuery, pinnedSymbols, assets]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setLocalAiOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <PlatformContextProvider getSnapshotInput={getSnapshotInput}>
    <ReaderProvider
      onNavigateToJournal={() => setActivePage("investors-journal")}
    >
    <div className="flex min-h-screen bg-[#F4F7FB] text-[#1D1D1F] font-sans antialiased">

      {/* Sleek Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-[#E5E8EB] hidden lg:flex flex-col fixed top-0 bottom-0 left-0 z-20 shrink-0">

        {/* App Title Block */}
        <div className="p-6 flex items-center space-x-3 border-b border-[#E5E8EB]/55">
          <div className="w-9 h-9 bg-gradient-to-tr from-[#1D1D1F] to-[#424245] rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-zinc-800/20">
            <span className="text-white text-sm font-black italic tracking-tighter">R_I</span>
          </div>
          <div>
            <span className="font-black text-[#1D1D1F] tracking-tight block text-base">Raw Investor</span>
            <span className="text-[9px] text-[#86868B] font-semibold uppercase tracking-wider font-mono">Markets Terminal</span>
          </div>
        </div>

        {/* Sidebar Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-7 overflow-y-auto">
          <div>
            <div className="px-3 py-1 text-[9px] font-extrabold text-[#86868B] uppercase tracking-wider font-mono">
              Market Workspace
            </div>
            <div className="mt-2.5 space-y-1">
              <button
                onClick={() => setActivePage("overview")}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl font-semibold text-xs transition-all duration-150 cursor-pointer ${
                  activePage === "overview"
                    ? "bg-[#F0F7FF] text-[#007AFF]"
                    : "text-[#424245] hover:bg-[#F5F5F7]"
                }`}
              >
                <LayoutDashboard className="mr-3" size={15} />
                Overview Dashboard
              </button>

              <button
                onClick={() => setActivePage("terminal")}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl font-semibold text-xs transition-all duration-150 cursor-pointer ${
                  activePage === "terminal"
                    ? "bg-[#F0F7FF] text-[#007AFF]"
                    : "text-[#424245] hover:bg-[#F5F5F7]"
                }`}
              >
                <Search className="mr-3" size={15} />
                Track & Search Terminal
              </button>

              <button
                onClick={() => setActivePage("portfolio")}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl font-semibold text-xs transition-all duration-150 cursor-pointer ${
                  activePage === "portfolio"
                    ? "bg-[#F0F7FF] text-[#007AFF]"
                    : "text-[#424245] hover:bg-[#F5F5F7]"
                }`}
              >
                <Wallet className="mr-3" size={15} />
                Portfolio Tracker
              </button>

              <button
                onClick={() => setActivePage("statements-analyzer")}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl font-semibold text-xs transition-all duration-150 cursor-pointer ${
                  activePage === "statements-analyzer"
                    ? "bg-[#F0F7FF] text-[#007AFF]"
                    : "text-[#424245] hover:bg-[#F5F5F7]"
                }`}
              >
                <FileSpreadsheet className="mr-3" size={15} />
                Statements Analyzer
              </button>

              <button
                onClick={() => setActivePage("investors-journal")}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl font-semibold text-xs transition-all duration-150 cursor-pointer ${
                  activePage === "investors-journal"
                    ? "bg-[#F0F7FF] text-[#007AFF]"
                    : "text-[#424245] hover:bg-[#F5F5F7]"
                }`}
              >
                <BookMarked className="mr-3" size={15} />
                Investors Journal
              </button>

              <button
                onClick={() => setActivePage("market-links")}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl font-semibold text-xs transition-all duration-150 cursor-pointer ${
                  activePage === "market-links"
                    ? "bg-[#F0F7FF] text-[#007AFF]"
                    : "text-[#424245] hover:bg-[#F5F5F7]"
                }`}
              >
                <Link2 className="mr-3" size={15} />
                Market Links
              </button>

              <button
                onClick={() => setActivePage("news-bay")}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl font-semibold text-xs transition-all duration-150 cursor-pointer ${
                  activePage === "news-bay"
                    ? "bg-[#F0F7FF] text-[#007AFF]"
                    : "text-[#424245] hover:bg-[#F5F5F7]"
                }`}
              >
                <Newspaper className="mr-3" size={15} />
                News Bay
              </button>
            </div>
          </div>

          <div>
            <div className="px-3 py-1 text-[9px] font-extrabold text-[#86868B] uppercase tracking-wider font-mono">
              Principles
            </div>
            <div className="mt-2.5 space-y-1">
              <button
                onClick={() => setActivePage("wealth-bible")}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl font-semibold text-xs transition-all duration-150 cursor-pointer ${
                  activePage === "wealth-bible"
                    ? "bg-gradient-to-r from-emerald-50 to-violet-50 text-[#1D1D1F] ring-1 ring-emerald-200/80"
                    : "text-[#424245] hover:bg-[#F5F5F7]"
                }`}
              >
                <BookOpen className="mr-3 text-amber-600" size={15} />
                Bible of Wealth
              </button>
              <button
                onClick={() => setActivePage("bible")}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl font-semibold text-xs transition-all duration-150 cursor-pointer ${
                  activePage === "bible"
                    ? "bg-[#F0F7FF] text-[#007AFF]"
                    : "text-[#424245] hover:bg-[#F5F5F7]"
                }`}
              >
                <BookOpen className="mr-3" size={15} />
                Investor&apos;s Bible
              </button>
              <button
                onClick={() => setActivePage("gambler-bible")}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl font-semibold text-xs transition-all duration-150 cursor-pointer ${
                  activePage === "gambler-bible"
                    ? "bg-violet-50 text-violet-700"
                    : "text-[#424245] hover:bg-[#F5F5F7]"
                }`}
              >
                <BookOpen className="mr-3" size={15} />
                Gambler&apos;s Bible
              </button>
            </div>
          </div>

          <div>
            <div className="px-3 py-1 text-[9px] font-extrabold text-[#86868B] uppercase tracking-wider font-mono">
              AI Signal Copilot
            </div>
            <div className="mt-2.5 space-y-1">
              <button
                onClick={() => setActivePage("insights")}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl font-semibold text-xs transition-all duration-150 cursor-pointer ${
                  activePage === "insights"
                    ? "bg-[#F0F7FF] text-[#007AFF]"
                    : "text-[#424245] hover:bg-[#F5F5F7]"
                }`}
              >
                <BrainCircuit className="mr-3" size={15} />
                AI Macro Analyst
              </button>
            </div>
          </div>

          <div>
            <div className="px-3 py-1 text-[9px] font-extrabold text-[#86868B] uppercase tracking-wider font-mono">
              Engine Control
            </div>
            <div className="mt-2.5 space-y-1">
              <button
                onClick={() => setActivePage("config")}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl font-semibold text-xs transition-all duration-150 cursor-pointer ${
                  activePage === "config"
                    ? "bg-[#F0F7FF] text-[#007AFF]"
                    : "text-[#424245] hover:bg-[#F5F5F7]"
                }`}
              >
                <Settings className="mr-3" size={15} />
                Raw Engine Settings
              </button>
            </div>
          </div>
        </nav>

        {/* Bottom Status Panel */}
        <div className="p-4 border-t border-[#E5E8EB] space-y-3">
          <div className="bg-[#F5F5F7] border border-[#E5E8EB] p-4 rounded-2xl">
            <div className="text-[9px] font-extrabold text-[#86868B] uppercase tracking-wider font-mono">
              SECURE CONNECT
            </div>
            <div className="flex items-center mt-1.5 text-xs font-semibold text-[#1D1D1F]">
              <span className={`w-1.5 h-1.5 rounded-full mr-2 ${hasApiKeyOnBackend ? "bg-[#34C759]" : "bg-amber-500"}`} />
              {hasApiKeyOnBackend ? "Connected" : "Market feed"}
            </div>
          </div>
          <a
            href="https://rawgraded.com/privacy-policy.html#rawmarkets"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-[10px] font-semibold text-[#86868B] hover:text-[#007AFF] transition-colors"
          >
            Privacy Policy
          </a>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 flex flex-col min-h-screen lg:pl-64">

        {/* Top Header Controls bar */}
        <Header
          source={source}
          onRefreshAll={() => void refreshSpotFeed()}
          onReloadApp={() => window.location.reload()}
          onRefreshPortfolio={() => setPortfolioRefreshNonce((n) => n + 1)}
          showPortfolioRefresh={activePage === "portfolio"}
          isMarketRefreshing={marketRefreshBusy}
          isPortfolioRefreshing={portfolioRefreshing}
          livePriceCount={livePriceCount}
          simulatedPriceCount={simulatedPriceCount}
          metalSource={metalSource}
        />

        <FeedRefreshBar
          phase={feedPhase}
          detail={feedDetail}
          isActive={
            loading ||
            metalLoading ||
            feedPhase === "metals" ||
            feedPhase === "market" ||
            feedPhase === "symbol"
          }
          lastFetchedAt={lastFetchedAt}
          livePriceCount={livePriceCount}
          simulatedPriceCount={simulatedPriceCount}
          captureKey={
            feedPhase === "symbol" ? selectedKey : null
          }
          scrapeLog={scrapeLog}
          currentJob={scrapeCurrent}
        />

        {marketMessage &&
          livePriceCount === 0 &&
          !loading &&
          (source === "unavailable" ||
            source === "simulation" ||
            source === "mixed-fallback") && (
          <div className="mx-4 md:mx-10 mt-2 px-4 py-3 rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 text-xs leading-relaxed">
            <strong className="font-bold block mb-1">Market data pending</strong>
            {marketMessage}
            <span className="block mt-2 font-semibold">
              Use <strong>Refresh All</strong> to update quotes. Configure API keys or market
              capture under{" "}
              <button
                type="button"
                className="underline font-bold cursor-pointer"
                onClick={() => setActivePage("config")}
              >
                Engine Settings
              </button>
              .
            </span>
            {avDailyLimitExhausted ? (
              <span className="block mt-2 font-semibold">
                Alpha Vantage daily limit reached until{" "}
                {avQuotaResetsAt
                  ? new Date(avQuotaResetsAt).toLocaleString(undefined, {
                      timeZone: "UTC",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : "midnight UTC"}
                .
              </span>
            ) : null}
            {forceOfflineFallback ? (
              <span className="block mt-2">
                Offline mode is on — disable it under Engine Settings to load live quotes.
              </span>
            ) : null}
          </div>
        )}

        {/* Page Switch Header for smart mobile nav tabs */}
        <div className="lg:hidden border-b border-[#E5E8EB] bg-white px-4 py-2 flex items-center justify-between overflow-x-auto gap-2">
          <button
            onClick={() => setActivePage("overview")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors ${
              activePage === "overview" ? "bg-[#007AFF] text-white" : "text-[#86868B] hover:bg-[#F5F5F7]"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActivePage("terminal")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors ${
              activePage === "terminal" ? "bg-[#007AFF] text-white" : "text-[#86868B] hover:bg-[#F5F5F7]"
            }`}
          >
            Track & Pin
          </button>
          <button
            onClick={() => setActivePage("portfolio")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors ${
              activePage === "portfolio" ? "bg-[#007AFF] text-white" : "text-[#86868B] hover:bg-[#F5F5F7]"
            }`}
          >
            Portfolio
          </button>
          <button
            onClick={() => setActivePage("statements-analyzer")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors ${
              activePage === "statements-analyzer" ? "bg-[#007AFF] text-white" : "text-[#86868B] hover:bg-[#F5F5F7]"
            }`}
          >
            Statements
          </button>
          <button
            onClick={() => setActivePage("investors-journal")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors ${
              activePage === "investors-journal" ? "bg-[#007AFF] text-white" : "text-[#86868B] hover:bg-[#F5F5F7]"
            }`}
          >
            Journal
          </button>
          <button
            onClick={() => setActivePage("market-links")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors ${
              activePage === "market-links" ? "bg-[#007AFF] text-white" : "text-[#86868B] hover:bg-[#F5F5F7]"
            }`}
          >
            Links
          </button>
          <button
            onClick={() => setActivePage("news-bay")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors ${
              activePage === "news-bay" ? "bg-[#007AFF] text-white" : "text-[#86868B] hover:bg-[#F5F5F7]"
            }`}
          >
            News
          </button>
          <button
            onClick={() => setActivePage("insights")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors ${
              activePage === "insights" ? "bg-[#007AFF] text-white" : "text-[#86868B] hover:bg-[#F5F5F7]"
            }`}
          >
            AI Insight
          </button>
          <button
            onClick={() => setActivePage("config")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors ${
              activePage === "config" ? "bg-[#007AFF] text-white" : "text-[#86868B] hover:bg-[#F5F5F7]"
            }`}
          >
            Engine Settings
          </button>
        </div>

        {/* Page Body Wrapper */}
        <div className="p-6 md:p-8 flex-1 space-y-8 max-w-7xl w-full mx-auto">

          {/* Shared synchronization alerts */}
          {!loading && error && (
            <div className="w-full p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 flex items-center justify-between text-xs font-medium">
              <span>Synchronisation Issue: {error}</span>
              <button
                onClick={() => void refreshSpotFeed()}
                className="px-3 py-1 bg-rose-950 text-white rounded-lg hover:bg-rose-900 transition-colors cursor-pointer text-[10px]"
              >
                Retry
              </button>
            </div>
          )}

          {/* Core App loading indicator */}
          {showGlobalMarketLoader ? (
            <div className="w-full h-96 flex flex-col items-center justify-center bg-white border border-[#E5E8EB] rounded-[32px] p-8">
              <span className="w-10 h-10 border-3 border-[#E5E8EB] border-t-[#007AFF] rounded-full animate-spin mb-4" />
              <p className="text-sm font-bold text-[#1D1D1F]">
                Synchronizing Raw Investor Market Indices...
              </p>
              <p className="text-xs text-[#86868B] mt-1.5 max-w-xs text-center">
                Loading market quotes — first refresh can take 15–30 seconds.
              </p>
            </div>
          ) : (
            <>
              {/* PAGE 1: OVERVIEW DASHBOARD */}
              {activePage === "overview" && (
                <DashboardOverview
                  assets={assets}
                  pinnedSymbols={pinnedSymbols}
                  selectedKey={selectedKey}
                  metalRates={metalRates}
                  metalSource={metalSource}
                  metalsFromLive={metalsFromLive}
                  metalsFeedNote={metalsFeedNote}
                  metalLoading={metalLoading}
                  capturingKeys={capturingKeys}
                  onSelectAsset={handleSelectAsset}
                  setActivePage={setActivePage}
                  setHasSerpapiKey={setHasSerpapiKey}
                  layout={dashboardLayout.layout}
                  editMode={dashboardLayout.editMode}
                  onEditModeChange={dashboardLayout.setEditMode}
                  onLayoutChange={dashboardLayout.handleLayoutChange}
                  onSkinChange={dashboardLayout.handleSkinChange}
                  onSortChange={dashboardLayout.handleSortChange}
                  onAddGroup={dashboardLayout.handleAddGroup}
                  onResetLayout={dashboardLayout.handleResetLayout}
                  onGroupColorChange={dashboardLayout.handleGroupColorChange}
                  onSymbolAccentChange={dashboardLayout.handleSymbolAccentChange}
                />
              )}

              {/* PAGE 2: SEARCH & MANAGE TERMINAL */}
              {activePage === "portfolio" && (
                <PortfolioPage
                  refreshNonce={portfolioRefreshNonce}
                  reloadNonce={portfolioReloadNonce}
                  onRefreshingChange={setPortfolioRefreshing}
                  onOpenBible={() => setActivePage("bible")}
                />
              )}

              {activePage === "statements-analyzer" && (
                <StatementsAnalyzerTab
                  onImportComplete={() =>
                    setPortfolioReloadNonce((n) => n + 1)
                  }
                />
              )}

              {activePage === "wealth-bible" && <BibleOfWealth />}
              {activePage === "bible" && <InvestorsBible />}
              {activePage === "gambler-bible" && <GamblersBible />}

              {activePage === "investors-journal" && <InvestorsJournalPage />}

              {activePage === "market-links" && (
                <MarketLinksPage assets={assets} pinnedSymbols={pinnedSymbols} />
              )}

              {activePage === "news-bay" && (
                <NewsBayPage
                  hasSerpapiKey={hasSerpapiKey}
                  initialSymbol={selectedKey}
                />
              )}

              {activePage === "terminal" && (
                <SearchTerminal
                  assets={assets}
                  filteredAssetsObj={filteredAssetsObj}
                  selectedKey={selectedKey}
                  setSelectedKey={handleSelectAsset}
                  activeCategory={activeCategory}
                  setActiveCategory={setActiveCategory}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  pinnedSymbols={pinnedSymbols}
                  handleTogglePin={handleTogglePin}
                  hasApiKeyOnBackend={hasApiKeyOnBackend}
                  setHasSerpapiKey={setHasSerpapiKey}
                  onRefreshMarketData={() => void refreshSpotFeed()}
                  onAssetAdded={handleAssetAdded}
                  hiddenSymbols={hiddenSymbols}
                  customSymbols={customSymbols}
                  showHiddenSymbols={showHiddenSymbols}
                  onToggleShowHidden={() => setShowHiddenSymbols((v) => !v)}
                  onHideSymbol={handleHideSymbol}
                  onDeleteSymbol={handleDeleteSymbol}
                  onRestoreAllHidden={handleRestoreAllHidden}
                  onOpenNewsBay={() => setActivePage("news-bay")}
                />
              )}

              {/* PAGE 3: GEMINI MACRO ANALYST */}
              {activePage === "insights" && (
                <div className="space-y-6 animate-fade-in" id="ai-panel">
                  <div className="bg-white p-6 border border-[#E5E8EB] rounded-[32px] shadow-xs">
                    <h2 className="text-lg font-bold text-[#1D1D1F] tracking-tight">AI Signal Synthesis Workspace</h2>
                    <p className="text-xs text-[#86868B] mt-1 leading-relaxed">
                      Use cloud AI to cross-reference multi-market trends. This workspace analyzes precious metal hedges and pop-culture collectible indexes using live telemetry inputs.
                    </p>
                  </div>
                  <AISignalPanel assets={assets} />
                </div>
              )}

              {/* PAGE 4: CONFIGURATION SETTINGS */}
              {activePage === "config" && (
                <div className="space-y-6 animate-fade-in" id="api-config-board">
                  <div className="bg-white p-6 border border-[#E5E8EB] rounded-[32px] shadow-xs">
                    <h2 className="text-lg font-bold text-[#1D1D1F] tracking-tight">Raw Engine Control & Settings</h2>
                    <p className="text-xs text-[#86868B] mt-1 leading-relaxed">
                      Tune market capture, review logs, and manage API credentials.
                    </p>
                  </div>
                  <AdminApiKeys
                    onKeysChanged={() => void refreshSpotFeed()}
                  />
                  <ApiConfigInfo
                    hasKey={hasApiKeyOnBackend}
                    hasSerpapiKey={hasSerpapiKey}
                    hasMetalPriceKey={hasMetalPriceKey}
                    onRefreshMarketData={() => void refreshSpotFeed()}
                  />
                </div>
              )}
            </>
          )}

        </div>
      </main>
      <GlobalReaderDrawer />
      <LocalAiChatDrawer
        open={localAiOpen}
        onToggle={() => setLocalAiOpen((o) => !o)}
      />
    </div>
    </ReaderProvider>
    </PlatformContextProvider>
  );
}
