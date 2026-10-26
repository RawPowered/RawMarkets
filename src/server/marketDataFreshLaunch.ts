import type { Asset } from "../types";

import type { CachedData, EngineSettings } from "./db";

import {

  buildFeedStats,

  buildScrapeEquityKeys,

  setLastFeedStats,

  tagAssetSources,

} from "./liveMarket";

import { attachFeedNotes } from "./feedNotes";

import { hydrateItemsChartHistory } from "./chartHistoryHydrate";

import { persistAndHydrateMarketPrices } from "./marketPriceHistory";

import {

  applyMetalSpotToItems,

  isPlausibleMetalSpotCache,

  type MetalSpotRate,

} from "./metalSpot";

import { applyScrapeToAsset } from "./scrapers/orchestrator";

import {

  isMarketQuoteScrapeable,

  scrapeMarketQuotesParallel,

  marketQuoteLabel,

} from "./scrapers/marketQuote";

import {

  clearScrapeActivity,

  activityToScrapeLog,

  getScrapeActivity,

} from "./scrapers/scrapeQueue";

import { setLastMarketFeedAt } from "./marketRefreshPolicy";

import { getApiKey } from "./db";

import {

  buildLaunchFocusKeys,

  wasMarketPriceCheckedToday,

  wasMetalSpotFreshToday,

} from "./launchIncremental";



export interface MarketFreshLaunchCtx {

  apiCache: Record<string, CachedData>;

  saveCache: () => void;

  getEngineSettings: () => EngineSettings;

  getCatalogItems: () => Record<string, Asset>;

  ensureCatalog: () => void;

  getPortfolioSymbols?: () => string[];

  resolveMetalSpotRates: (

    fresh: boolean,

    options?: { allKitcoMetals?: boolean }

  ) => Promise<{

    rates: Record<string, MetalSpotRate>;

    source: string;

    fromLive: boolean;

    message?: string;

  }>;

  logEngineEvent?: (msg: string) => void;

}



export interface MarketFreshLaunchResult {

  ok: boolean;

  message?: string;

  skippedToday?: number;

  captured?: number;

}



/**

 * In-process fresh market capture (same path as Refresh Spot Feed / fresh scrape pass).

 * Portfolio symbols + metals; skips keys already checked today; charts only for new captures.

 */

