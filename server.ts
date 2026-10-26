import express from "express";
import path from "path";
import cors from "cors";
import fs from "fs";
import dotenv from "dotenv";
import {
  initDatabase,
  loadApiCache,
  setApiCacheEntry,
  loadCustomAssets,
  setCustomAsset,
  clearCustomAssets,
  getEngineSettings,
  saveEngineSettings,
  normalizeEngineSettings,
  loadEngineLogs,
  appendEngineLog,
  seedInitialLogs,
  getApiKey,
  getDbTelemetry,
  type CachedData,
} from "./src/server/db";
import {
  createGeminiClient,
  registerAdminRoutes,
  type GeminiHolder,
} from "./src/server/adminRoutes";
import {
  applyCommoditySeriesToItem,
  applyGlobalQuoteToItem,
  buildFeedStats,
  getLastFeedStats,
  hydrateItemsFromCommodityCache,
  hydrateItemsFromQuoteCache,
  buildScrapeEquityKeys,
  isFetchableEquityTicker,
  parseFocusAssetKeys,
  setLastFeedStats,
  tagAssetSources,
} from "./src/server/liveMarket";
import { isMarketQuoteScrapeable, readCachedMarketQuote, scrapeMarketQuote, scrapeMarketQuotesParallel, marketQuoteLabel } from "./src/server/scrapers/marketQuote";
import { buildGoogleFinanceId } from "./src/server/scrapers/types";
import { isYahooScrapeable } from "./src/server/scrapers/types";
import { applyScrapeToAsset } from "./src/server/scrapers/orchestrator";
import {
  resolveMetalsCapture,
  ALL_METAL_ISOS,
  DEFAULT_REFRESH_METAL_ISOS,
} from "./src/server/metalsCapture";
import {
  getScrapeActivity,
  clearScrapeActivity,
  activityToScrapeLog,
} from "./src/server/scrapers/scrapeQueue";
import {
  applyMetalSpotToItems,
  isPlausibleMetalSpotCache,
  emptyMetalSpotRates,
  type MetalSpotRate,
} from "./src/server/metalSpot";
import type { Asset, HistoryPoint } from "./src/types";
import {
  getAvQuotaStatus,
  isAvQuotaPaused,
  markAvDailyLimitExhausted,
  parseAvLimitMessage,
} from "./src/server/avQuota";
import { attachFeedNotes } from "./src/server/feedNotes";
import { closeBrowser } from "./src/server/scrapers/browserPool";
import { scrapeKitcoMetal } from "./src/server/scrapers/kitcoMetals";
import { scrapeYahooQuote } from "./src/server/scrapers/yahooQuote";
import { registerPortfolioRoutes } from "./src/server/portfolioRoutes";
import { isPythonAvailable } from "./src/server/pythonBridge";
import { checkOllamaReady } from "./src/server/ollamaExtract";
import { ensureOllamaDefaultModel } from "./src/server/ollamaDefaults";
import { registerJournalRoutes } from "./src/server/journalRoutes";
import { registerTerminalRoutes } from "./src/server/terminalRoutes";
import { registerNewsBayRoutes } from "./src/server/newsBayRoutes";
import { registerLaunchRoutes } from "./src/server/launchBootstrap";
import { registerLocalAiRoutes } from "./src/server/localAiRoutes";
import { listPortfolioHoldings } from "./src/server/portfolioDb";
import {
  purgeNewsBayCacheDb,
  purgeNewsBayCacheForSymbol,
} from "./src/server/newsBayCache";
import { scoreSerpApiNewsItem } from "./src/server/newsSentiment";
import { resolveNewsSourceDomain } from "./src/lib/newsSourceDomains";
import { searchSymbols } from "./src/server/symbolSearch";
import {
  getMarketPriceHistory,
  persistAndHydrateMarketPrices,
  finalizeQuoteAsset,
  getLatestMarketPriceCheck,
} from "./src/server/marketPriceHistory";
import { hydrateAssetChartHistory, hydrateItemsChartHistory } from "./src/server/chartHistoryHydrate";
import { clearCatalogRemovals } from "./src/server/catalogRemovals";
import {
  applyCatalogBaseline,
  getCustomAssetCount,
  restoreMissingBaselinePresets,
  purgeSimulationArtifacts,
  EMBEDDED_CATALOG_PRESETS,
} from "./src/server/embeddedCatalog";
import {
  purgeMetalPriceApiCache,
} from "./src/server/metalsCapture";
import { clearApiCacheForProvider } from "./src/server/db";
import {
  clearLastMarketFeedAt,
  formatFreshnessLabel,
  getLastMarketFeedAt,
  marketNeedsBootstrap,
  resolveMarketDataFresh,
  setLastMarketFeedAt,
} from "./src/server/marketRefreshPolicy";
import {
  allowedOrigins,
  isAllowedOrigin,
  rejectUntrustedUnsafeRequests,
} from "./src/server/requestSecurity";
import { requireAdminAccess } from "./src/server/adminMiddleware";

dotenv.config();

