import type { CachedData } from "./db";
import { getEngineSettings, loadCustomAssets } from "./db";
import { listPortfolioHoldings } from "./portfolioDb";
import {
  NEWS_FEED_SOURCES,
  parseFeedIdsParam,
  resolveFeedUrl,
  type NewsFeedDefinition,
  type NewsFeedLane,
} from "./newsFeedRegistry";
import { fetchRssFeed } from "./rssFetch";
import { classifySymbolRelevance, matchesSymbolInText } from "./newsBaySymbolFilter";
import type { NewsBayWatchlistEntry } from "../types";
import { resolveCikForSymbol } from "./secCikResolver";
import { getIrRssUrl, scheduleIrDiscovery } from "./irFeedDiscovery";
import { fetchRedditSearchRss, fetchStocktwitsStream } from "./crowdFetch";
import {
  getNewsFeedPrefs,
  setNewsFeedPrefs,
} from "./newsFeedPrefs";
import {
  getNewsFeedRefreshedAt,
  isNewsFeedStale,
  listSavedNewsArticles,
  markNewsFeedRefreshed,
  purgeExpiredUnclippedNewsArticles,
  upsertNewsArticles,
} from "./newsArticleStore";
import { runGlobalTaskPool } from "./fetchThrottle";
import { wasNewsFeedRefreshedToday } from "./launchIncremental";

export interface NewsBayRouteDeps {
  apiCache: Record<string, CachedData>;
  saveCache: () => void;
}

export interface NewsBayFetchOptions {
  forceFresh?: boolean;
}

export interface RawBayItem {
  title: string;
  snippet: string;
  url: string | null;
  published_at: string | null;
  feedId: string;
  sourceLabel: string;
  symbol: string;
  imageUrl: string | null;
  relevanceConfidence?: "none" | "low" | "medium" | "high";
  relevanceReasons?: string[];
}

const NEWS_BAY_TTL_MS = 60 * 60 * 1000;
const AGGREGATE_MAX_ITEMS_COMPANY = 60;
const AGGREGATE_MAX_ITEMS_LANE = 30;
const PER_SYMBOL_CAP = 8;
const SAVED_FEED_LIMIT = 30;

function shouldApplyCompanyRelevanceFilter(feed: NewsFeedDefinition): boolean {
  if (feed.lane !== "company" && feed.lane !== "crowd") return false;
  if (feed.id.startsWith("sec_") || feed.id === "company_ir") return false;
  return true;
}

function filterRelevantCompanyItems(
  feed: NewsFeedDefinition,
  items: RawBayItem[],
  symbol: string,
  companyName?: string
): RawBayItem[] {
  if (!shouldApplyCompanyRelevanceFilter(feed)) return items;
  return items
    .map((item) => {
      const relevance = classifySymbolRelevance(
        `${item.title} ${item.snippet} ${item.url ?? ""}`,
        symbol,
        companyName
      );
      return {
        ...item,
        relevanceConfidence: relevance.confidence,
        relevanceReasons: relevance.reasons,
      };
    })
    .filter((item) => item.relevanceConfidence !== "none");
}

export function buildWatchlist(): NewsBayWatchlistEntry[] {
  const catalog = loadCustomAssets() as Record<
    string,
    { name?: string; symbol?: string }
  >;
  const portfolioSyms = new Set(
    listPortfolioHoldings().map((h) => h.symbol.toUpperCase())
  );
  const catalogSyms = new Set(Object.keys(catalog).map((k) => k.toUpperCase()));
  const all = new Set([...catalogSyms, ...portfolioSyms]);

  const entries: NewsBayWatchlistEntry[] = [];
  for (const sym of [...all].sort()) {
    const inCat = catalogSyms.has(sym);
    const inPort = portfolioSyms.has(sym);
    const payload = catalog[sym];
    entries.push({
      symbol: sym,
      name: payload?.name ?? sym,
      from:
        inCat && inPort ? "both" : inCat ? "catalog" : "portfolio",
    });
  }
  return entries;
}

function cacheKey(feedId: string, symbol: string): string {
  return `news_bay_v2_${feedId}_${symbol.toUpperCase()}`;
}

function laneCacheKey(feedId: string): string {
  return `news_bay_lane_${feedId}`;
}

function shouldUseSavedArticles(_feed: NewsFeedDefinition): boolean {
  return true;
}

export function storedRowToRawBayItem(
  item: import("./newsArticleStore").StoredNewsArticleRow
): RawBayItem {
  return {
    title: item.title,
    snippet: item.snippet,
    url: item.url,
    published_at: item.published_at,
    feedId: item.feedId,
    sourceLabel: item.sourceLabel,
    symbol: item.symbol,
    imageUrl: item.imageUrl,
  };
}

export { isNewsFeedStale };

