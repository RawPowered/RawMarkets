export type NewsFeedFilterMode = "url" | "text";
export type NewsFeedTier = "free" | "serpapi";
export type NewsSourceClass =
  | "primary"
  | "newswire"
  | "market"
  | "aggregator"
  | "crowd";
export type NewsFeedLane = "company" | "macro" | "context" | "crowd";

export const SOURCE_CLASS_WEIGHT: Record<NewsSourceClass, number> = {
  primary: 1.0,
  newswire: 0.85,
  market: 0.6,
  aggregator: 0.45,
  crowd: 0.25,
};

export const SOURCE_CLASS_LABELS: Record<NewsSourceClass, string> = {
  primary: "Primary",
  newswire: "Newswire",
  market: "Market News",
  aggregator: "Search / Aggregator",
  crowd: "Crowd",
};

export interface NewsFeedDefinition {
  id: string;
  label: string;
  domain: string;
  urlTemplate?: string;
  url?: string;
  requiresSymbol: boolean;
  filterMode: NewsFeedFilterMode;
  enabledDefault: boolean;
  tier: NewsFeedTier;
  maxItems: number;
  sourceClass: NewsSourceClass;
  lane: NewsFeedLane;
  sourceWeight: number;
  eventTypes?: string[];
  secFormType?: string;
  /** Dynamic URL (company IR) — resolved at fetch time */
  dynamicUrl?: boolean;
  /** Uses Stocktwits/Reddit fetchers instead of RSS */
  crowdProvider?: "stocktwits" | "reddit";
}

function secFeed(
  slug: string,
  label: string,
  form: string,
  enabledDefault: boolean
): NewsFeedDefinition {
  return {
    id: `sec_${slug}`,
    label: `SEC ${label}`,
    domain: "sec.gov",
    urlTemplate:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type={form}&owner=include&count=20&output=atom",
    requiresSymbol: true,
    filterMode: "url",
    enabledDefault,
    tier: "free",
    maxItems: 15,
    sourceClass: "primary",
    lane: "company",
    sourceWeight: SOURCE_CLASS_WEIGHT.primary,
    eventTypes: [form],
    secFormType: form,
  };
}

