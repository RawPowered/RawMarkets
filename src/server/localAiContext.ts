import { getEngineSettings, loadCustomAssets } from "./db";
import { listRecentNewsBySymbols } from "./newsArticleStore";
import { listRecentNewsForSymbol } from "./portfolioResearchDb";
import { listPortfolioHoldings } from "./portfolioDb";
import { getLatestMarketPriceCheck } from "./marketPriceHistory";
import { loadLatestResearchForHoldings } from "./portfolioResearchJob";
import { buildWatchlist } from "./newsBayFetch";
import type {
  LocalAiCompactArticle,
  LocalAiCompactPortfolioNews,
  LocalAiCompactQuote,
  LocalAiCompactResearch,
  LocalAiDataContext,
  PlatformLocation,
} from "../types";

const MAX_FOCUS_SYMBOLS = 16;
const WATCHLIST_CAP = 12;
const SNIPPET_MAX = 180;
const JSON_CHAR_BUDGET = 14_000;
const PORTFOLIO_NEWS_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const PORTFOLIO_NEWS_PER_SYMBOL = 5;

export interface LocalAiContextOptions {
  localAiIncludeNews?: boolean;
  localAiMaxArticles?: number;
  localAiIncludeResearch?: boolean;
}

function truncateSnippet(text: string): string {
  const t = text.trim();
  if (t.length <= SNIPPET_MAX) return t;
  return `${t.slice(0, SNIPPET_MAX - 1)}…`;
}

/** Resolve which symbols to pull data for (exported for tests). */
export function resolveFocusSymbols(location: PlatformLocation): string[] {
  const ordered: string[] = [];

  if (location.page === "news-bay" && location.newsBaySymbol?.trim()) {
    ordered.push(location.newsBaySymbol.trim().toUpperCase());
  }
  if (location.selectedSymbol?.trim()) {
    ordered.push(location.selectedSymbol.trim().toUpperCase());
  }
  if (location.pinnedSymbols?.length) {
    for (const s of location.pinnedSymbols) {
      if (s?.trim()) ordered.push(s.trim().toUpperCase());
    }
  }

  if (location.page === "portfolio") {
    for (const h of listPortfolioHoldings()) {
      ordered.push(h.symbol.toUpperCase());
    }
  } else if (location.page === "news-bay") {
    const watch = buildWatchlist().slice(0, WATCHLIST_CAP);
    for (const w of watch) {
      ordered.push(w.symbol.toUpperCase());
    }
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const sym of ordered) {
    if (seen.has(sym)) continue;
    seen.add(sym);
    out.push(sym);
    if (out.length >= MAX_FOCUS_SYMBOLS) break;
  }
  return out;
}

function readLocalAiOptions(): Required<LocalAiContextOptions> {
  const settings = getEngineSettings() as unknown as Record<string, unknown>;
  return {
    localAiIncludeNews:
      settings.local_ai_include_news !== false &&
      settings.localAiIncludeNews !== false,
    localAiMaxArticles:
      typeof settings.local_ai_max_articles === "number"
        ? Math.max(5, Math.min(80, Math.round(settings.local_ai_max_articles)))
        : typeof settings.localAiMaxArticles === "number"
          ? Math.max(5, Math.min(80, Math.round(settings.localAiMaxArticles)))
          : 40,
    localAiIncludeResearch:
      settings.local_ai_include_research !== false &&
      settings.localAiIncludeResearch !== false,
  };
}

function gatherArticles(
  symbols: string[],
  retentionDays: number,
  maxArticles: number
): { articles: LocalAiCompactArticle[]; latestSeenAt: number | null } {
  const rows = listRecentNewsBySymbols({
    symbols,
    retentionDays,
    globalLimit: maxArticles,
  });
  let latestSeenAt: number | null = null;
  const articles: LocalAiCompactArticle[] = rows.map((row) => {
    if (latestSeenAt == null || row.lastSeenAt > latestSeenAt) {
      latestSeenAt = row.lastSeenAt;
    }
    return {
      symbol: row.symbol,
      feedId: row.feedId,
      sourceLabel: row.sourceLabel,
      title: row.title,
      snippet: truncateSnippet(row.snippet),
      publishedAt: row.published_at,
      url: row.url,
    };
  });
  return { articles, latestSeenAt };
}

function gatherPortfolioNews(symbols: string[]): LocalAiCompactPortfolioNews[] {
  const sinceMs = Date.now() - PORTFOLIO_NEWS_DAYS_MS;
  const out: LocalAiCompactPortfolioNews[] = [];
  for (const sym of symbols) {
    const rows = listRecentNewsForSymbol(sym, sinceMs).slice(
      0,
      PORTFOLIO_NEWS_PER_SYMBOL
    );
    for (const row of rows) {
      let sentiment: number | null = row.sentiment;
      let eventType: string | null = row.event_type;
      let macroTags: string[] = [];
      if (row.extracted_json) {
        try {
          const parsed = JSON.parse(row.extracted_json) as Record<string, unknown>;
          if (typeof parsed.sentiment === "number") sentiment = parsed.sentiment;
          if (typeof parsed.event_type === "string") eventType = parsed.event_type;
          if (Array.isArray(parsed.macro_tags)) {
            macroTags = parsed.macro_tags.map(String);
          }
        } catch {
          /* use row columns */
        }
      }
      out.push({
        symbol: row.symbol,
        title: row.title,
        snippet: truncateSnippet(row.snippet ?? ""),
        sentiment,
        eventType,
        macroTags,
        fetchedAt: new Date(row.fetched_at).toISOString(),
      });
    }
  }
  return out;
}