function readSavedFeedArticles(
  feed: NewsFeedDefinition,
  symbol: string,
  retentionDays: number,
  limit = SAVED_FEED_LIMIT
): RawBayItem[] {
  return listSavedNewsArticles({
    feedId: feed.id,
    symbol,
    retentionDays,
    limit,
  }).map((item) => ({
    title: item.title,
    snippet: item.snippet,
    url: item.url,
    published_at: item.published_at,
    feedId: item.feedId,
    sourceLabel: item.sourceLabel,
    symbol: item.symbol,
    imageUrl: item.imageUrl,
  }));
}

function isSavedFeedFresh(
  feed: NewsFeedDefinition,
  symbol: string,
  refreshMs: number
): boolean {
  const refreshedAt = getNewsFeedRefreshedAt(feed.id, symbol);
  return refreshedAt != null && Date.now() - refreshedAt < refreshMs;
}

function saveFetchedArticles(
  feed: NewsFeedDefinition,
  symbol: string,
  items: RawBayItem[],
  retentionDays: number
): RawBayItem[] {
  upsertNewsArticles(items, feed.lane);
  markNewsFeedRefreshed(feed.id, symbol, feed.lane);
  purgeExpiredUnclippedNewsArticles(retentionDays);
  return readSavedFeedArticles(feed, symbol, retentionDays);
}

async function fetchCrowdFeed(
  feed: NewsFeedDefinition,
  symbol: string
): Promise<RawBayItem[]> {
  const sym = symbol.toUpperCase();
  if (feed.crowdProvider === "stocktwits") {
    const items = await fetchStocktwitsStream(sym, feed.maxItems);
    return items.map((item) => ({
      ...item,
      feedId: feed.id,
      symbol: sym,
    }));
  }
  if (feed.crowdProvider === "reddit") {
    const items = await fetchRedditSearchRss(sym, feed.maxItems);
    return items.map((item) => ({
      ...item,
      feedId: feed.id,
      symbol: sym,
    }));
  }
  return [];
}

export async function fetchFeedForSymbol(
  feed: NewsFeedDefinition,
  symbol: string,
  companyName: string | undefined,
  deps: NewsBayRouteDeps,
  options?: NewsBayFetchOptions
): Promise<RawBayItem[]> {
  const sym = symbol.toUpperCase();
  const settings = getEngineSettings();
  const refreshMs = settings.newsArticleRefreshMinutes * 60 * 1000;
  const forceFresh = options?.forceFresh === true;

  if (feed.crowdProvider) {
    if (!forceFresh && isSavedFeedFresh(feed, sym, refreshMs)) {
      return readSavedFeedArticles(
        feed,
        sym,
        settings.newsArticleRetentionDays
      );
    }
    const mapped = await fetchCrowdFeed(feed, sym);
    const relevant = filterRelevantCompanyItems(feed, mapped, sym, companyName);
    return saveFetchedArticles(
      feed,
      sym,
      relevant,
      settings.newsArticleRetentionDays
    );
  }

  if (feed.id === "company_ir") {
    const irUrl = getIrRssUrl(sym);
    if (!irUrl) return [];
    if (!forceFresh && isSavedFeedFresh(feed, sym, refreshMs)) {
      return readSavedFeedArticles(
        feed,
        sym,
        settings.newsArticleRetentionDays
      );
    }
    const raw = await fetchRssFeed(irUrl, feed.label, feed.maxItems);
    const mapped = raw.map((item) => ({
      title: item.title,
      snippet: item.snippet,
      url: item.url,
      published_at: item.published_at,
      feedId: feed.id,
      sourceLabel: item.sourceLabel,
      symbol: sym,
      imageUrl: item.imageUrl,
    }));
    return saveFetchedArticles(
      feed,
      sym,
      mapped,
      settings.newsArticleRetentionDays
    );
  }

  let cik: string | undefined;
  if (feed.id.startsWith("sec_")) {
    const resolved = await resolveCikForSymbol(sym, deps.apiCache, deps.saveCache);
    if (!resolved) return [];
    cik = resolved;
  }

  const ck = cacheKey(feed.id, sym);
  const cached = deps.apiCache[ck];
  const now = Date.now();
  if (
    !forceFresh &&
    !shouldUseSavedArticles(feed) &&
    cached &&
    now - cached.timestamp < NEWS_BAY_TTL_MS
  ) {
    return cached.data as RawBayItem[];
  }
  if (!forceFresh && shouldUseSavedArticles(feed) && isSavedFeedFresh(feed, sym, refreshMs)) {
    return readSavedFeedArticles(
      feed,
      sym,
      settings.newsArticleRetentionDays
    );
  }

  const url = feed.requiresSymbol
    ? resolveFeedUrl(feed, sym, { cik })
    : resolveFeedUrl(feed, sym, { cik });
  if (!url) return [];

  const headers =
    feed.id.startsWith("sec_") || feed.domain === "sec.gov"
      ? {
          "User-Agent":
            "RawMarkets/1.0 (news-bay; contact: support@rawmarkets.local)",
        }
      : undefined;

  const raw = await fetchRssFeed(url, feed.label, feed.maxItems, headers);
  let filtered = raw;

  if (feed.filterMode === "text") {
    filtered = raw.filter((item) =>
      matchesSymbolInText(
        `${item.title} ${item.snippet}`,
        sym,
        companyName
      )
    );
  }

  const mapped: RawBayItem[] = filtered.map((item) => ({
    title: item.title,
    snippet: item.snippet,
    url: item.url,
    published_at: item.published_at,
    feedId: feed.id,
    sourceLabel: item.sourceLabel,
    symbol: sym,
    imageUrl: item.imageUrl,
  }));

  const relevant = filterRelevantCompanyItems(feed, mapped, sym, companyName);
  if (shouldUseSavedArticles(feed)) {
    return saveFetchedArticles(
      feed,
      sym,
      relevant,
      settings.newsArticleRetentionDays
    );
  }
  deps.apiCache[ck] = { timestamp: now, data: relevant };
  deps.saveCache();
  return relevant;
}