export const NEWS_FEED_SOURCES: NewsFeedDefinition[] = [
  secFeed("8k", "8-K", "8-K", true),
  secFeed("10q", "10-Q", "10-Q", true),
  secFeed("10k", "10-K", "10-K", true),
  secFeed("form4", "Form 4", "4", true),
  secFeed("s1", "S-1", "S-1", false),
  secFeed("13d", "13D", "SC 13D", false),
  secFeed("13g", "13G", "SC 13G", false),
  {
    id: "company_ir",
    label: "Company IR",
    domain: "investors",
    requiresSymbol: true,
    filterMode: "url",
    enabledDefault: true,
    tier: "free",
    maxItems: 12,
    sourceClass: "primary",
    lane: "company",
    sourceWeight: SOURCE_CLASS_WEIGHT.primary,
    dynamicUrl: true,
  },
  {
    id: "globenewswire",
    label: "GlobeNewswire",
    domain: "globenewswire.com",
    urlTemplate:
      "https://www.globenewswire.com/RssFeed/search?q={symbol}&pageSize=15",
    requiresSymbol: true,
    filterMode: "url",
    enabledDefault: true,
    tier: "free",
    maxItems: 12,
    sourceClass: "newswire",
    lane: "company",
    sourceWeight: SOURCE_CLASS_WEIGHT.newswire,
  },
  {
    id: "prnewswire",
    label: "PR Newswire",
    domain: "prnewswire.com",
    urlTemplate:
      "https://www.prnewswire.com/rss/news-releases-list.rss?keyword={symbol}",
    requiresSymbol: true,
    filterMode: "text",
    enabledDefault: true,
    tier: "free",
    maxItems: 12,
    sourceClass: "newswire",
    lane: "company",
    sourceWeight: SOURCE_CLASS_WEIGHT.newswire,
  },
  {
    id: "businesswire",
    label: "Business Wire",
    domain: "businesswire.com",
    urlTemplate:
      "https://feed.businesswire.com/rss/home/?keyword={symbol}&rss=G1QFDERJXkJeGVtY=",
    requiresSymbol: true,
    filterMode: "text",
    enabledDefault: false,
    tier: "free",
    maxItems: 10,
    sourceClass: "newswire",
    lane: "company",
    sourceWeight: SOURCE_CLASS_WEIGHT.newswire,
  },
  {
    id: "yahoo",
    label: "Yahoo Finance",
    domain: "finance.yahoo.com",
    urlTemplate:
      "https://feeds.finance.yahoo.com/rss/2.0/headline?s={symbol}&region=US&lang=en-US",
    requiresSymbol: true,
    filterMode: "url",
    enabledDefault: true,
    tier: "free",
    maxItems: 10,
    sourceClass: "aggregator",
    lane: "company",
    sourceWeight: SOURCE_CLASS_WEIGHT.aggregator,
  },
  {
    id: "google_news",
    label: "Google News",
    domain: "news.google.com",
    urlTemplate:
      "https://news.google.com/rss/search?q={symbol}+stock&hl=en-US&gl=US&ceid=US:en",
    requiresSymbol: true,
    filterMode: "url",
    enabledDefault: true,
    tier: "free",
    maxItems: 10,
    sourceClass: "aggregator",
    lane: "company",
    sourceWeight: SOURCE_CLASS_WEIGHT.aggregator,
  },
  {
    id: "reuters_markets",
    label: "Reuters Markets",
    domain: "reuters.com",
    url: "https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best",
    requiresSymbol: false,
    filterMode: "text",
    enabledDefault: true,
    tier: "free",
    maxItems: 12,
    sourceClass: "market",
    lane: "company",
    sourceWeight: SOURCE_CLASS_WEIGHT.market,
  },
  {
    id: "fox_business",
    label: "FOX Business",
    domain: "foxbusiness.com",
    url: "https://moxie.foxbusiness.com/google?format=rss",
    requiresSymbol: false,
    filterMode: "text",
    enabledDefault: true,
    tier: "free",
    maxItems: 12,
    sourceClass: "market",
    lane: "company",
    sourceWeight: SOURCE_CLASS_WEIGHT.market,
  },
  {
    id: "cnbc_top",
    label: "CNBC Top News",
    domain: "cnbc.com",
    url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114",
    requiresSymbol: false,
    filterMode: "text",
    enabledDefault: false,
    tier: "free",
    maxItems: 10,
    sourceClass: "market",
    lane: "company",
    sourceWeight: SOURCE_CLASS_WEIGHT.market,
  },
  {
    id: "marketwatch_top",
    label: "MarketWatch",
    domain: "marketwatch.com",
    url: "https://feeds.marketwatch.com/marketwatch/topstories/",
    requiresSymbol: false,
    filterMode: "text",
    enabledDefault: false,
    tier: "free",
    maxItems: 10,
    sourceClass: "market",
    lane: "company",
    sourceWeight: SOURCE_CLASS_WEIGHT.market,
  },
  {
    id: "nasdaq_news",
    label: "Nasdaq News",
    domain: "nasdaq.com",
    url: "https://www.nasdaq.com/feed/rssoutbound?category=Stocks",
    urlTemplate:
      "https://www.nasdaq.com/feed/rssoutbound?symbol={symbol}",
    requiresSymbol: true,
    filterMode: "url",
    enabledDefault: false,
    tier: "free",
    maxItems: 10,
    sourceClass: "market",
    lane: "company",
    sourceWeight: SOURCE_CLASS_WEIGHT.market,
  },
  {
    id: "fed_press",
    label: "Federal Reserve",
    domain: "federalreserve.gov",
    url: "https://www.federalreserve.gov/feeds/press_all.xml",
    requiresSymbol: false,
    filterMode: "url",
    enabledDefault: true,
    tier: "free",
    maxItems: 15,
    sourceClass: "primary",
    lane: "macro",
    sourceWeight: SOURCE_CLASS_WEIGHT.primary,
  },
  {
    id: "bls_latest",
    label: "BLS",
    domain: "bls.gov",
    url: "https://www.bls.gov/feed/bls_latest.rss",
    requiresSymbol: false,
    filterMode: "url",
    enabledDefault: true,
    tier: "free",
    maxItems: 15,
    sourceClass: "primary",
    lane: "macro",
    sourceWeight: SOURCE_CLASS_WEIGHT.primary,
  },
  {
    id: "bea_news",
    label: "BEA",
    domain: "bea.gov",
    url: "https://www.bea.gov/rss.xml",
    requiresSymbol: false,
    filterMode: "url",
    enabledDefault: true,
    tier: "free",
    maxItems: 12,
    sourceClass: "primary",
    lane: "macro",
    sourceWeight: SOURCE_CLASS_WEIGHT.primary,
  },
  {
    id: "census_econ",
    label: "Census Economic",
    domain: "census.gov",
    url: "https://www.census.gov/economic-indicators/indicator.xml",
    requiresSymbol: false,
    filterMode: "url",
    enabledDefault: true,
    tier: "free",
    maxItems: 12,
    sourceClass: "primary",
    lane: "macro",
    sourceWeight: SOURCE_CLASS_WEIGHT.primary,
  },
  {
    id: "eia_today",
    label: "EIA Today in Energy",
    domain: "eia.gov",
    url: "https://www.eia.gov/rss/todayinenergy.xml",
    requiresSymbol: false,
    filterMode: "url",
    enabledDefault: true,
    tier: "free",
    maxItems: 12,
    sourceClass: "primary",
    lane: "context",
    sourceWeight: SOURCE_CLASS_WEIGHT.primary,
  },
  {
    id: "cme_news",
    label: "CME Group",
    domain: "cmegroup.com",
    url: "https://www.cmegroup.com/rss/news.rss",
    requiresSymbol: false,
    filterMode: "url",
    enabledDefault: true,
    tier: "free",
    maxItems: 12,
    sourceClass: "primary",
    lane: "context",
    sourceWeight: SOURCE_CLASS_WEIGHT.primary,
  },
  {
    id: "stocktwits",
    label: "Stocktwits",
    domain: "stocktwits.com",
    requiresSymbol: true,
    filterMode: "url",
    enabledDefault: false,
    tier: "free",
    maxItems: 10,
    sourceClass: "crowd",
    lane: "crowd",
    sourceWeight: SOURCE_CLASS_WEIGHT.crowd,
    crowdProvider: "stocktwits",
  },
  {
    id: "reddit",
    label: "Reddit",
    domain: "reddit.com",
    requiresSymbol: true,
    filterMode: "url",
    enabledDefault: false,
    tier: "free",
    maxItems: 10,
    sourceClass: "crowd",
    lane: "crowd",
    sourceWeight: SOURCE_CLASS_WEIGHT.crowd,
    crowdProvider: "reddit",
  },
];