function gatherQuotes(symbols: string[]): LocalAiCompactQuote[] {
  const catalog = loadCustomAssets() as Record<
    string,
    {
      current?: number;
      changePercent?: string;
      priceSource?: string;
      lastPriceCheckAt?: string;
    }
  >;
  return symbols.map((sym) => {
    const key = sym.toUpperCase();
    const hist = getLatestMarketPriceCheck(key);
    if (hist) {
      return {
        symbol: key,
        price: hist.price,
        changePercent: hist.change_percent,
        priceSource: hist.source,
        lastCheckedAt: new Date(hist.checked_at).toISOString(),
      };
    }
    const asset = catalog[key];
    if (asset && Number.isFinite(asset.current)) {
      return {
        symbol: key,
        price: asset.current ?? null,
        changePercent: asset.changePercent ?? null,
        priceSource: asset.priceSource ?? null,
        lastCheckedAt: asset.lastPriceCheckAt ?? null,
      };
    }
    return {
      symbol: key,
      price: null,
      changePercent: null,
      priceSource: null,
      lastCheckedAt: null,
    };
  });
}

async function gatherResearch(
  location: PlatformLocation,
  focusSymbols: string[]
): Promise<{ research: LocalAiCompactResearch[]; evaluatedAt: string | null }> {
  const holdings = listPortfolioHoldings();
  const holdingBySym = new Map(
    holdings.map((h) => [h.symbol.toUpperCase(), h])
  );
  const includeAll =
    location.page === "portfolio" ||
    focusSymbols.some((s) => holdingBySym.has(s));

  if (!includeAll || holdings.length === 0) {
    return { research: [], evaluatedAt: null };
  }

  const ids = holdings.map((h) => h.id);
  const cached = await loadLatestResearchForHoldings(ids);
  const research: LocalAiCompactResearch[] = [];
  let maxEval = 0;

  for (const h of holdings) {
    const r = cached.get(h.id);
    if (!r) continue;
    if (r.evaluated_at > maxEval) maxEval = r.evaluated_at;
    research.push({
      symbol: h.symbol.toUpperCase(),
      regime: r.forecast?.regime ?? null,
      probUp5d: r.forecast?.prob_up_5d ?? null,
      trendScore: r.factors?.trend_score ?? null,
      action: r.action?.action ?? null,
      reason: r.action?.reason ?? null,
      evaluatedAt: new Date(r.evaluated_at).toISOString(),
    });
  }

  return {
    research,
    evaluatedAt: maxEval > 0 ? new Date(maxEval).toISOString() : null,
  };
}

function trimToBudget(ctx: LocalAiDataContext): LocalAiDataContext {
  let json = JSON.stringify(ctx);
  if (json.length <= JSON_CHAR_BUDGET) {
    return { ...ctx, truncated: false };
  }

  const trimmed = { ...ctx, truncated: true };
  while (json.length > JSON_CHAR_BUDGET && trimmed.articles.length > 0) {
    trimmed.articles = trimmed.articles.slice(0, -1);
    trimmed.articleCount = trimmed.articles.length;
    json = JSON.stringify(trimmed);
  }
  while (json.length > JSON_CHAR_BUDGET && trimmed.portfolioNews.length > 0) {
    trimmed.portfolioNews = trimmed.portfolioNews.slice(0, -1);
    json = JSON.stringify(trimmed);
  }
  return trimmed;
}

export async function buildLocalAiDataContext(
  location: PlatformLocation,
  options?: LocalAiContextOptions
): Promise<LocalAiDataContext> {
  const opts = { ...readLocalAiOptions(), ...options };
  const engine = getEngineSettings();
  const focusSymbols = resolveFocusSymbols(location);

  let articles: LocalAiCompactArticle[] = [];
  let latestSeenAt: number | null = null;
  if (opts.localAiIncludeNews && focusSymbols.length > 0) {
    const gathered = gatherArticles(
      focusSymbols,
      engine.newsArticleRetentionDays,
      opts.localAiMaxArticles
    );
    articles = gathered.articles;
    latestSeenAt = gathered.latestSeenAt;
  }

  const portfolioNews =
    opts.localAiIncludeNews && focusSymbols.length > 0
      ? gatherPortfolioNews(focusSymbols)
      : [];

  const quotes = focusSymbols.length > 0 ? gatherQuotes(focusSymbols) : [];

  let research: LocalAiCompactResearch[] = [];
  let researchEvaluatedAt: string | null = null;
  if (opts.localAiIncludeResearch) {
    const r = await gatherResearch(location, focusSymbols);
    research = r.research;
    researchEvaluatedAt = r.evaluatedAt;
  }

  const ctx: LocalAiDataContext = {
    focusSymbols,
    articleCount: articles.length,
    articles,
    portfolioNews,
    quotes,
    research,
    dataFreshness: {
      newsBayLatestSeenAt:
        latestSeenAt != null ? new Date(latestSeenAt).toISOString() : undefined,
      researchEvaluatedAt: researchEvaluatedAt ?? undefined,
    },
    truncated: false,
  };

  return trimToBudget(ctx);
}