export async function fetchStaticLaneFeed(
  feed: NewsFeedDefinition,
  deps: NewsBayRouteDeps,
  options?: NewsBayFetchOptions
): Promise<RawBayItem[]> {
  const settings = getEngineSettings();
  const refreshMs = settings.newsArticleRefreshMinutes * 60 * 1000;
  const forceFresh = options?.forceFresh === true;
  if (!forceFresh && isSavedFeedFresh(feed, "", refreshMs)) {
    return readSavedFeedArticles(
      feed,
      "",
      settings.newsArticleRetentionDays
    );
  }

  const ck = laneCacheKey(feed.id);
  const cached = deps.apiCache[ck];
  const now = Date.now();
  if (
    !forceFresh &&
    !shouldUseSavedArticles(feed) &&
    cached &&
    now - cached.timestamp < NEWS_BAY_TTL_MS
  ) {
    return cached.data as RawBayItem[];
  }
  const url = feed.url;
  if (!url) return [];
  const raw = await fetchRssFeed(url, feed.label, feed.maxItems);
  const mapped: RawBayItem[] = raw.map((item) => ({
    title: item.title,
    snippet: item.snippet,
    url: item.url,
    published_at: item.published_at,
    feedId: feed.id,
    sourceLabel: item.sourceLabel,
    symbol: "",
    imageUrl: item.imageUrl,
  }));
  if (shouldUseSavedArticles(feed)) {
    return saveFetchedArticles(
      feed,
      "",
      mapped,
      settings.newsArticleRetentionDays
    );
  }
  deps.apiCache[ck] = { timestamp: now, data: mapped };
  deps.saveCache();
  return mapped;
}

const LAUNCH_RSS_GLOBAL_WORKERS = 3;

function prioritizeWatchlistForLaunch(
  entries: NewsBayWatchlistEntry[]
): NewsBayWatchlistEntry[] {
  const holdingSyms = new Set(
    listPortfolioHoldings().map((h) => h.symbol.toUpperCase())
  );
  return [...entries].sort((a, b) => {
    const aPort = holdingSyms.has(a.symbol) ? 0 : 1;
    const bPort = holdingSyms.has(b.symbol) ? 0 : 1;
    if (aPort !== bPort) return aPort - bPort;
    if (a.from === "both" && b.from !== "both") return -1;
    if (b.from === "both" && a.from !== "both") return 1;
    return a.symbol.localeCompare(b.symbol);
  });
}

export async function warmRssForLaunch(
  deps: NewsBayRouteDeps
): Promise<{ feedsFetched: number; articlesStored: number }> {
  const prefs = getNewsFeedPrefs();
  const watchlist = prioritizeWatchlistForLaunch(buildWatchlist());
  scheduleIrDiscovery(watchlist);
  const settings = getEngineSettings();
  const lanes: NewsFeedLane[] = ["company", "macro", "context", "crowd"];
  let feedsFetched = 0;
  let articlesStored = 0;
  const tasks: Array<() => Promise<void>> = [];

  for (const lane of lanes) {
    const feeds = parseFeedIdsParam(undefined, {
      enabledOnly: true,
      lane,
      prefs,
    }).filter((f) => f.tier !== "serpapi");

    if (lane === "macro" || lane === "context") {
      for (const feed of feeds) {
        if (wasNewsFeedRefreshedToday(feed.id, "")) continue;
        tasks.push(async () => {
          const items = await fetchStaticLaneFeed(feed, deps, { forceFresh: false });
          feedsFetched += 1;
          articlesStored += items.length;
        });
      }
    } else if (watchlist.length > 0) {
      for (const w of watchlist) {
        const sym = w.symbol.toUpperCase();
        for (const feed of feeds) {
          if (wasNewsFeedRefreshedToday(feed.id, sym)) continue;
          tasks.push(async () => {
            const items = await fetchFeedForSymbol(
              feed,
              w.symbol,
              w.name,
              deps,
              { forceFresh: false }
            );
            feedsFetched += 1;
            articlesStored += items.length;
          });
        }
      }
    }
  }

  await runGlobalTaskPool(tasks, LAUNCH_RSS_GLOBAL_WORKERS);
  purgeExpiredUnclippedNewsArticles(settings.newsArticleRetentionDays);
  return { feedsFetched, articlesStored };
}