export function getFeedById(id: string): NewsFeedDefinition | undefined {
  return NEWS_FEED_SOURCES.find((f) => f.id === id);
}

export function resolveFeedUrl(
  feed: NewsFeedDefinition,
  symbol: string,
  extras?: { cik?: string }
): string | null {
  if (feed.id.startsWith("sec_") && feed.secFormType && extras?.cik) {
    const cik = extras.cik.replace(/^0+/, "") || extras.cik;
    return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(cik)}&type=${encodeURIComponent(feed.secFormType)}&owner=include&count=20&output=atom`;
  }
  if (feed.urlTemplate) {
    return feed.urlTemplate
      .replace(/\{symbol\}/gi, encodeURIComponent(symbol))
      .replace(/\{form\}/gi, encodeURIComponent(feed.secFormType ?? ""));
  }
  if (feed.requiresSymbol && feed.urlTemplate === undefined && feed.url) {
    return feed.url;
  }
  return feed.url ?? null;
}

export function parseFeedIdsParam(
  feedsParam: string | undefined,
  options?: {
    enabledOnly?: boolean;
    lane?: NewsFeedLane;
    prefs?: Record<string, boolean>;
  }
): NewsFeedDefinition[] {
  const enabledOnly = options?.enabledOnly ?? true;
  const lane = options?.lane;
  const prefs = options?.prefs ?? {};

  let pool = NEWS_FEED_SOURCES;
  if (lane) pool = pool.filter((f) => f.lane === lane);

  if (enabledOnly) {
    pool = pool.filter((f) => {
      const pref = prefs[f.id];
      return pref !== undefined ? pref : f.enabledDefault;
    });
  }

  if (!feedsParam || feedsParam === "all") return pool;

  const ids = feedsParam.split(",").map((s) => s.trim().toLowerCase());
  const selected = pool.filter((f) => ids.includes(f.id));
  return selected.length > 0 ? selected : pool;
}

export function feedsForLane(lane: NewsFeedLane): NewsFeedDefinition[] {
  return NEWS_FEED_SOURCES.filter((f) => f.lane === lane);
}
