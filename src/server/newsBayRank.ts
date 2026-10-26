import type { NewsFeedDefinition, NewsSourceClass } from "./newsFeedRegistry";
import { SOURCE_CLASS_WEIGHT } from "./newsFeedRegistry";

export interface RankableArticle {
  title: string;
  snippet: string;
  url: string | null;
  published_at: string | null;
  feedId: string;
  symbol: string;
  sourceLabel: string;
  imageUrl: string | null;
  sourceClass: NewsSourceClass;
  sourceWeight: number;
  secFormType?: string;
  eventType?: string;
}

const EVENT_KEYWORDS: Array<{ type: string; boost: number; patterns: RegExp[] }> = [
  { type: "earnings", boost: 0.35, patterns: [/earnings/i, /EPS/i, /quarterly results/i] },
  { type: "fda", boost: 0.3, patterns: [/FDA/i, /clinical trial/i, /PDUFA/i] },
  { type: "ma", boost: 0.3, patterns: [/merger/i, /acquisition/i, /takeover/i, /buyout/i] },
  { type: "offering", boost: 0.25, patterns: [/offering/i, /S-1/i, /IPO/i, /secondary/i] },
  { type: "guidance", boost: 0.2, patterns: [/guidance/i, /outlook/i, /forecast/i] },
  { type: "insider", boost: 0.25, patterns: [/insider/i, /Form 4/i, /director/i] },
];

const SEC_FORM_BOOST: Record<string, number> = {
  "8-K": 0.4,
  "10-Q": 0.35,
  "10-K": 0.35,
  "4": 0.3,
  "S-1": 0.3,
  "SC 13D": 0.25,
  "SC 13G": 0.2,
};

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function titleSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeTitle(a).split(" ").filter((w) => w.length > 2));
  const tb = new Set(normalizeTitle(b).split(" ").filter((w) => w.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const w of ta) {
    if (tb.has(w)) inter++;
  }
  const union = ta.size + tb.size - inter;
  return union > 0 ? inter / union : 0;
}

export function detectEventType(
  title: string,
  snippet: string,
  secFormType?: string
): string {
  if (secFormType) {
    if (secFormType === "4") return "insider";
    if (secFormType === "8-K") return "8-K";
    if (secFormType === "10-Q" || secFormType === "10-K") return "earnings";
    if (secFormType === "S-1") return "offering";
    if (secFormType.startsWith("SC 13")) return "ma";
    return secFormType;
  }
  const text = `${title} ${snippet}`;
  for (const ev of EVENT_KEYWORDS) {
    if (ev.patterns.some((p) => p.test(text))) return ev.type;
  }
  return "general";
}

export function eventTypeBoost(eventType: string, secFormType?: string): number {
  if (secFormType && SEC_FORM_BOOST[secFormType]) {
    return SEC_FORM_BOOST[secFormType];
  }
  const found = EVENT_KEYWORDS.find((e) => e.type === eventType);
  return found?.boost ?? 0;
}

export function freshnessBoost(publishedAt: string | null, nowMs = Date.now()): number {
  if (!publishedAt) return 0.05;
  const t = new Date(publishedAt).getTime();
  if (Number.isNaN(t)) return 0.05;
  const hours = (nowMs - t) / (60 * 60 * 1000);
  if (hours < 0) return 0.15;
  if (hours <= 6) return 0.25;
  if (hours <= 24) return 0.2;
  if (hours <= 72) return 0.1;
  return 0;
}

export function tickerMatchBoost(
  title: string,
  snippet: string,
  symbol: string,
  urlMatchedFeed: boolean
): number {
  if (urlMatchedFeed) return 0.3;
  const sym = symbol.toUpperCase();
  const re = new RegExp(`\\b${sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  if (re.test(title) || re.test(snippet)) return 0.3;
  return 0;
}

export function macroTagsFromText(title: string, snippet: string): string[] {
  const text = `${title} ${snippet}`.toLowerCase();
  const tags: string[] = [];
  if (/federal reserve|fed\b|fomc|powell/i.test(text)) tags.push("fed");
  if (/cpi|inflation|ppi|employment|jobs report|bls/i.test(text)) tags.push("labor_inflation");
  if (/gdp|bea\b|economic growth/i.test(text)) tags.push("growth");
  if (/census|retail sales|housing starts/i.test(text)) tags.push("census");
  if (/eia|crude|natural gas|petroleum|oil\b/i.test(text)) tags.push("energy");
  if (/cme|futures|rates\b|treasury/i.test(text)) tags.push("futures_rates");
  return tags;
}

export interface RankedScores {
  rankScore: number;
  eventType: string;
  duplicatePenalty: number;
}

export function computeRankScore(
  article: RankableArticle,
  seenTitles: string[],
  options?: { earningsProximity?: number }
): RankedScores {
  const text = `${article.title} ${article.snippet}`;
  const eventType =
    article.eventType ?? detectEventType(text, article.snippet, article.secFormType);

  let duplicatePenalty = 0;
  for (const prior of seenTitles) {
    const sim = titleSimilarity(article.title, prior);
    if (sim >= 0.65) {
      duplicatePenalty = Math.max(duplicatePenalty, 0.35 * sim);
    }
  }

  const urlMatched =
    !article.feedId.startsWith("sec_") &&
    article.sourceClass !== "market" &&
    Boolean(article.symbol);

  const rankScore =
    article.sourceWeight +
    tickerMatchBoost(article.title, article.snippet, article.symbol, urlMatched) +
    eventTypeBoost(eventType, article.secFormType) +
    freshnessBoost(article.published_at) +
    (options?.earningsProximity ?? 0) -
    duplicatePenalty;

  return { rankScore, eventType, duplicatePenalty };
}

export function rankArticles<T extends RankableArticle>(
  articles: T[],
  options?: { earningsProximity?: number }
): Array<T & RankedScores> {
  const seen: string[] = [];
  const scored = articles.map((a) => {
    const scores = computeRankScore(a, seen, options);
    seen.push(a.title);
    return { ...a, ...scores };
  });
  return scored.sort((a, b) => b.rankScore - a.rankScore);
}

export function buildRankable(
  item: {
    title: string;
    snippet: string;
    url: string | null;
    published_at: string | null;
    feedId: string;
    symbol: string;
    sourceLabel: string;
    imageUrl: string | null;
  },
  feed: NewsFeedDefinition
): RankableArticle {
  return {
    ...item,
    sourceClass: feed.sourceClass,
    sourceWeight: feed.sourceWeight,
    secFormType: feed.secFormType,
  };
}
