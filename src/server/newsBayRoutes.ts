import type { Express, Request, Response } from "express";
import type { CachedData } from "./db";
import { getEngineSettings, loadCustomAssets } from "./db";
import { getPortfolioSettings } from "./portfolioDb";
import { getEngineMeta } from "./portfolioResearchDb";
import { DEFAULT_OLLAMA_MODEL } from "./ollamaDefaults";
import {
  NEWS_FEED_SOURCES,
  parseFeedIdsParam,
  type NewsFeedDefinition,
  type NewsFeedLane,
} from "./newsFeedRegistry";
import {
  resetOllamaRequestCap,
  scoreHeadline,
} from "./newsSentiment";
import type { NewsBayItem } from "../types";
import { resolveNewsSourceDomain } from "../lib/newsSourceDomains";
import { scheduleIrDiscovery, setIrFeedManual } from "./irFeedDiscovery";
import {
  buildRankable,
  macroTagsFromText,
  rankArticles,
} from "./newsBayRank";
import {
  getNewsFeedPrefs,
  setNewsFeedPrefs,
} from "./newsFeedPrefs";
import {
  isNewsFeedStale,
  listNewsBayArticlesFromDb,
} from "./newsArticleStore";
import {
  buildWatchlist,
  fetchFeedForSymbol,
  fetchStaticLaneFeed,
  storedRowToRawBayItem,
  type NewsBayRouteDeps,
  type RawBayItem,
  warmRssForLaunch,
} from "./newsBayFetch";

export type { NewsBayRouteDeps } from "./newsBayFetch";
export { warmRssForLaunch } from "./newsBayFetch";

const AGGREGATE_MAX_ITEMS_COMPANY = 60;
const AGGREGATE_MAX_ITEMS_LANE = 30;
const PER_SYMBOL_CAP = 8;

type NewsBayDataSource = "sqlite" | "rss" | "mixed";

function formatDate(published: string | null): string {
  if (!published) return "Today";
  try {
    const d = new Date(published);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  } catch {
    /* keep raw */
  }
  return published.slice(0, 24) || "Today";
}

function parseLaneParam(req: Request): NewsFeedLane {
  const lane = String(req.query.lane ?? "company").toLowerCase();
  if (lane === "macro" || lane === "context" || lane === "crowd") return lane;
  return "company";
}