process.on("uncaughtException", (err) => {
  console.error("[RawMarkets] uncaughtException:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[RawMarkets] unhandledRejection:", reason);
});

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT ?? 3000);
  const HOST = process.env.RAWMARKETS_HOST ?? "127.0.0.1";

  initDatabase();
  ensureOllamaDefaultModel();
  applyCatalogBaseline();
  purgeSimulationArtifacts();
  seedInitialLogs();

  app.use(
    cors({
      origin(origin, callback) {
        callback(null, isAllowedOrigin(origin) ? origin || false : false);
      },
      credentials: true,
    })
  );

  app.use(express.json());
  app.use(rejectUntrustedUnsafeRequests);
  if (process.env.NODE_ENV === "production") {
    app.use((req, res, next) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.setHeader(
        "Content-Security-Policy",
        [
          "default-src 'self' http://127.0.0.1:3000 http://localhost:3000",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https: http:",
          "font-src 'self' data:",
          "connect-src 'self' http://127.0.0.1:3000 http://localhost:3000 ws://127.0.0.1:3000 ws://localhost:3000 https:",
          "media-src 'self' blob: data: https: http:",
          "frame-ancestors 'none'",
          "object-src 'none'",
          "base-uri 'self'",
        ].join("; ")
      );
      next();
    });
  }

  const geminiHolder: GeminiHolder = { client: createGeminiClient() };

  let apiCache: Record<string, CachedData> = loadApiCache();
  const CACHE_TTL_MS = 4 * 60 * 60 * 1000;
  console.log(`[DB] Loaded ${Object.keys(apiCache).length} API cache entries from SQLite.`);

  function saveCache() {
    try {
      for (const [key, entry] of Object.entries(apiCache)) {
        setApiCacheEntry(key, entry);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[DB] Failed to persist cache: ${msg}`);
    }
  }

  let customAssets: Record<string, any> = loadCustomAssets() as Record<string, any>;
  console.log(`[DB] Loaded ${Object.keys(customAssets).length} custom assets from SQLite.`);

  function saveCustomAssets() {
    try {
      for (const [symbol, payload] of Object.entries(customAssets)) {
        setCustomAsset(symbol, payload);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[DB] Failed to persist custom assets: ${msg}`);
    }
  }

  function reloadCustomAssets() {
    customAssets = loadCustomAssets() as Record<string, any>;
  }

  let engineSettings = getEngineSettings();
  console.log(
    `[Engine] Scrapers=${engineSettings.usePlaywrightScrapers} ApiFeeds=${engineSettings.useApiFeeds} Offline=${engineSettings.forceOfflineFallback}`
  );

  function logEngineEvent(msg: string) {
    const timestamp = new Date().toISOString().substring(11, 19);
    appendEngineLog(`[${timestamp}] ${msg}`);
  }

  function getEngineLogs(): string[] {
    return loadEngineLogs();
  }

  function reloadFromDatabase() {
    apiCache = loadApiCache();
    customAssets = loadCustomAssets() as Record<string, any>;
    engineSettings = getEngineSettings();
    geminiHolder.client = createGeminiClient();
    console.log("[DB] Reloaded in-memory state from SQLite.");
  }

  registerAdminRoutes(app, geminiHolder, {
    onDatabaseChanged: reloadFromDatabase,
  });

  registerJournalRoutes(app);

  registerNewsBayRoutes(app, { apiCache, saveCache });

  registerTerminalRoutes(app, {
    reloadCustomAssets,
    getCustomAssets: () => customAssets,
  });

  registerLocalAiRoutes(app);

  function ensureMarketCatalogReady(): number {
    applyCatalogBaseline();
    customAssets = loadCustomAssets() as Record<string, any>;
    const total = Object.keys(customAssets).length;
    if (total === 0) {
      const restored = restoreMissingBaselinePresets();
      customAssets = loadCustomAssets() as Record<string, any>;
      const restoredTotal = Object.keys(customAssets).length;
      if (restoredTotal === 0) {
        console.error("[DB] Market catalog empty after baseline apply.");
      } else {
        console.log(
          `[DB] Market catalog bootstrapped: ${restoredTotal} instruments (${restored} restored).`
        );
      }
      return restoredTotal;
    }
    return total;
  }
  ensureMarketCatalogReady();

  const GET_CATALOG_ITEMS = (): Record<string, Asset> =>
    loadCustomAssets() as Record<string, Asset>;

  const portfolioRouteDeps = {
    apiCache,
    saveCache,
    getEngineSettings: () => getEngineSettings(),
    getApiKey,
    symbolSearchDeps: {
      getSimulatedItems: GET_CATALOG_ITEMS,
      fetchAlphaVantage,
      getApiKey,
      apiCache,
      saveCache,
      usePlaywrightScrapers: engineSettings.usePlaywrightScrapers,
    },
  };

  registerPortfolioRoutes(app, portfolioRouteDeps);

  /**
   * Helper to fetch with API limit protection and cache
   */
  interface AvFetchResult {
    data: any;
    fromCache: boolean;
    error?: boolean;
    details?: string;
  }

  async function fetchAlphaVantage(
    url: string,
    cacheKey: string,
    fresh = false
  ): Promise<AvFetchResult> {
    const cached = apiCache[cacheKey];
    const now = Date.now();
    const quota = getAvQuotaStatus(now);

    if (quota.paused) {
      console.warn(
        `[AV Quota] Skipping network call for ${cacheKey} until ${quota.resetsAt}`
      );
      if (cached) {
        return { data: cached.data, fromCache: true, error: true, details: quota.note || "Daily limit" };
      }
      return {
        data: null,
        fromCache: false,
        error: true,
        details:
          quota.note ||
          "Alpha Vantage free tier (25 requests/day) exhausted. Resets at midnight UTC.",
      };
    }

    if (!fresh && cached && now - cached.timestamp < CACHE_TTL_MS) {
      console.log(
        `[Cache Hit] ${cacheKey} (${Math.round((CACHE_TTL_MS - (now - cached.timestamp)) / 60000)}m left)`
      );
      return { data: cached.data, fromCache: true };
    }

    try {
      console.log(`[API Live] Fetching Alpha Vantage: ${cacheKey}`);
      const res = await fetch(url);
      const data = (await res.json()) as any;

      const limitMsg = parseAvLimitMessage(data);
      if (
        !data ||
        limitMsg ||
        data["Error Message"] ||
        Object.keys(data).length === 0
      ) {
        if (limitMsg) {
          markAvDailyLimitExhausted(limitMsg);
          logEngineEvent(`Alpha Vantage daily quota hit — pausing AV until UTC midnight.`);
        }
        if (cached) {
          console.warn(`[API Limit] ${cacheKey} — serving cached snapshot.`);
          cached.timestamp = now - (CACHE_TTL_MS - 15 * 60 * 1000);
          saveCache();
          return { data: cached.data, fromCache: true, error: true, details: limitMsg || "Limited" };
        }
        return {
          data: null,
          fromCache: false,
          error: true,
          details: limitMsg || data?.["Error Message"] || "Empty payload",
        };
      }

      apiCache[cacheKey] = { timestamp: now, data };
      saveCache();
      return { data, fromCache: false };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (cached) {
        console.warn(`[Network] ${cacheKey} — cached fallback: ${msg}`);
        return { data: cached.data, fromCache: true, error: true };
      }
      return { data: null, fromCache: false, error: true, details: msg };
    }
  }

  let commodityRotationIndex = 0;
  const COMMODITY_ROTATE_KEYS = ["COPPER", "OIL", "BRENT"] as const;
  async function resolveMetalSpotRates(
    fresh: boolean,
    options?: {
      metalIso?: string | null;
      allKitcoMetals?: boolean;
    }
  ): Promise<{
    rates: Record<string, MetalSpotRate>;
    source: string;
    fromLive: boolean;
    message?: string;
  }> {
    const metalIsos = options?.allKitcoMetals
      ? ALL_METAL_ISOS
      : DEFAULT_REFRESH_METAL_ISOS;

    if (fresh) {
      purgeMetalPriceApiCache(apiCache);
      clearApiCacheForProvider("metalprice");
      saveCache();
      console.log(
        "[Metals] Cleared MetalPriceAPI cache — spot display uses Kitco + Yahoo only."
      );
    }

    const bundle = await resolveMetalsCapture({
      apiCache,
      fresh,
      persist: saveCache,
      metalKey: options?.metalIso ?? null,
      metalIsos,
    });
    lastMetalSource = bundle.source;
    return bundle;
  }

  registerLaunchRoutes(app, {
    portfolioDeps: portfolioRouteDeps,
    newsBayDeps: { apiCache, saveCache },
    marketFreshCtx: {
      apiCache,
      saveCache,
      getEngineSettings: () => engineSettings,
      getCatalogItems: GET_CATALOG_ITEMS,
      getPortfolioSymbols: () =>
        listPortfolioHoldings().map((h) => h.symbol),
      ensureCatalog: () => {
        ensureMarketCatalogReady();
      },
      resolveMetalSpotRates,
      logEngineEvent,
    },
  });

  const AV_DELAY_MS = 1200;

  async function delayAv(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, AV_DELAY_MS));
  }

  function parseCommoditySeries(av: AvFetchResult): { date: string; value: number }[] | null {
    if (av.error || !av.data?.data) return null;
    const dataPoints = av.data.data
      .map((dp: { date: string; value: string }) => ({
        date: dp.date,
        value: parseFloat(dp.value),
      }))
      .filter((dp: { value: number }) => !isNaN(dp.value))
      .reverse()
      .slice(-30);
    return dataPoints.length > 0 ? dataPoints : null;
  }

  function markPriceFeed(
    key: string,
    fromCache: boolean,
    livePrice: Set<string>,
    cachedPrice: Set<string>
  ): void {
    if (fromCache) cachedPrice.add(key);
    else livePrice.add(key);
  }

  // API Routes
  app.get("/api/health", async (_req, res) => {
    const ollama = await checkOllamaReady();
    res.json({
      status: "ok",
      portfolio: true,
      server: "rawmarkets",
      mode: process.env.NODE_ENV === "production" ? "production" : "development",
      research: {
        python: isPythonAvailable(),
        ollama: ollama.ok && ollama.modelReady,
      },
    });
  });

  app.post("/api/shutdown", requireAdminAccess, (_req, res) => {
    res.json({ success: true, message: "Shutting down RawMarkets server." });
    setImmediate(async () => {
      logEngineEvent("Shutdown requested — closing scrapers and exiting.");
      await closeBrowser();
      process.exit(0);
    });
  });

  // Global Engine Simulating Latency & Telemetry logging Middleware
  app.use(async (req, res, next) => {
    if (req.url.startsWith("/api/")) {
      const pathOnly = req.url.split("?")[0];
      const skipLatency =
        pathOnly === "/api/health" ||
        pathOnly === "/api/launch/status" ||
        pathOnly === "/api/launch/bootstrap" ||
        pathOnly === "/api/launch/summary";
      if (engineSettings.verboseLogging) {
        logEngineEvent(`Incoming API request: [${req.method}] ${req.url}`);
      }
      if (!skipLatency && engineSettings.simulationLatencyMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, engineSettings.simulationLatencyMs));
      }
    }
    next();
  });

  // RAW ENGINE CONTROLLERS
  app.get("/api/scrape/activity", (_req, res) => {
    const activity = getScrapeActivity();
    res.json({
      success: true,
      ...activity,
      logLines: activityToScrapeLog(activity.recent),
    });
  });

  app.get("/api/scrape/health", async (_req, res) => {
    engineSettings = getEngineSettings();
    let chromium = "unknown";
    try {
      const { chromium: ch } = await import("playwright");
      const exe = ch.executablePath();
      chromium = fs.existsSync(exe) ? "installed" : "missing — run npm run scrape:install";
    } catch (err: unknown) {
      chromium = err instanceof Error ? err.message : String(err);
    }
    res.json({
      success: true,
      usePlaywrightScrapers: engineSettings.usePlaywrightScrapers,
      useApiFeeds: engineSettings.useApiFeeds,
      forceOfflineFallback: engineSettings.forceOfflineFallback,
      chromium,
      priceSources: {
        metals: "Kitco bid + Yahoo XAUUSD/XAGUSD (MetalPriceAPI not used for spot)",
        equities: "Coinbase → Google Finance Beta → Yahoo Chart API → Yahoo Playwright",
      },
    });
  });

  app.get("/api/engine/settings", (req, res) => {
    engineSettings = getEngineSettings();
    const dbTel = getDbTelemetry();
    res.json({
      success: true,
      settings: engineSettings,
      telemetry: {
        customCount: dbTel.customCount,
        cacheCount: dbTel.cacheCount,
        newsArticleCount: dbTel.newsArticleCount,
        keysCount: dbTel.keysCount,
        dbPath: dbTel.dbPath,
        dbSize: dbTel.dbSize,
        hasAlphaVantageKey: !!getApiKey("alpha_vantage"),
        hasMetalPriceKey: !!getApiKey("metalprice"),
        hasSerpApiKey: !!getApiKey("serpapi"),
        hasGeminiKey: !!getApiKey("gemini"),
        lastMarketFeedAt: getLastMarketFeedAt(),
        marketNeedsBootstrap: marketNeedsBootstrap(),
      },
    });
  });

  app.post("/api/engine/settings", (req, res) => {
    const body = (req.body ?? {}) as Partial<typeof engineSettings>;
    engineSettings = normalizeEngineSettings({
      ...engineSettings,
      ...body,
    });

    logEngineEvent(
      `Characteristics updated. Latency: ${engineSettings.simulationLatencyMs}ms, Volatility x${engineSettings.volatilityMultiplier}, Scrapers: ${engineSettings.usePlaywrightScrapers}, ApiFeeds: ${engineSettings.useApiFeeds}, ForceOffline: ${engineSettings.forceOfflineFallback}`
    );
    saveEngineSettings(engineSettings);

    res.json({
      success: true,
      message: "Engine system parameter modifications merged successfully.",
      settings: engineSettings,
    });
  });

  app.get("/api/engine/logs", (req, res) => {
    res.json({
      success: true,
      logs: getEngineLogs()
    });
  });

  app.post("/api/engine/reset", (_req, res) => {
    customAssets = {};
    clearCustomAssets();
    clearCatalogRemovals();
    clearLastMarketFeedAt();
    const total = ensureMarketCatalogReady();
    logEngineEvent(
      `Database purged and factory catalog restored (${total} instruments).`
    );
    res.json({
      success: true,
      message: `Custom assets cleared. ${total} factory instruments restored.`,
      count: total,
    });
  });

  app.get("/api/catalog/status", (_req, res) => {
    const count = getCustomAssetCount();
    res.json({
      success: true,
      instrumentCount: count,
      embeddedPresetCount: EMBEDDED_CATALOG_PRESETS.length,
      needsBootstrap: marketNeedsBootstrap(),
      lastMarketFeedAt: getLastMarketFeedAt(),
      customAssetKeys: Object.keys(customAssets).slice(0, 20),
    });
  });

  app.post("/api/engine/restore-catalog", (req, res) => {
    const includeRemoved =
      req.query.includeRemoved === "1" ||
      req.query.includeRemoved === "true" ||
      req.body?.includeRemoved === true;
    const restored = restoreMissingBaselinePresets({ includeRemoved });
    customAssets = loadCustomAssets() as Record<string, any>;
    const total = Object.keys(customAssets).length;
    logEngineEvent(
      `Restored baseline catalog (${restored} added, ${total} total${includeRemoved ? ", includeRemoved" : ""}).`
    );
    res.json({
      success: true,
      message: `Baseline catalog restored. ${total} instruments available.`,
      count: total,
      restored,
      includeRemoved,
    });
  });

  // GET Endpoint — multi-source symbol search (Yahoo, Google Finance, AV, local catalog)
  app.get("/api/search-symbol", async (req, res) => {
    const query = (req.query.q || "").toString().trim();
    const mode = (req.query.mode || "keyword").toString().trim(); // "symbol", "name", "keyword"
    const category = (req.query.category || "ALL").toString().trim().toUpperCase();

    if (!query) {
      return res.json({ success: true, matches: [] });
    }

    try {
      const result = await searchSymbols(
        { q: query, mode: mode as "symbol" | "name" | "keyword", category },
        {
          getSimulatedItems: GET_CATALOG_ITEMS,
          fetchAlphaVantage,
          getApiKey,
          apiCache,
          saveCache,
          usePlaywrightScrapers: engineSettings.usePlaywrightScrapers,
        }
      );
      return res.json({ success: true, ...result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Search] Orchestrator error: ${msg}`);
      return res.status(500).json({
        success: false,
        matches: [],
        sources: [],
        message: msg,
      });
    }
  });

  function persistCustomAssetQuote(
    key: string,
    updated: Asset,
    googleFinanceId?: string
  ): void {
    if (!customAssets[key]) return;
    customAssets[key] = {
      ...updated,
      googleFinanceId:
        updated.googleFinanceId ??
        googleFinanceId ??
        customAssets[key].googleFinanceId,
    };
    saveCustomAssets();
  }

  // POST Endpoint to register new custom assets
  app.post("/api/add-asset", async (req, res) => {
    const {
      symbol,
      name,
      category,
      current,
      unit,
      desc,
      changePercent,
      googleFinanceId,
      exchange,
      capture,
    } = req.body;

    if (!symbol || !name) {
      return res.status(400).json({
        success: false,
        message: "Missing either asset symbol or company name coordinates."
      });
    }

    const key = symbol.trim().toUpperCase();
    const cleanCategory = (category || "TECH").trim().toUpperCase();

    const VALID_CATEGORIES = ["METALS", "ENERGY", "TECH", "MARKETS", "FINANCE"];
    const targetCategory = VALID_CATEGORIES.includes(cleanCategory) ? cleanCategory : "TECH";

    const basePrice = parseFloat(current) || 100;
    const cleanUnit = (unit || "USD per Share").trim();
    const cleanDesc = (desc || `Dynamic investor indices tracing custom operations for ${name}.`).trim();

    const cleanChangePercent = changePercent ? (changePercent.startsWith("+") || changePercent.startsWith("-") ? changePercent : `+${changePercent}`) : "+0.00%";
    const pctNum = parseFloat(cleanChangePercent.replace("%", "")) || 0;
    const deltaChange = parseFloat((basePrice * (pctNum / 100)).toFixed(2));

    const simulatedHistory: HistoryPoint[] = [];

    const resolvedGfId =
      (googleFinanceId ? String(googleFinanceId).trim() : null) ??
      buildGoogleFinanceId(key, exchange) ??
      undefined;

    customAssets[key] = {
      name: name.trim(),
      symbol: key,
      unit: cleanUnit,
      current: basePrice,
      open: parseFloat((basePrice * 0.99).toFixed(2)),
      high: parseFloat((basePrice * 1.025).toFixed(2)),
      low: parseFloat((basePrice * 0.98).toFixed(2)),
      volume: Math.floor(10000 + Math.random() * 90000),
      change: deltaChange,
      changePercent: cleanChangePercent,
      history: simulatedHistory,
      category: targetCategory,
      desc: cleanDesc,
      ...(resolvedGfId ? { googleFinanceId: resolvedGfId } : {}),
    };

    let captured = false;
    let captureProvider: string | undefined;
    let captureError: string | undefined;

    const wantCapture =
      capture === true ||
      capture === "true" ||
      capture === 1 ||
      capture === "1";

    if (
      wantCapture &&
      engineSettings.usePlaywrightScrapers &&
      !engineSettings.forceOfflineFallback &&
      isMarketQuoteScrapeable(key, key, resolvedGfId)
    ) {
      try {
        const scraped = await scrapeMarketQuote({
          apiCache,
          assetKey: key,
          symbol: key,
          googleFinanceId: resolvedGfId,
          fresh: true,
          persist: saveCache,
          usePlaywright: true,
        });
        captureProvider = marketQuoteLabel(scraped);
        const updated = applyScrapeToAsset(customAssets[key], scraped);
        if (updated) {
          const finalized = finalizeQuoteAsset(key, updated, "scrape");
          customAssets[key] = {
            ...finalized,
            googleFinanceId: resolvedGfId ?? finalized.googleFinanceId,
          };
          saveCustomAssets();
          captured = true;
        } else {
          captureError = scraped.error ?? "Capture failed after add.";
          saveCustomAssets();
        }
      } catch (err: unknown) {
        captureError = err instanceof Error ? err.message : String(err);
        saveCustomAssets();
      }
    } else {
      saveCustomAssets();
    }

    purgeNewsBayCacheForSymbol(key, apiCache);
    purgeNewsBayCacheDb(key);
    saveCache();

    console.log(
      `[Custom Assets] Added ${key} (${targetCategory})${captured ? ` — captured via ${captureProvider}` : ""}`
    );

    res.json({
      success: true,
      message: captured
        ? `Asset ${key} tracked with live ${captureProvider} price.`
        : captureError
          ? `Asset ${key} saved; capture failed: ${captureError}`
          : `Asset ${key} successfully updated inside database terminals.`,
      asset: customAssets[key],
      item: customAssets[key],
      symbol: key,
      captured,
      captureProvider,
      captureError,
    });
  });

  // On-demand single equity quote (for selected card / terminal)
  app.get("/api/market-data/price-history/:assetKey", (req, res) => {
    const key = String(req.params.assetKey || "").toUpperCase();
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit ?? "30"), 10) || 30)
    );
    const points = getMarketPriceHistory(key, limit);
    const latest = getLatestMarketPriceCheck(key);
    res.json({
      success: true,
      assetKey: key,
      points,
      latest: latest
        ? {
            price: latest.price,
            source: latest.source,
            checkedAt: new Date(latest.checked_at).toISOString(),
          }
        : null,
    });
  });

  app.get("/api/quote/:assetKey", async (req, res) => {
    const key = req.params.assetKey.toUpperCase();
    const simulated = GET_CATALOG_ITEMS();
    const item = simulated[key] ?? customAssets[key];
    if (!item) {
      return res.status(404).json({ success: false, message: "Unknown asset key." });
    }
    const fresh = req.query.fresh === "1" || req.query.fresh === "true";
    const quotePriority =
      req.query.priority === "high" ? 10 : 0;

    const quoteOpts = {
      apiCache,
      assetKey: key,
      symbol: item.symbol,
      googleFinanceId: item.googleFinanceId,
      persist: saveCache,
      usePlaywright: engineSettings.usePlaywrightScrapers,
    };

    if (!fresh) {
      if (
        engineSettings.usePlaywrightScrapers &&
        !engineSettings.forceOfflineFallback &&
        isMarketQuoteScrapeable(key, item.symbol, item.googleFinanceId)
      ) {
        const cachedScrape = await readCachedMarketQuote({
          ...quoteOpts,
          fresh: false,
        });
        if (cachedScrape) {
          const cachedUpdated = applyScrapeToAsset(item, cachedScrape);
          if (cachedUpdated) {
            const finalized = finalizeQuoteAsset(key, cachedUpdated, "cached");
            return res.json({
              success: true,
              source: "scrape",
              item: finalized,
              priceSource: finalized.priceSource ?? "cached",
              cached: true,
            });
          }
        }
      }

      const latestCheck = getLatestMarketPriceCheck(key);
      if (latestCheck) {
        const fromHistory: Asset = {
          ...item,
          current: latestCheck.price,
          change: latestCheck.change_amount ?? item.change,
          changePercent: latestCheck.change_percent ?? item.changePercent,
          priceSource: latestCheck.source as Asset["priceSource"],
          lastPriceCheckAt: new Date(latestCheck.checked_at).toISOString(),
        };
        const finalized = finalizeQuoteAsset(key, fromHistory, "cached");
        return res.json({
          success: true,
          source: "mixed-fallback",
          item: finalized,
          priceSource: finalized.priceSource ?? "cached",
          cached: true,
        });
      }

      const staleItem = finalizeQuoteAsset(
        key,
        item,
        item.priceSource ?? "unavailable"
      );
      return res.json({
        success: true,
        source: "unavailable",
        item: staleItem,
        priceSource: staleItem.priceSource ?? "unavailable",
        cached: true,
      });
    }

    if (
      engineSettings.usePlaywrightScrapers &&
      !engineSettings.forceOfflineFallback &&
      (key === "GOLD" || key === "SILVER")
    ) {
      const iso = key === "GOLD" ? "XAU" : "XAG";
      const metalSpot = await resolveMetalSpotRates(true, { metalIso: iso });
      const rate = metalSpot.rates[iso];
      if (
        rate &&
        (metalSpot.fromLive ||
          (metalSpot.source.includes("cached") &&
            isPlausibleMetalSpotCache(metalSpot.rates)))
      ) {
        const metalItem: Asset = {
          ...item,
          current: rate.price,
          change: rate.change,
          changePercent: rate.changePercent,
        };
        const finalized = finalizeQuoteAsset(key, metalItem, metalSpot.fromLive ? "scrape" : "cached");
        persistCustomAssetQuote(key, finalized, item.googleFinanceId);
        const activity = getScrapeActivity();
        return res.json({
          success: true,
          source: "scrape",
          item: finalized,
          priceSource: finalized.priceSource ?? "scrape",
          scrapeLog: [
            `${metalSpot.source}: ${iso} $${rate.price.toFixed(2)}`,
            ...activityToScrapeLog(activity.recent).slice(-4),
          ],
        });
      }
      const kitco = await scrapeKitcoMetal(iso, quotePriority);
      if (kitco.ok && kitco.price != null) {
        const updated = applyScrapeToAsset(item, kitco);
        if (updated) {
          const finalized = finalizeQuoteAsset(key, updated, "scrape");
          persistCustomAssetQuote(key, finalized, item.googleFinanceId);
          return res.json({
            success: true,
            source: "scrape",
            item: finalized,
            priceSource: finalized.priceSource ?? "scrape",
            scrapeLog: [`Kitco: ${iso} $${kitco.price.toFixed(2)}`, kitco.sourceUrl],
          });
        }
      }
      const kitcoFailed = finalizeQuoteAsset(key, item, "unavailable");
      return res.json({
        success: true,
        source: "unavailable",
        item: kitcoFailed,
        priceSource: kitcoFailed.priceSource ?? "unavailable",
        feedNote:
          kitcoFailed.feedNote ??
          metalSpot.message ??
          kitco.error ??
          "Metal capture failed.",
        scrapeLog: [`Metals: ${iso} failed — ${kitco.error ?? metalSpot.message ?? "unknown"}`],
      });
    }

    if (
      engineSettings.usePlaywrightScrapers &&
      !engineSettings.forceOfflineFallback &&
      isMarketQuoteScrapeable(key, item.symbol, item.googleFinanceId)
    ) {
      const scraped = await scrapeMarketQuote({
        ...quoteOpts,
        fresh: true,
        usePlaywright: true,
        fastCapture: false,
      });
      const updated = applyScrapeToAsset(item, scraped);
      if (updated) {
        const label = marketQuoteLabel(scraped);
        const finalized = finalizeQuoteAsset(key, updated, "scrape");
        persistCustomAssetQuote(key, finalized, item.googleFinanceId);
        return res.json({
          success: true,
          source: "scrape",
          item: finalized,
          priceSource: finalized.priceSource ?? "scrape",
          scrapeLog: [
            `${label}: ${key} $${updated.current.toFixed(2)}`,
            scraped.sourceUrl,
          ],
        });
      }
      const failed = finalizeQuoteAsset(key, item, "unavailable");
      return res.json({
        success: true,
        source: "unavailable",
        item: failed,
        priceSource: failed.priceSource ?? "unavailable",
        feedNote:
          failed.feedNote ??
          scraped.error ??
          `${marketQuoteLabel(scraped)} scrape failed.`,
        scrapeLog: [
          `${marketQuoteLabel(scraped)}: ${key} failed — ${scraped.error ?? "unknown"}`,
        ],
      });
    }

    const rawApiKey = getApiKey("alpha_vantage");
    const apiKey =
      engineSettings.forceOfflineFallback || !engineSettings.useApiFeeds
        ? null
        : rawApiKey;
    if (!apiKey?.trim()) {
      const finalized = finalizeQuoteAsset(key, item, "unavailable");
      return res.json({
        success: true,
        source: "unavailable",
        item: finalized,
        priceSource: finalized.priceSource ?? "unavailable",
        feedNote:
          finalized.feedNote ??
          "Legacy API feeds disabled or no Alpha Vantage key.",
      });
    }
    if (!isFetchableEquityTicker(item.symbol)) {
      const finalized = finalizeQuoteAsset(key, item, "unavailable");
      return res.json({
        success: true,
        source: "unavailable",
        item: finalized,
        priceSource: finalized.priceSource ?? "unavailable",
        message: "Symbol not supported for GLOBAL_QUOTE.",
      });
    }
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(item.symbol)}&apikey=${apiKey}`;
    const av = await fetchAlphaVantage(url, `quote_${item.symbol}`, fresh);
    if (av.data?.["Global Quote"]) {
      const updated = applyGlobalQuoteToItem(
        item,
        av.data["Global Quote"] as Record<string, string>
      );
      const avSource = av.fromCache ? "cached" : "live";
      const finalized = finalizeQuoteAsset(key, updated, avSource);
      return res.json({
        success: true,
        source: av.fromCache ? "mixed-fallback" : "alphavantage",
        item: finalized,
        priceSource: finalized.priceSource ?? avSource,
        avRateLimited: !!av.error,
      });
    }
    const avFailed = finalizeQuoteAsset(key, item, "unavailable");
    return res.json({
      success: true,
      source: "unavailable",
      item: avFailed,
      priceSource: avFailed.priceSource ?? "unavailable",
      avRateLimited: !!av.error,
      message: av.details || avFailed.feedNote || "Quote unavailable.",
    });
  });

  // Main Endpoint: Fetch Dashboard Asset Data
  app.get("/api/market-data", async (req, res) => {
    engineSettings = getEngineSettings();
    const booted =
      req.query.booted === "1" || req.query.booted === "true";
    if (booted) {
      if (getCustomAssetCount() === 0) {
        ensureMarketCatalogReady();
      }
      const simulated = GET_CATALOG_ITEMS();
      const hydrated = persistAndHydrateMarketPrices(simulated, {});
      const lastAt = getLastMarketFeedAt();
      return res.json({
        success: true,
        source: "cached",
        message:
          "Hydrated from launcher preload — use Refresh Spot Feed for a new live capture.",
        items: hydrated,
        livePriceCount: 0,
        simulatedPriceCount: Object.keys(hydrated).length,
        booted: true,
        refreshSkipped: true,
        lastMarketFeedAt: lastAt ? new Date(lastAt).toISOString() : null,
        fetchedAt: new Date().toISOString(),
      });
    }
    const manualFresh = req.query.fresh === "1" || req.query.fresh === "true";
    const launchCapture =
      req.query.launch === "1" || req.query.launch === "true";
    const refreshDecision = resolveMarketDataFresh(manualFresh, engineSettings);
    const fresh = refreshDecision.fresh;
    const marketDataStartedAt = Date.now();
    if (fresh && manualFresh) {
      clearScrapeActivity();
    }
    const rawApiKey = getApiKey("alpha_vantage");
    const keyConfigured = !!(rawApiKey && rawApiKey.trim());
    const apiKey = engineSettings.forceOfflineFallback ? null : rawApiKey;
    if (getCustomAssetCount() === 0) {
      ensureMarketCatalogReady();
    }
    const simulated = GET_CATALOG_ITEMS();
    const livePrice = new Set<string>();
    const liveHistory = new Set<string>();
    const cachedPrice = new Set<string>();
    const scrapePrice = new Set<string>();
    let marketDataResponded = false;

    const finish = async (
      items: Record<string, Asset>,
      source: "unavailable" | "alphavantage" | "mixed-fallback" | "scrape",
      message: string,
      extra?: {
        avRateLimited?: boolean;
        metalsSource?: string;
        avDailyLimitExhausted?: boolean;
        scrapeLog?: string[];
      }
    ) => {
      if (marketDataResponded) return;
      marketDataResponded = true;
      const withCharts = await hydrateItemsChartHistory(items, {
        apiCache,
        persistCache: saveCache,
        fresh,
      });
      for (const [key, item] of Object.entries(withCharts)) {
        if ((item.history?.length ?? 0) >= 2) {
          liveHistory.add(key);
        }
      }
      const hydrated = persistAndHydrateMarketPrices(withCharts, {
        cachedPriceKeys: cachedPrice,
      });
      const tagged = tagAssetSources(
        hydrated,
        livePrice,
        liveHistory,
        cachedPrice,
        scrapePrice
      );
      attachFeedNotes(tagged, {
        metalsFromLive: metalSpot.fromLive,
        metalsSource: metalSpot.source,
        metalsMessage: metalsNote,
        alphaKeyConfigured: keyConfigured,
        forceOffline: engineSettings.forceOfflineFallback,
        livePriceKeys: livePrice,
        useScrapers: engineSettings.usePlaywrightScrapers,
      });
      const stats = buildFeedStats(tagged, source, message, {
        alphaVantageKeyConfigured: keyConfigured,
        forceOfflineFallback: engineSettings.forceOfflineFallback,
      });
      let responseMessage = stats.message;
      if (
        !fresh &&
        refreshDecision.reason === "within_freshness_window"
      ) {
        responseMessage = `Cached market data — last live refresh within ${formatFreshnessLabel(engineSettings)}. Use Refresh Spot Feed to force update.`;
      } else if (!fresh && refreshDecision.reason === "policy_off") {
        responseMessage = `Quick load — auto-refresh policy is off. Use Refresh Spot Feed for live scrape.`;
      } else if (fresh && refreshDecision.reason === "bootstrap") {
        responseMessage = `Initial market populate complete. ${stats.message}`;
      }
      const statsWithMsg = { ...stats, message: responseMessage };
      setLastFeedStats(statsWithMsg);
      if (fresh) {
        setLastMarketFeedAt(Date.now());
      }
      logEngineEvent(
        `Market feed: ${stats.livePriceCount} live, ${stats.stalePriceCount ?? stats.simulatedPriceCount} unavailable, metals=${extra?.metalsSource ?? lastMetalSource} (${source})`
      );
      return res.json({
        success: true,
        source: statsWithMsg.source,
        message: statsWithMsg.message,
        items: tagged,
        livePriceCount: stats.livePriceCount,
        stalePriceCount: stats.stalePriceCount ?? stats.simulatedPriceCount,
        simulatedPriceCount: stats.simulatedPriceCount,
        liveSymbols: stats.liveSymbols,
        staleSymbols: stats.staleSymbols ?? stats.simulatedSymbols,
        simulatedSymbols: stats.simulatedSymbols,
        fetchedAt: stats.fetchedAt,
        forceOfflineFallback: engineSettings.forceOfflineFallback,
        metalsSource: extra?.metalsSource ?? metalSpot.source,
        avRateLimited: extra?.avRateLimited ?? false,
        metalpriceKeyConfigured: !!getApiKey("metalprice"),
        avDailyLimitExhausted: extra?.avDailyLimitExhausted ?? isAvQuotaPaused(),
        avQuotaResetsAt: getAvQuotaStatus().resetsAt,
        metalsFromLive: metalSpot.fromLive,
        metalsFeedNote: metalSpot.fromLive
          ? null
          : metalsNote || "No live metal feed on this refresh.",
        scrapeLog: extra?.scrapeLog,
        metalRates: metalSpot.rates,
        engine: {
          usePlaywrightScrapers: engineSettings.usePlaywrightScrapers,
          useApiFeeds: engineSettings.useApiFeeds,
          forceOfflineFallback: engineSettings.forceOfflineFallback,
          skipAutoMarketRefresh: engineSettings.skipAutoMarketRefresh,
          marketRefreshFreshnessValue: engineSettings.marketRefreshFreshnessValue,
          marketRefreshFreshnessUnit: engineSettings.marketRefreshFreshnessUnit,
        },
        refreshReason: refreshDecision.reason,
        refreshSkipped: !fresh && !manualFresh,
        lastMarketFeedAt: getLastMarketFeedAt()
          ? new Date(getLastMarketFeedAt()!).toISOString()
          : null,
      });
    };

    const items = { ...simulated } as Record<string, Asset>;
    let rateLimitedDetected = false;
    let metalsNote = "";
    const scrapeLog: string[] = [];

    const allMetalsParam =
      req.query.allMetals === "1" || req.query.allMetals === "true";

    const focusRawEarly = req.query.focus;
    const focusParamEarly =
      typeof focusRawEarly === "string"
        ? focusRawEarly
        : Array.isArray(focusRawEarly)
          ? focusRawEarly.map(String).join(",")
          : undefined;
    const focusKeysEarly = parseFocusAssetKeys(items, focusParamEarly, 6);
    const maxMarketScrapesEarly = fresh
      ? launchCapture
        ? 4
        : engineSettings.fullCatalogScrapeRefresh
          ? 8
          : 4
      : 0;
    const marketKeysEarly =
      maxMarketScrapesEarly > 0
        ? buildScrapeEquityKeys(
            items,
            focusKeysEarly,
            maxMarketScrapesEarly,
            (assetKey, symbol) =>
              isMarketQuoteScrapeable(
                assetKey,
                symbol,
                items[assetKey]?.googleFinanceId
              )
          )
        : [];

    const useScrape =
      engineSettings.usePlaywrightScrapers &&
      !engineSettings.forceOfflineFallback;

    const metalsOpts = {
      allKitcoMetals:
        allMetalsParam || engineSettings.fullCatalogScrapeRefresh === true,
    };

    const [metalSpot, parallelQuotes] = await Promise.all([
      resolveMetalSpotRates(fresh, metalsOpts),
      fresh && useScrape && marketKeysEarly.length > 0
        ? scrapeMarketQuotesParallel(marketKeysEarly, items, {
            apiCache,
            fresh: true,
            persist: saveCache,
            usePlaywright: false,
            fastCapture: true,
          })
        : Promise.resolve(new Map<string, import("./src/server/scrapers/types").ScrapeResult>()),
    ]);

    metalsNote = metalSpot.message || "";
    scrapeLog.push(
      metalSpot.fromLive
        ? `Metals: live (${metalSpot.source})`
        : `Metals: ${metalsNote || "no live scrape"}`
    );
    scrapeLog.push(...activityToScrapeLog(getScrapeActivity().recent).slice(-6));
    if (
      metalSpot.fromLive ||
      isPlausibleMetalSpotCache(metalSpot.rates)
    ) {
      const metalUpdated = applyMetalSpotToItems(
        items,
        metalSpot.rates,
        metalSpot.fromLive ? "scrape" : "cached"
      );
      for (const key of metalUpdated) scrapePrice.add(key);
    }

    if (fresh && parallelQuotes.size > 0) {
      scrapeLog.push(
        `Fast capture (API): ${[...parallelQuotes.keys()].join(", ")}`
      );
      for (const key of marketKeysEarly) {
        if (scrapePrice.has(key)) continue;
        const asset = items[key];
        if (!asset) continue;
        const result = parallelQuotes.get(key);
        if (!result) continue;
        const label = marketQuoteLabel(result);
        const updated = applyScrapeToAsset(asset, result);
        if (updated) {
          items[key] = updated;
          scrapePrice.add(key);
          scrapeLog.push(`${label}: ${key} $${updated.current.toFixed(2)}`);
        } else {
          const note =
            result.error ??
            "Fast capture failed — select symbol for browser scrape.";
          items[key] = { ...items[key], feedNote: note };
          scrapeLog.push(`${label}: ${key} failed — ${note}`);
        }
      }
    }

    if (useScrape) {
      const runScrapePass = async () => {
        const focusRaw = req.query.focus;
        const focusParam =
          typeof focusRaw === "string"
            ? focusRaw
            : Array.isArray(focusRaw)
              ? focusRaw.map(String).join(",")
              : undefined;
        const focusKeys = parseFocusAssetKeys(items, focusParam, 6);
        const marketKeys = marketKeysEarly;

        if (!fresh) {
          scrapeLog.push("Quick load — hydrating from scrape cache…");
          const hydrateKeys = new Set<string>([...focusKeys, "GOLD", "SILVER"]);
          for (const key of hydrateKeys) {
            if (scrapePrice.has(key)) continue;
            const asset = items[key];
            if (!asset || !isMarketQuoteScrapeable(key, asset.symbol, asset.googleFinanceId)) {
              continue;
            }
            const cached = await readCachedMarketQuote({
              apiCache,
              assetKey: key,
              symbol: asset.symbol,
              googleFinanceId: asset.googleFinanceId,
              fresh: false,
              persist: saveCache,
              usePlaywright: false,
            });
            const updated = cached ? applyScrapeToAsset(asset, cached) : null;
            if (updated) {
              items[key] = updated;
              scrapePrice.add(key);
              scrapeLog.push(
                `Cached: ${key} $${updated.current.toFixed(2)} (${marketQuoteLabel(cached!)})`
              );
            }
          }
        }

        const capturedOk = marketKeys.filter((k) => scrapePrice.has(k));
        const scrapeMsg = [
          fresh
            ? metalSpot.fromLive
              ? `Metals live: ${metalSpot.source}.`
              : metalsNote || "Metal scrape did not return live prices."
            : metalsNote || "No live feed.",
          fresh
            ? capturedOk.length > 0
              ? `Live capture: ${capturedOk.join(", ")}.`
              : marketKeys.length > 0
                ? "Market capture attempted but no prices succeeded."
                : "No scrapeable symbols in this refresh queue."
            : null,
        ]
          .filter(Boolean)
          .join(" ");

        scrapeLog.push(
          ...activityToScrapeLog(getScrapeActivity().recent).slice(-12)
        );
        return await finish(
          items,
          scrapePrice.size > 0 ||
            metalSpot.fromLive ||
            isPlausibleMetalSpotCache(metalSpot.rates)
            ? "scrape"
            : "unavailable",
          scrapeMsg,
          { metalsSource: metalSpot.source, scrapeLog }
        );
      };

      try {
        if (fresh) {
          return await runScrapePass();
        }
        return await runScrapePass();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        scrapeLog.push(`Error: ${msg}`);
        return await finish(items, "unavailable", `Scrape error: ${msg}`, {
          metalsSource: metalSpot.source,
          scrapeLog,
        });
      }
    }

    if (!apiKey || apiKey.trim() === "") {
      const reason = engineSettings.forceOfflineFallback
        ? "Force offline fallback is ON — Alpha Vantage disabled."
        : "No Alpha Vantage key — stocks/energy have no live feed.";
      const fullMsg = [reason, metalsNote].filter(Boolean).join(" ");
      return await finish(items, "unavailable", fullMsg, {
        metalsSource: metalSpot.source,
      });
    }

    const avQuota = getAvQuotaStatus();
    if (avQuota.paused) {
      const now = Date.now();
      hydrateItemsFromQuoteCache(
        items,
        apiCache,
        CACHE_TTL_MS,
        livePrice,
        cachedPrice,
        now
      );
      hydrateItemsFromCommodityCache(
        items,
        apiCache,
        CACHE_TTL_MS,
        livePrice,
        cachedPrice,
        liveHistory,
        now
      );
      const resetHint = avQuota.resetsAt
        ? new Date(avQuota.resetsAt).toLocaleString("en-US", {
            timeZone: "UTC",
            dateStyle: "medium",
            timeStyle: "short",
          })
        : "midnight UTC";
      const msg = [
        `Alpha Vantage free tier used all 25 requests today. No more stock API calls until ${resetHint} (UTC).`,
        metalsNote,
      ]
        .filter(Boolean)
        .join(" ");
      return await finish(items, "mixed-fallback", msg, {
        avRateLimited: true,
        avDailyLimitExhausted: true,
        metalsSource: metalSpot.source,
      });
    }

    try {
      const skipAvMetals = metalSpot.fromLive;
      const now = Date.now();
      const focusRaw = req.query.focus;
      const focusParam =
        typeof focusRaw === "string"
          ? focusRaw
          : Array.isArray(focusRaw)
            ? focusRaw.map(String).join(",")
            : undefined;
      const focusKeys = parseFocusAssetKeys(items, focusParam, 6);

      hydrateItemsFromQuoteCache(
        items,
        apiCache,
        CACHE_TTL_MS,
        livePrice,
        cachedPrice,
        now
      );
      hydrateItemsFromCommodityCache(
        items,
        apiCache,
        CACHE_TTL_MS,
        livePrice,
        cachedPrice,
        liveHistory,
        now
      );

      const needsQuoteFetch = (key: string) =>
        !!items[key] &&
        isFetchableEquityTicker(items[key].symbol) &&
        !livePrice.has(key) &&
        !cachedPrice.has(key);

      const applyCommodity = async (
        key: string,
        fn: string,
        cacheKey: string
      ) => {
        await delayAv();
        const url = `https://www.alphavantage.co/query?function=${fn}&apikey=${apiKey}`;
        const av = await fetchAlphaVantage(url, cacheKey, fresh);
        if (av.error) rateLimitedDetected = true;
        const series = parseCommoditySeries(av);
        if (series && items[key]) {
          const updated = applyCommoditySeriesToItem(items[key], series);
          if (updated) {
            items[key] = updated;
            markPriceFeed(key, av.fromCache, livePrice, cachedPrice);
            if (!av.fromCache) liveHistory.add(key);
          }
        }
      };

      const applyQuote = async (key: string, symbol: string) => {
        if (!items[key]) return;
        await delayAv();
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
        const av = await fetchAlphaVantage(url, `quote_${symbol}`, fresh);
        if (av.error) rateLimitedDetected = true;
        if (av.data?.["Global Quote"]) {
          items[key] = applyGlobalQuoteToItem(
            items[key],
            av.data["Global Quote"] as Record<string, string>
          );
          markPriceFeed(key, av.fromCache, livePrice, cachedPrice);
        }
      };

      /** Free tier: 25/day — default 1 quote per refresh; 2 only when ?fresh=1 */
      const MAX_QUOTE_FETCHES = fresh ? 2 : 1;
      let quoteFetches = 0;

      const fetchQuoteIfNeeded = async (key: string) => {
        if (quoteFetches >= MAX_QUOTE_FETCHES || isAvQuotaPaused()) return;
        if (!needsQuoteFetch(key)) return;
        quoteFetches++;
        await applyQuote(key, items[key].symbol);
        if (isAvQuotaPaused()) rateLimitedDetected = true;
      };

      const primaryFocus = focusKeys[0];
      if (primaryFocus) {
        await fetchQuoteIfNeeded(primaryFocus);
      }

      if (fresh && quoteFetches < MAX_QUOTE_FETCHES) {
        const secondary = focusKeys[1];
        if (secondary && secondary !== primaryFocus) {
          await fetchQuoteIfNeeded(secondary);
        }
      }

      if (fresh && quoteFetches < MAX_QUOTE_FETCHES && !skipAvMetals) {
        const cKey =
          COMMODITY_ROTATE_KEYS[
            commodityRotationIndex % COMMODITY_ROTATE_KEYS.length
          ];
        commodityRotationIndex++;
        const fnMap: Record<string, string> = {
          COPPER: "COPPER",
          OIL: "WTI",
          BRENT: "BRENT",
        };
        const cacheMap: Record<string, string> = {
          COPPER: "commodities_COPPER",
          OIL: "commodities_WTI",
          BRENT: "commodities_BRENT",
        };
        if (!livePrice.has(cKey) && !cachedPrice.has(cKey)) {
          await applyCommodity(cKey, fnMap[cKey], cacheMap[cKey]);
          quoteFetches++;
        }
      }

      const avMsg = rateLimitedDetected || isAvQuotaPaused()
        ? `Alpha Vantage quota preserved (max ${MAX_QUOTE_FETCHES} new call(s) per refresh). Use header Refresh sparingly; free tier = 25 requests/day.`
        : "Stocks use Alpha Vantage (1 quote per refresh). Metals use Kitco + Yahoo spot.";
      const message = [avMsg, metalsNote].filter(Boolean).join(" ");

      return await finish(
        items,
        rateLimitedDetected ? "mixed-fallback" : "alphavantage",
        message,
        { avRateLimited: rateLimitedDetected, metalsSource: metalSpot.source }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const tagged = tagAssetSources(
        persistAndHydrateMarketPrices(simulated, { cachedPriceKeys: cachedPrice }),
        livePrice,
        liveHistory,
        cachedPrice,
        scrapePrice
      );
      return res.json({
        success: false,
        source: "unavailable",
        message: `Error requesting API: ${msg}. Showing simulated records.`,
        items: tagged,
        livePriceCount: 0,
        simulatedPriceCount: Object.keys(tagged).length,
        liveSymbols: [],
        simulatedSymbols: Object.keys(tagged),
        fetchedAt: new Date().toISOString(),
      });
    }
  });

  let lastMetalSource = "unavailable";

  app.get("/api/feed-verify", async (_req, res) => {
    const blockers: string[] = [];
    if (engineSettings.forceOfflineFallback) {
      blockers.push(
        "Force Offline Cache is ON in Engine Settings — all live APIs are disabled until you turn it off and Commit."
      );
    }

    const providers: Record<
      string,
      { ok: boolean; message: string; sample?: string }
    > = {};

    if (engineSettings.usePlaywrightScrapers) {
      try {
        const xag = await scrapeKitcoMetal("XAG");
        if (xag.ok && xag.price) {
          providers.kitco = {
            ok: true,
            message: "Kitco silver scrape succeeded.",
            sample: `$${xag.price.toFixed(2)}/oz`,
          };
        } else {
          providers.kitco = {
            ok: false,
            message: xag.error ?? "Kitco scrape failed.",
          };
        }
      } catch (err: unknown) {
        providers.kitco = {
          ok: false,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    } else if (engineSettings.useApiFeeds) {
      const metalKey = getApiKey("metalprice");
      if (!metalKey) {
        providers.metalprice = {
          ok: false,
          message: "No MetalPriceAPI key in vault.",
        };
      } else if (engineSettings.forceOfflineFallback) {
        providers.metalprice = {
          ok: false,
          message: "Blocked by Force Offline Cache.",
        };
      } else {
        try {
          const url = `https://api.metalpriceapi.com/v1/latest?api_key=${metalKey}&base=USD&currencies=XAG`;
          const r = await fetch(url);
          const data = (await r.json()) as {
            success?: boolean;
            rates?: Record<string, number>;
            error?: { info?: string };
          };
          if (data.success && data.rates?.XAG) {
            const oz = (1 / data.rates.XAG).toFixed(2);
            providers.metalprice = {
              ok: true,
              message: "MetalPriceAPI returned live silver spot.",
              sample: `$${oz}/oz`,
            };
          } else {
            providers.metalprice = {
              ok: false,
              message: data.error?.info || "API response missing live rates.",
            };
          }
        } catch (err: unknown) {
          providers.metalprice = {
            ok: false,
            message: err instanceof Error ? err.message : String(err),
          };
        }
      }
    } else {
      providers.scrape = {
        ok: false,
        message: "Playwright scrapers and legacy API feeds are both off.",
      };
    }

    if (engineSettings.usePlaywrightScrapers && !engineSettings.forceOfflineFallback) {
      try {
        const tsla = await scrapeYahooQuote("TSLA", "TSLA");
        if (tsla.ok && tsla.price) {
          providers.yahoo = {
            ok: true,
            message: "Yahoo Finance TSLA scrape succeeded.",
            sample: `TSLA $${tsla.price}`,
          };
        } else {
          providers.yahoo = {
            ok: false,
            message: tsla.error ?? "Yahoo scrape failed.",
          };
        }
      } catch (err: unknown) {
        providers.yahoo = {
          ok: false,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    }

    const avKey = getApiKey("alpha_vantage");
    const avQuota = getAvQuotaStatus();
    if (
      !engineSettings.usePlaywrightScrapers &&
      avQuota.paused
    ) {
      providers.alpha_vantage = {
        ok: false,
        message: `Daily quota exhausted until ${avQuota.resetsAt ?? "midnight UTC"}. No Test calls made.`,
      };
    } else if (
      !engineSettings.usePlaywrightScrapers &&
      !avKey
    ) {
      providers.alpha_vantage = {
        ok: false,
        message: "No Alpha Vantage key in vault.",
      };
    } else if (
      !engineSettings.usePlaywrightScrapers &&
      engineSettings.forceOfflineFallback
    ) {
      providers.alpha_vantage = {
        ok: false,
        message: "Blocked by Force Offline Cache.",
      };
    } else if (
      engineSettings.useApiFeeds &&
      avKey
    ) {
      try {
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=TSLA&apikey=${avKey}`;
        const r = await fetch(url);
        const data = (await r.json()) as Record<string, unknown>;
        const limitMsg = parseAvLimitMessage(data);
        if (limitMsg) {
          markAvDailyLimitExhausted(limitMsg);
          providers.alpha_vantage = {
            ok: false,
            message: limitMsg,
          };
        } else {
          const gq = data["Global Quote"] as Record<string, string> | undefined;
          const price = gq?.["05. price"];
          if (price) {
            providers.alpha_vantage = {
              ok: true,
              message: "Alpha Vantage returned a live equity quote.",
              sample: `TSLA $${price}`,
            };
          } else {
            providers.alpha_vantage = {
              ok: false,
              message:
                "No Global Quote in response — key invalid or daily limit exhausted.",
            };
          }
        }
      } catch (err: unknown) {
        providers.alpha_vantage = {
          ok: false,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    }

    const stats = getLastFeedStats();
    res.json({
      success: true,
      blockers,
      providers,
      market: stats,
      avQuota,
      engine: {
        forceOfflineFallback: engineSettings.forceOfflineFallback,
      },
      hint:
        blockers.length > 0
          ? "Fix blockers first, then use header Refresh."
          : !providers.kitco?.ok && !providers.yahoo?.ok &&
              !providers.alpha_vantage?.ok &&
              !providers.metalprice?.ok
            ? "Run Re-check APIs after npm run scrape:install."
            : "Scrapers ready — use Refresh on the dashboard.",
    });
  });

  app.get("/api/data-status", (_req, res) => {
    res.json({
      success: true,
      keys: {
        alpha_vantage: !!getApiKey("alpha_vantage"),
        gemini: !!getApiKey("gemini"),
        serpapi: !!getApiKey("serpapi"),
        metalprice: !!getApiKey("metalprice"),
      },
      engine: {
        forceOfflineFallback: engineSettings.forceOfflineFallback,
        simulationLatencyMs: engineSettings.simulationLatencyMs,
      },
      market: getLastFeedStats(),
      metals: { source: lastMetalSource },
      avQuota: getAvQuotaStatus(),
    });
  });

  // SerpApi News & Market Sentiment Route
  app.get("/api/news", async (req, res) => {
    const apiKey = getApiKey("serpapi");
    const qParam = (req.query.q as string) || "";
    const manual =
      req.query.manual === "1" ||
      req.query.manual === "true" ||
      req.query.fresh === "1" ||
      req.query.fresh === "true";
    const query = qParam
      ? `${qParam} market news sentiment`
      : "gold silver cooper commodities collectibles market news sentiment";
    const stockGuess = qParam.trim().toUpperCase();
    const stockSymbol = /^[A-Z][A-Z0-9.-]{0,11}$/.test(stockGuess)
      ? stockGuess
      : undefined;

    const cacheKey = `serp_news_${query.toLowerCase().replace(/\s+/g, "_")}`;
    const cached = apiCache[cacheKey];
    const now = Date.now();
    const NEWS_TTL = 1 * 60 * 60 * 1000; // 1 hour caching for news

    if (cached && now - cached.timestamp < NEWS_TTL) {
      console.log(`[Cache Hit] Serving SERPAPI news queue for '${query}' from cache.`);
      return res.json({
        success: true,
        source: apiKey ? "serpapi" : "none",
        items: cached.data,
      });
    }

    if (!manual) {
      return res.json({
        success: true,
        source: "none",
        message:
          "SerpApi is manual-only. Use Search or Refresh to fetch live headlines.",
        items: [],
      });
    }

    if (!apiKey || apiKey.trim() === "") {
      return res.json({
        success: true,
        source: "none",
        message: "No SerpApi API key configured. Add one under Config → API Keys.",
        items: [],
      });
    }

    try {
      const url = `https://serpapi.com/search.json?engine=google_news&q=${encodeURIComponent(query)}&api_key=${apiKey}`;
      console.log(`[SerpApi Live] Fetching news trends for query: '${query}'...`);
      const resp = await fetch(url);
      const apiData = await resp.json() as any;

      if (apiData.news_results && Array.isArray(apiData.news_results)) {
        const parsed = apiData.news_results.slice(0, 8).map((news: any) => {
          const scored = scoreSerpApiNewsItem(news);
          const link = news.link || "https://google.com";
          const sourceLabel =
            news.source?.name || news.source || "Finance Source";
          const thumb =
            news.thumbnail ||
            news.thumbnail_url ||
            news.image ||
            news.image_url;
          return {
            title: news.title,
            snippet:
              news.snippet ||
              news.description ||
              "Fresh indicators and market sentiment reports for this commodity asset class.",
            source: sourceLabel,
            date: news.date || news.published_date || "Today",
            link,
            sentiment: scored.sentiment,
            score: scored.score,
            stockSymbol,
            sourceDomain:
              resolveNewsSourceDomain({
                sourceLabel: String(sourceLabel),
                articleUrl: link,
              }) ?? undefined,
            imageUrl:
              typeof thumb === "string" && thumb.startsWith("http")
                ? thumb
                : undefined,
          };
        });

        apiCache[cacheKey] = { timestamp: now, data: parsed };
        saveCache();
        return res.json({
          success: true,
          source: "serpapi",
          items: parsed
        });
      } else {
        console.warn(`[SerpApi Warning] news_results structure mapping missed inside raw payload.`);
        return res.json({
          success: true,
          source: "none",
          message: "News array mapping not found in raw payload channel.",
          items: [],
        });
      }
    } catch (err: any) {
      console.error(`[SerpApi Error] Error reaching SerpApi endpoint: ${err.message}`);
      return res.json({
        success: true,
        source: "none",
        message: `API channel error: ${err.message}.`,
        items: [],
      });
    }
  });

  // MetalPriceAPI.com Spot Rates Route (shared with market-data)
  app.get("/api/chart-history/:key", async (req, res) => {
    const key = String(req.params.key ?? "").trim().toUpperCase();
    const item = (customAssets[key] ?? loadCustomAssets()[key]) as Asset | undefined;
    if (!item) {
      return res.status(404).json({ success: false, message: "Symbol not found." });
    }
    const fresh = req.query.fresh === "1" || req.query.fresh === "true";
    try {
      const hydrated = await hydrateAssetChartHistory(key, item, {
        apiCache,
        persistCache: saveCache,
        fresh,
      });
      if (hydrated !== item) {
        customAssets[key] = hydrated;
        saveCustomAssets();
      }
      return res.json({
        success: true,
        key,
        history: hydrated.history,
        historySource: hydrated.historySource,
        open: hydrated.open,
        high: hydrated.high,
        low: hydrated.low,
        current: hydrated.current,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, message: msg });
    }
  });

  app.get("/api/precious-metals", async (req, res) => {
    engineSettings = getEngineSettings();
    const fresh = req.query.fresh === "1" || req.query.fresh === "true";
    const metalRaw = req.query.metal;
    const metalIso =
      typeof metalRaw === "string" ? metalRaw.toUpperCase() : null;
    const allMetals =
      req.query.allMetals === "1" || req.query.allMetals === "true";
    if (fresh) clearScrapeActivity();
    const metalSpot = await resolveMetalSpotRates(fresh, {
      metalIso,
      allKitcoMetals: allMetals || !metalIso,
    });
    return res.json({
      success: true,
      source: metalSpot.source,
      message: metalSpot.message,
      timestamp: Date.now(),
      rates: metalSpot.rates,
      fromLive: metalSpot.fromLive,
      feedNote: metalSpot.fromLive
        ? null
        : metalSpot.message || "No live metal feed — use Refresh Spot Feed.",
    });
  });

  // Economic Insights Signal Analyzer
  app.post("/api/analyze", async (req, res) => {
    if (!geminiHolder.client) {
      return res.json({
        success: false,
        message: "Gemini API key not configured. Add it in Admin → API Keys.",
      });
    }

    const { items, customPrompt } = req.body;
    if (!items) {
      return res.status(400).json({ error: "Missing items metrics context." });
    }

    try {
      const contextStr = Object.values(items)
        .map((item: any) => `${item.name} (${item.symbol}): Current Price: ${item.current} ${item.unit}, 30d change: ${item.changePercent}`)
        .join("\n");

      const systemInstruction = `You are an elite alternative asset portfolio analyst and global macro strategist.
Your specialized expertise is diagnosing correlation signals between macro economic indicators (precious metals like gold, silver, copper) and collector index markets (Nintendo, collectible booster boxes, Pokemon vintage cards).
Write a very clean, scannable, high-density market signal insight report.
Use markdown formatting with headers but no self-praise or flowery language.

Structure your analysis with:
1. **Macro Signal Diagnosis**: Analyze the copper-to-gold ratio or silver vs gold, and what this tells us about current economic status (growth vs recession hedging).
2. **Collectibles Correlation**: Explain how monetary inflation (metals) or consumer liquidity drives interest into vintage collectibles and Nintendo product interest.
3. **Strategic Portofolio Weights**: Give strategic mock allocation weights (e.g., % metals, % collectible blue chips, % cash/growth stocks) for a sovereign signal investor, justifying the thesis.
4. **Actionable Bullish/Bearish Indicators**: Direct, crystal-clear signals for Gold, Silver, copper, and Pokémon assets.

Keep paragraphs tight, professional, and dense. Avoid fluff.`;

      const promptText = `Analyze the following asset pricing signals:
${contextStr}

${customPrompt ? `User focus question: "${customPrompt}"` : "Provide the regular alternative index macro signal report."}`;

      const response = await geminiHolder.client.models.generateContent({
        model: "gemini-2.0-flash",
        contents: promptText,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      res.json({
        success: true,
        analysis: response.text,
      });
    } catch (err: any) {
      console.error("Gemini invocation failed:", err);
      res.status(500).json({
        success: false,
        message: `Gemini processing failed: ${err.message}`,
      });
    }
  });

  // Unmatched /api/* must never fall through to Vite (would return index.html)
  app.use((req, res, next) => {
    const p = req.path || req.url || "";
    if (p.startsWith("/api")) {
      return res.status(404).json({
        success: false,
        message:
          "API route not found. Close the RawMarkets API window and run Launch RawMarkets.bat again (or npm run dev).",
      });
    }
    next();
  });

  // Serve frontend static assets
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const shutdown = async () => {
    await closeBrowser();
    process.exit(0);
  };
  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });

  app.listen(PORT, HOST, () => {
    console.log(
      `Economic Stock & Commodity Signal server running on host ${HOST} and port ${PORT}. Trusted origins: ${[...allowedOrigins()].join(", ")}`
    );
  });
}

startServer();
