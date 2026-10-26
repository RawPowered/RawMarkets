import crypto from "crypto";
import { getDb } from "./db";
import type { NewsFeedLane } from "../types";

export interface StoredNewsArticleInput {
  title: string;
  snippet: string;
  url: string | null;
  published_at: string | null;
  feedId: string;
  sourceLabel: string;
  symbol: string;
  imageUrl: string | null;
}

export interface StoredNewsArticleRow extends StoredNewsArticleInput {
  lane: NewsFeedLane;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeUrlKey(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw.trim());
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (
        lower.startsWith("utm_") ||
        lower === "fbclid" ||
        lower === "gclid" ||
        lower === "mc_cid" ||
        lower === "mc_eid"
      ) {
        url.searchParams.delete(key);
      }
    }
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    return url.toString();
  } catch {
    return raw.trim().toLowerCase();
  }
}

function normalizeTitleKey(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function makeArticleKey(feedId: string, symbol: string, title: string, url: string | null): string {
  const urlKey = normalizeUrlKey(url);
  const identity = urlKey ?? `title:${normalizeTitleKey(title)}`;
  return crypto
    .createHash("sha1")
    .update(`${feedId}|${symbol.toUpperCase()}|${identity}`)
    .digest("hex");
}

function makeFeedKey(feedId: string, symbol: string): string {
  return `${feedId}|${symbol.toUpperCase()}`;
}

function parsePublishedMs(value: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function rowToArticle(row: {
  feed_id: string;
  lane: NewsFeedLane;
  symbol: string;
  source_label: string;
  title: string;
  snippet: string | null;
  url: string | null;
  published_at: string | null;
  image_url: string | null;
}): StoredNewsArticleRow {
  return {
    title: row.title,
    snippet: row.snippet ?? "",
    url: row.url,
    published_at: row.published_at,
    feedId: row.feed_id,
    sourceLabel: row.source_label,
    symbol: row.symbol,
    imageUrl: row.image_url,
    lane: row.lane,
  };
}

export function upsertNewsArticles(
  articles: StoredNewsArticleInput[],
  lane: NewsFeedLane,
  seenAt = Date.now()
): number {
  if (articles.length === 0) return 0;
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO news_bay_articles (
      article_key, feed_id, lane, symbol, source_label, title, snippet, url,
      url_key, published_at, published_at_ms, image_url, first_seen_at, last_seen_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(article_key) DO UPDATE SET
      lane = excluded.lane,
      source_label = excluded.source_label,
      title = excluded.title,
      snippet = excluded.snippet,
      url = excluded.url,
      url_key = excluded.url_key,
      published_at = excluded.published_at,
      published_at_ms = excluded.published_at_ms,
      image_url = excluded.image_url,
      last_seen_at = excluded.last_seen_at`
  );

  const tx = db.transaction(() => {
    for (const article of articles) {
      const sym = article.symbol.toUpperCase();
      stmt.run(
        makeArticleKey(article.feedId, sym, article.title, article.url),
        article.feedId,
        lane,
        sym,
        article.sourceLabel,
        article.title,
        article.snippet,
        article.url,
        normalizeUrlKey(article.url),
        article.published_at,
        parsePublishedMs(article.published_at),
        article.imageUrl,
        seenAt,
        seenAt
      );
    }
  });
  tx();
  return articles.length;
}

export function listSavedNewsArticles(options: {
  feedId: string;
  symbol: string;
  retentionDays: number;
  limit: number;
}): StoredNewsArticleRow[] {
  const cutoff = Date.now() - Math.max(1, options.retentionDays) * DAY_MS;
  const rows = getDb()
    .prepare(
      `SELECT feed_id, lane, symbol, source_label, title, snippet, url, published_at, image_url
       FROM news_bay_articles
       WHERE feed_id = ?
         AND symbol = ?
         AND (
           last_seen_at >= ?
           OR clipped_at IS NOT NULL
           OR (
             url IS NOT NULL
             AND EXISTS (
               SELECT 1 FROM investor_journal_entries j
               WHERE j.url = news_bay_articles.url
             )
           )
         )
       ORDER BY COALESCE(published_at_ms, last_seen_at) DESC, last_seen_at DESC
       LIMIT ?`
    )
    .all(
      options.feedId,
      options.symbol.toUpperCase(),
      cutoff,
      Math.max(1, options.limit)
    ) as Parameters<typeof rowToArticle>[0][];

  return rows.map(rowToArticle);
}

export interface RecentNewsBySymbolRow extends StoredNewsArticleRow {
  lastSeenAt: number;
}

/** Cross-feed RSS articles for multiple symbols (newest first, global cap). */
export function listRecentNewsBySymbols(options: {
  symbols: string[];
  retentionDays: number;
  globalLimit: number;
}): RecentNewsBySymbolRow[] {
  const syms = [
    ...new Set(
      options.symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)
    ),
  ];
  if (syms.length === 0) return [];

  const cutoff = Date.now() - Math.max(1, options.retentionDays) * DAY_MS;
  const limit = Math.max(1, Math.min(200, options.globalLimit));
  const placeholders = syms.map(() => "?").join(", ");

  const rows = getDb()
    .prepare(
      `SELECT feed_id, lane, symbol, source_label, title, snippet, url, published_at, image_url, last_seen_at
       FROM news_bay_articles
       WHERE symbol IN (${placeholders})
         AND (
           last_seen_at >= ?
           OR clipped_at IS NOT NULL
           OR (
             url IS NOT NULL
             AND EXISTS (
               SELECT 1 FROM investor_journal_entries j
               WHERE j.url = news_bay_articles.url
             )
           )
         )
       ORDER BY COALESCE(published_at_ms, last_seen_at) DESC, last_seen_at DESC
       LIMIT ?`
    )
    .all(...syms, cutoff, limit) as (Parameters<typeof rowToArticle>[0] & {
      last_seen_at: number;
    })[];

  return rows.map((row) => ({
    ...rowToArticle(row),
    lastSeenAt: row.last_seen_at,
  }));
}

export function markNewsFeedRefreshed(
  feedId: string,
  symbol: string,
  lane: NewsFeedLane,
  refreshedAt = Date.now()
): void {
  const sym = symbol.toUpperCase();
  getDb()
    .prepare(
      `INSERT INTO news_bay_feed_state (feed_key, feed_id, lane, symbol, refreshed_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(feed_key) DO UPDATE SET
         lane = excluded.lane,
         refreshed_at = excluded.refreshed_at`
    )
    .run(makeFeedKey(feedId, sym), feedId, lane, sym, refreshedAt);
}

export function getNewsFeedRefreshedAt(feedId: string, symbol: string): number | null {
  const row = getDb()
    .prepare("SELECT refreshed_at FROM news_bay_feed_state WHERE feed_key = ?")
    .get(makeFeedKey(feedId, symbol)) as { refreshed_at: number } | undefined;
  return row?.refreshed_at ?? null;
}

export function isNewsFeedStale(
  feedId: string,
  symbol: string,
  refreshMs: number
): boolean {
  const refreshedAt = getNewsFeedRefreshedAt(feedId, symbol);
  if (refreshedAt == null) return true;
  return Date.now() - refreshedAt >= refreshMs;
}

/** Full-text style search across stored headlines (any symbol). */
export function listNewsArticlesByTextSearch(options: {
  query: string;
  retentionDays: number;
  limit: number;
}): StoredNewsArticleRow[] {
  const q = options.query.trim().toLowerCase();
  if (!q) return [];

  const cutoff = Date.now() - Math.max(1, options.retentionDays) * DAY_MS;
  const limit = Math.max(1, Math.min(50, options.limit));
  const like = `%${q.replace(/%/g, "")}%`;

  const rows = getDb()
    .prepare(
      `SELECT feed_id, lane, symbol, source_label, title, snippet, url, published_at, image_url
       FROM news_bay_articles
       WHERE (
           LOWER(title) LIKE ?
           OR LOWER(snippet) LIKE ?
           OR LOWER(symbol) LIKE ?
         )
         AND (
           last_seen_at >= ?
           OR clipped_at IS NOT NULL
         )
       ORDER BY COALESCE(published_at_ms, last_seen_at) DESC, last_seen_at DESC
       LIMIT ?`
    )
    .all(like, like, like, cutoff, limit) as Parameters<typeof rowToArticle>[0][];

  return rows.map(rowToArticle);
}

/** Bulk read for News Bay GET (sqlite-first path). */
export function listNewsBayArticlesFromDb(options: {
  lane: NewsFeedLane;
  feedIds: string[];
  symbols: string[];
  retentionDays: number;
  limit: number;
}): StoredNewsArticleRow[] {
  const feedIds = [...new Set(options.feedIds.filter(Boolean))];
  if (feedIds.length === 0) return [];

  const symbols = options.symbols.map((s) => s.trim().toUpperCase());
  const symbolList = symbols.length > 0 ? [...new Set(symbols)] : [""];

  const cutoff = Date.now() - Math.max(1, options.retentionDays) * DAY_MS;
  const limit = Math.max(1, Math.min(500, options.limit));
  const feedPh = feedIds.map(() => "?").join(", ");
  const symPh = symbolList.map(() => "?").join(", ");

  const rows = getDb()
    .prepare(
      `SELECT feed_id, lane, symbol, source_label, title, snippet, url, published_at, image_url
       FROM news_bay_articles
       WHERE lane = ?
         AND feed_id IN (${feedPh})
         AND symbol IN (${symPh})
         AND (
           last_seen_at >= ?
           OR clipped_at IS NOT NULL
           OR (
             url IS NOT NULL
             AND EXISTS (
               SELECT 1 FROM investor_journal_entries j
               WHERE j.url = news_bay_articles.url
             )
           )
         )
       ORDER BY COALESCE(published_at_ms, last_seen_at) DESC, last_seen_at DESC
       LIMIT ?`
    )
    .all(
      options.lane,
      ...feedIds,
      ...symbolList,
      cutoff,
      limit
    ) as Parameters<typeof rowToArticle>[0][];

  return rows.map(rowToArticle);
}

export function purgeExpiredUnclippedNewsArticles(retentionDays: number): number {
  const cutoff = Date.now() - Math.max(1, retentionDays) * DAY_MS;
  const result = getDb()
    .prepare(
      `DELETE FROM news_bay_articles
       WHERE last_seen_at < ?
         AND clipped_at IS NULL
         AND (
           url IS NULL
           OR NOT EXISTS (
             SELECT 1 FROM investor_journal_entries j
             WHERE j.url = news_bay_articles.url
           )
         )`
    )
    .run(cutoff);
  return result.changes;
}

export function markNewsArticleClipped(url: string | null | undefined): number {
  if (!url?.trim()) return 0;
  const normalized = normalizeUrlKey(url);
  if (!normalized) return 0;
  const result = getDb()
    .prepare(
      `UPDATE news_bay_articles
       SET clipped_at = COALESCE(clipped_at, ?)
       WHERE url = ? OR url_key = ?`
    )
    .run(Date.now(), url, normalized);
  return result.changes;
}