export async function runMarketDataFreshLaunch(

  ctx: MarketFreshLaunchCtx

): Promise<MarketFreshLaunchResult> {

  clearScrapeActivity();

  ctx.ensureCatalog();



  const engineSettings = ctx.getEngineSettings();

  const items = { ...ctx.getCatalogItems() } as Record<string, Asset>;

  const livePrice = new Set<string>();

  const liveHistory = new Set<string>();

  const cachedPrice = new Set<string>();

  const scrapePrice = new Set<string>();

  const scrapeLog: string[] = [];



  const portfolioSymbols = ctx.getPortfolioSymbols?.() ?? [];

  const focusKeysEarly = buildLaunchFocusKeys(items, portfolioSymbols);

  const maxMarketScrapesEarly = engineSettings.fullCatalogScrapeRefresh ? 12 : 8;

  const queueKeys =

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



  const marketKeysEarly = queueKeys.filter((k) => !wasMarketPriceCheckedToday(k));

  const skippedToday = queueKeys.length - marketKeysEarly.length;



  const useScrape =

    engineSettings.usePlaywrightScrapers &&

    !engineSettings.forceOfflineFallback;



  const metalsOpts = {

    allKitcoMetals: engineSettings.fullCatalogScrapeRefresh === true,

  };

  const metalsFresh = !wasMetalSpotFreshToday(ctx.apiCache);



  const [metalSpot, parallelQuotes] = await Promise.all([

    ctx.resolveMetalSpotRates(metalsFresh, metalsOpts),

    useScrape && marketKeysEarly.length > 0

      ? scrapeMarketQuotesParallel(marketKeysEarly, items, {

          apiCache: ctx.apiCache,

          fresh: true,

          persist: ctx.saveCache,

          usePlaywright: false,

          fastCapture: true,

        })

      : Promise.resolve(

          new Map<string, import("./scrapers/types").ScrapeResult>()

        ),

  ]);



  const metalsNote = metalSpot.message || "";

  scrapeLog.push(

    metalSpot.fromLive

      ? `Metals: live (${metalSpot.source})`

      : metalsFresh

        ? `Metals: ${metalsNote || "no live scrape"}`

        : "Metals: cached today"

  );

  scrapeLog.push(...activityToScrapeLog(getScrapeActivity().recent).slice(-6));



  if (metalSpot.fromLive || isPlausibleMetalSpotCache(metalSpot.rates)) {

    const metalUpdated = applyMetalSpotToItems(

      items,

      metalSpot.rates,

      metalSpot.fromLive ? "scrape" : "cached"

    );

    for (const key of metalUpdated) scrapePrice.add(key);

  }



  const newlyCapturedKeys = new Set<string>();



  if (parallelQuotes.size > 0) {

    scrapeLog.push(

      `Fast capture (API): ${[...parallelQuotes.keys()].join(", ")}`

    );

    for (const key of marketKeysEarly) {

      if (scrapePrice.has(key)) continue;

      const asset = items[key];

      if (!asset) continue;

      const result = parallelQuotes.get(key);

      if (!result) continue;

      const updated = applyScrapeToAsset(asset, result);

      if (updated) {

        items[key] = updated;

        scrapePrice.add(key);

        newlyCapturedKeys.add(key);

        scrapeLog.push(

          `${marketQuoteLabel(result)}: ${key} $${updated.current.toFixed(2)}`

        );

      }

    }

  } else if (skippedToday > 0 && marketKeysEarly.length === 0) {

    scrapeLog.push(`${skippedToday} symbol(s) already captured today`);

  }



  const capturedOk = marketKeysEarly.filter((k) => scrapePrice.has(k));

  const scrapeMsg = [

    metalSpot.fromLive

      ? `Metals live: ${metalSpot.source}.`

      : metalsFresh

        ? metalsNote || "Metal scrape did not return live prices."

        : "Metals: using today's cache.",

    capturedOk.length > 0

      ? `Live capture: ${capturedOk.join(", ")}.`

      : marketKeysEarly.length > 0

        ? "Market capture attempted but no prices succeeded."

        : skippedToday > 0

          ? `${skippedToday} symbol(s) skipped (already checked today).`

          : "No scrapeable symbols in this refresh queue.",

  ]

    .filter(Boolean)

    .join(" ");



  scrapeLog.push(...activityToScrapeLog(getScrapeActivity().recent).slice(-12));



  const chartKeys =

    newlyCapturedKeys.size > 0

      ? [...newlyCapturedKeys]

      : undefined;



  const withCharts = await hydrateItemsChartHistory(items, {

    apiCache: ctx.apiCache,

    persistCache: ctx.saveCache,

    fresh: chartKeys != null && chartKeys.length > 0,

    keys: chartKeys,

  });

  for (const [key, item] of Object.entries(withCharts)) {

    if ((item.history?.length ?? 0) >= 2) liveHistory.add(key);

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

  const keyConfigured = !!(getApiKey("alpha_vantage")?.trim());

  attachFeedNotes(tagged, {

    metalsFromLive: metalSpot.fromLive,

    metalsSource: metalSpot.source,

    metalsMessage: metalsNote,

    alphaKeyConfigured: keyConfigured,

    forceOffline: engineSettings.forceOfflineFallback,

    livePriceKeys: livePrice,

    useScrapers: engineSettings.usePlaywrightScrapers,

  });



  const source =

    scrapePrice.size > 0 ||

    metalSpot.fromLive ||

    isPlausibleMetalSpotCache(metalSpot.rates)

      ? "scrape"

      : "unavailable";



  const stats = buildFeedStats(tagged, source, scrapeMsg, {

    alphaVantageKeyConfigured: keyConfigured,

    forceOfflineFallback: engineSettings.forceOfflineFallback,

  });

  setLastFeedStats(stats);

  setLastMarketFeedAt(Date.now());

  ctx.logEngineEvent?.(

    `Launch market feed: ${stats.livePriceCount} live (${source})`

  );



  return {

    ok: source !== "unavailable",

    message: scrapeMsg,

    skippedToday,

    captured: capturedOk.length,

  };

}