function mergeRawItems(primary: RawBayItem[], extra: RawBayItem[]): RawBayItem[] {
  const seen = new Set<string>();
  const out: RawBayItem[] = [];
  for (const item of [...extra, ...primary]) {
    const key = `${item.feedId}|${item.symbol}|${(item.url ?? item.title).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function loadRawItemsFromDb(
  lane: NewsFeedLane,
  feeds: NewsFeedDefinition[],
  symbols: string[],
  retentionDays: number,
  limit: number
): RawBayItem[] {
  const rows = listNewsBayArticlesFromDb({
    lane,
    feedIds: feeds.map((f) => f.id),
    symbols,
    retentionDays,
    limit,
  });
  return rows.map(storedRowToRawBayItem);
}

async function fetchStaleFeedsForLane(
  feeds: NewsFeedDefinition[],
  deps: NewsBayRouteDeps,
  forceFresh: boolean
): Promise<RawBayItem[]> {
  const engine = getEngineSettings();
  const refreshMs = engine.newsArticleRefreshMinutes * 60 * 1000;
  const staleFeeds = forceFresh
    ? feeds
    : feeds.filter((f) => isNewsFeedStale(f.id, "", refreshMs));
  if (staleFeeds.length === 0) return [];

  const batches = await Promise.all(
    staleFeeds.map((feed) =>
      fetchStaticLaneFeed(feed, deps, { forceFresh: forceFresh || undefined })
    )
  );
  const raw: RawBayItem[] = [];
  for (const batch of batches) {
    raw.push(...batch);
  }
  return raw;
}

async function fetchStaleFeedsForSymbols(
  feeds: NewsFeedDefinition[],
  symbolsToFetch: Array<{ symbol: string; name?: string }>,
  deps: NewsBayRouteDeps,
  forceFresh: boolean
): Promise<RawBayItem[]> {
  const engine = getEngineSettings();
  const refreshMs = engine.newsArticleRefreshMinutes * 60 * 1000;
  const raw: RawBayItem[] = [];

  for (const { symbol, name } of symbolsToFetch) {
    const sym = symbol.toUpperCase();
    const staleFeeds = forceFresh
      ? feeds
      : feeds.filter((f) => isNewsFeedStale(f.id, sym, refreshMs));
    if (staleFeeds.length === 0) continue;

    const feedResults = await Promise.all(
      staleFeeds.map((feed) =>
        fetchFeedForSymbol(feed, symbol, name, deps, {
          forceFresh: forceFresh || undefined,
        })
      )
    );
    for (const batch of feedResults) {
      for (const item of batch.slice(0, PER_SYMBOL_CAP)) {
        raw.push(item);
      }
    }
  }
  return raw;
}

export function registerNewsBayRoutes(
  app: Express,
  deps: NewsBayRouteDeps
): void {
  app.get("/api/news-bay/watchlist", (_req, res) => {
    const symbols = buildWatchlist();
    scheduleIrDiscovery(symbols);
    res.json({ success: true, symbols });
  });

  app.get("/api/news-bay/sources", (req, res) => {
    const laneParam = String(req.query.lane ?? "all").toLowerCase();
    const prefs = getNewsFeedPrefs();
    const pool =
      laneParam === "all"
        ? NEWS_FEED_SOURCES
        : NEWS_FEED_SOURCES.filter((f) => f.lane === laneParam);
    const sources = pool.map((f) => ({
      id: f.id,
      label: f.label,
      domain: f.domain,
      requiresSymbol: f.requiresSymbol,
      filterMode: f.filterMode,
      enabledDefault: f.enabledDefault,
      enabled: prefs[f.id] ?? f.enabledDefault,
      tier: f.tier,
      sourceClass: f.sourceClass,
      lane: f.lane,
      secFormType: f.secFormType,
      eventTypes: f.eventTypes,
    }));
    res.json({
      success: true,
      sources,
      lane: laneParam === "all" ? undefined : (laneParam as NewsFeedLane),
    });
  });

  app.get("/api/news-bay/prefs", (_req, res) => {
    res.json({ success: true, prefs: getNewsFeedPrefs() });
  });

  app.put("/api/news-bay/prefs", (req, res) => {
    try {
      const body = req.body as { prefs?: Record<string, boolean> };
      if (!body.prefs || typeof body.prefs !== "object") {
        res.status(400).json({ success: false, message: "prefs object required" });
        return;
      }
      setNewsFeedPrefs(body.prefs);
      res.json({ success: true, prefs: getNewsFeedPrefs() });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  });

  app.put("/api/news-bay/ir/:symbol", (req, res) => {
    try {
      const sym = String(req.params.symbol ?? "").trim().toUpperCase();
      const rssUrl = String((req.body as { rssUrl?: string }).rssUrl ?? "").trim();
      if (!sym || !rssUrl) {
        res.status(400).json({ success: false, message: "symbol and rssUrl required" });
        return;
      }
      setIrFeedManual(sym, rssUrl, (req.body as { irPageUrl?: string }).irPageUrl);
      res.json({ success: true, symbol: sym, rssUrl });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  });

  app.get("/api/news-bay", async (req, res) => {
    try {
      await handleNewsBayGet(req, res, deps);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg, items: [] });
    }
  });
}

async function handleNewsBayGet(
  req: Request,
  res: Response,
  deps: NewsBayRouteDeps
): Promise<void> {
  const lane = parseLaneParam(req);
  const prefs = getNewsFeedPrefs();
  const feedsParam = req.query.feeds as string | undefined;
  const feeds = parseFeedIdsParam(feedsParam, { enabledOnly: true, lane, prefs });
  const forceFresh =
    req.query.fresh === "1" || String(req.query.fresh).toLowerCase() === "true";
  const booted =
    req.query.booted === "1" || String(req.query.booted).toLowerCase() === "true";
  const fast =
    booted ||
    req.query.fast === "1" ||
    String(req.query.fast).toLowerCase() === "true";

  const engineSettings = getEngineSettings();
  const settings = getPortfolioSettings();
  const metaModel = getEngineMeta("ollama_default_model");
  const ollamaModel =
    typeof metaModel === "string" && metaModel.trim()
      ? metaModel.trim()
      : DEFAULT_OLLAMA_MODEL;
  const ollamaEnabled = settings.ollama_news_enabled === 1;

  resetOllamaRequestCap();

  const catalog = loadCustomAssets() as Record<string, { name?: string }>;
  const watchlist = buildWatchlist();
  scheduleIrDiscovery(watchlist);

  const maxItems =
    lane === "company" ? AGGREGATE_MAX_ITEMS_COMPANY : AGGREGATE_MAX_ITEMS_LANE;
  const dbLimit = maxItems * 4;

  let rawItems: RawBayItem[] = [];
  let dataSource: NewsBayDataSource = "sqlite";

  if (lane === "macro" || lane === "context") {
    const dbItems = loadRawItemsFromDb(
      lane,
      feeds,
      [""],
      engineSettings.newsArticleRetentionDays,
      dbLimit
    );
    rawItems = dbItems;

    if (forceFresh) {
      const fetched = await fetchStaleFeedsForLane(feeds, deps, true);
      rawItems = mergeRawItems(fetched, dbItems);
      dataSource = "rss";
    } else if (!booted) {
      const fetched = await fetchStaleFeedsForLane(feeds, deps, false);
      if (fetched.length > 0) {
        rawItems = mergeRawItems(fetched, dbItems);
        dataSource = dbItems.length > 0 ? "mixed" : "rss";
      }
    }
  } else {
    const symbolParam = String(req.query.symbol ?? "").trim().toUpperCase();
    const mode = String(req.query.mode ?? "single");
    const symbolsToFetch: Array<{ symbol: string; name?: string }> = [];

    if (mode === "all" || symbolParam === "ALL") {
      for (const w of watchlist) {
        symbolsToFetch.push({ symbol: w.symbol, name: w.name });
      }
    } else if (symbolParam) {
      const name =
        catalog[symbolParam]?.name ??
        watchlist.find((w) => w.symbol === symbolParam)?.name;
      symbolsToFetch.push({ symbol: symbolParam, name });
    } else if (watchlist.length > 0) {
      const first = watchlist[0];
      symbolsToFetch.push({ symbol: first.symbol, name: first.name });
    } else {
      res.json({
        success: true,
        source: "rss",
        lane,
        items: [],
        dataSource: "sqlite",
        message:
          "No symbols on watchlist. Track an asset or add a portfolio holding.",
      });
      return;
    }

    const symbolList = symbolsToFetch.map((s) => s.symbol);
    const dbItems = loadRawItemsFromDb(
      lane,
      feeds,
      symbolList,
      engineSettings.newsArticleRetentionDays,
      dbLimit
    );
    rawItems = dbItems;

    if (forceFresh) {
      const fetched = await fetchStaleFeedsForSymbols(
        feeds,
        symbolsToFetch,
        deps,
        true
      );
      rawItems = mergeRawItems(fetched, dbItems);
      dataSource = "rss";
    } else if (!booted) {
      const fetched = await fetchStaleFeedsForSymbols(
        feeds,
        symbolsToFetch,
        deps,
        false
      );
      if (fetched.length > 0) {
        rawItems = mergeRawItems(fetched, dbItems);
        dataSource = dbItems.length > 0 ? "mixed" : "rss";
      }
    }
  }

  const seen = new Set<string>();
  const deduped = rawItems.filter((item) => {
    const key = (item.url ?? item.title).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const feedMap = new Map(feeds.map((f) => [f.id, f]));
  const rankInput = deduped.map((item) => {
    const feed =
      feedMap.get(item.feedId) ??
      NEWS_FEED_SOURCES.find((f) => f.id === item.feedId)!;
    return buildRankable(item, feed);
  });
  const ranked = rankArticles(rankInput);
  const capped = ranked.slice(0, maxItems);

  const items: NewsBayItem[] = await Promise.all(
    capped.map(async (item) => {
      const feed = feedMap.get(item.feedId);
      const scored = await scoreHeadline(item.title, item.snippet, {
        symbol: item.symbol || undefined,
        ollamaEnabled,
        ollamaModel,
        useOllama: !fast,
      });
      const macroTags =
        lane === "macro" || lane === "context"
          ? macroTagsFromText(item.title, item.snippet)
          : undefined;

      return {
        title: item.title,
        snippet: item.snippet || "Market headline.",
        source: item.sourceLabel,
        date: formatDate(item.published_at),
        link: item.url ?? "#",
        sentiment: scored.sentiment,
        score: scored.score,
        feedId: item.feedId,
        matchedSymbols: item.symbol ? [item.symbol] : [],
        sentimentEngine: scored.engine,
        stockSymbol: item.symbol || undefined,
        sourceDomain:
          resolveNewsSourceDomain({
            feedId: item.feedId,
            sourceLabel: item.sourceLabel,
            articleUrl: item.url,
          }) ?? undefined,
        imageUrl: item.imageUrl ?? undefined,
        sourceClass: item.sourceClass,
        lane: feed?.lane ?? lane,
        rankScore: item.rankScore,
        eventType: item.eventType,
        macroTags,
      };
    })
  );

  const symbolParam = String(req.query.symbol ?? "").trim().toUpperCase();

  res.json({
    success: true,
    source: "rss",
    lane,
    items,
    symbol: symbolParam || undefined,
    feedCount: feeds.length,
    dataSource,
  });
}
