export interface HistoryPoint {
  date: string;
  value: number;
}

export type FeedSource = "live" | "unavailable" | "cached" | "scrape";

export interface Asset {
  name: string;
  symbol: string;
  unit: string;
  current: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  change: number;
  changePercent: string;
  history: HistoryPoint[];
  category: "METALS" | "ENERGY" | "TECH" | "MARKETS" | "FINANCE";
  desc: string;
  /** Where the displayed price came from on last refresh */
  priceSource?: FeedSource;
  /** Where the chart history came from on last refresh */
  historySource?: FeedSource;
  /** Shown when price is blank — why no live data */
  feedNote?: string;
  /** ISO timestamp of last successful price check we stored locally */
  lastPriceCheckAt?: string;
  /** Google Finance quote id (e.g. AAPL:NASDAQ) for scrape fallback */
  googleFinanceId?: string;
}

export interface MarketDataResponse {
  success: boolean;
  source: "unavailable" | "alphavantage" | "mixed-fallback" | "scrape";
  message: string;
  items: Record<string, Asset>;
  livePriceCount?: number;
  simulatedPriceCount?: number;
  liveSymbols?: string[];
  simulatedSymbols?: string[];
  fetchedAt?: string;
  forceOfflineFallback?: boolean;
  metalsSource?: string;
  avRateLimited?: boolean;
  metalpriceKeyConfigured?: boolean;
  /** Alpha Vantage free tier (25/day) exhausted — no more AV calls until reset */
  avDailyLimitExhausted?: boolean;
  avQuotaResetsAt?: string | null;
  metalsFromLive?: boolean;
  metalsFeedNote?: string | null;
  /** Server scrape log lines from the last refresh (Kitco/Yahoo). */
  scrapeLog?: string[];
  metalRates?: Record<string, SpecialMetalRate>;
  engine?: {
    usePlaywrightScrapers: boolean;
    useApiFeeds: boolean;
    forceOfflineFallback: boolean;
    skipAutoMarketRefresh?: boolean;
    marketRefreshFreshnessValue?: number;
    marketRefreshFreshnessUnit?: "hours" | "days";
  };
  refreshReason?: string;
  refreshSkipped?: boolean;
  lastMarketFeedAt?: string | null;
}

export interface DataStatusResponse {
  success: boolean;
  keys: {
    alpha_vantage: boolean;
    gemini: boolean;
    serpapi: boolean;
    metalprice: boolean;
  };
  engine: {
    forceOfflineFallback: boolean;
    simulationLatencyMs: number;
  };
  market: MarketFeedStats | null;
  metals: {
    source: string;
    message?: string;
  } | null;
}

export interface MarketFeedStats {
  source: "unavailable" | "alphavantage" | "mixed-fallback" | "scrape";
  message: string;
  alphaVantageKeyConfigured: boolean;
  forceOfflineFallback: boolean;
  livePriceCount: number;
  stalePriceCount?: number;
  simulatedPriceCount: number;
  liveHistoryCount: number;
  liveSymbols: string[];
  staleSymbols?: string[];
  simulatedSymbols: string[];
  fetchedAt: string;
}

export interface AnalysisResponse {
  success: boolean;
  analysis?: string;
  message?: string;
  error?: string;
}

export interface NewsItem {
  title: string;
  snippet: string;
  source: string;
  date: string;
  link: string;
  sentiment: "Bullish" | "Neutral" | "Negative";
  score: number;
  /** Primary ticker for stock logo */
  stockSymbol?: string;
  /** Publisher favicon domain (hostname) */
  sourceDomain?: string;
  /** Featured image from RSS media / SerpApi thumbnail */
  imageUrl?: string | null;
}

export interface NewsResponse {
  success: boolean;
  source: string;
  message?: string;
  items: NewsItem[];
}

export type NewsSourceClass =
  | "primary"
  | "newswire"
  | "market"
  | "aggregator"
  | "crowd";

export type NewsFeedLane = "company" | "macro" | "context" | "crowd";

export interface NewsBayItem extends NewsItem {
  feedId: string;
  matchedSymbols: string[];
  sentimentEngine: "keyword" | "ollama";
  sourceClass?: NewsSourceClass;
  lane?: NewsFeedLane;
  rankScore?: number;
  eventType?: string;
  macroTags?: string[];
}

export interface NewsBayWatchlistEntry {
  symbol: string;
  name?: string;
  from: "catalog" | "portfolio" | "both";
}

export interface NewsBayWatchlistResponse {
  success: boolean;
  symbols: NewsBayWatchlistEntry[];
}

export interface NewsBayResponse {
  success: boolean;
  source: string;
  message?: string;
  items: NewsBayItem[];
  symbol?: string;
  feedCount?: number;
  lane?: NewsFeedLane;
  /** sqlite = read from news_bay_articles; rss = network; mixed = both */
  dataSource?: "sqlite" | "rss" | "mixed";
}

export interface NewsBaySourcesResponse {
  success: boolean;
  lane?: NewsFeedLane;
  sources: Array<{
    id: string;
    label: string;
    domain: string;
    requiresSymbol: boolean;
    filterMode: "url" | "text";
    enabledDefault: boolean;
    enabled?: boolean;
    tier: "free" | "serpapi";
    sourceClass: NewsSourceClass;
    lane: NewsFeedLane;
    secFormType?: string;
    eventTypes?: string[];
  }>;
}

export interface NewsBayPrefsResponse {
  success: boolean;
  prefs: Record<string, boolean>;
}

export interface SpecialMetalRate {
  name: string;
  symbol: string;
  price: number;
  rate: number;
  change: number;
  changePercent: string;
  unit: string;
}

export interface MetalRatesResponse {
  success: boolean;
  source: string;
  message?: string;
  timestamp: number;
  rates: Record<string, SpecialMetalRate>;
  fromLive?: boolean;
  feedNote?: string | null;
}

export type PortfolioEntryMode = "shares" | "dollars";
export type PortfolioBarbellSide = "safe" | "aggressive";
export type PortfolioFragility = "hedged" | "speculative" | "ponzi";
export type PortfolioWealthBucket =
  | "public_equities"
  | "precious_metals"
  | "digital"
  | "energy"
  | "private_vc";

export interface PortfolioSignal {
  code: string;
  severity: "info" | "warn" | "critical";
  title: string;
  action: string;
  detail: string;
  holdingId?: number;
}

export interface PortfolioHolding {
  id: number;
  symbol: string;
  entry_date: string;
  entry_mode: PortfolioEntryMode;
  shares: number;
  entry_price: number;
  dollars_invested: number | null;
  barbell_side: PortfolioBarbellSide;
  wealth_bucket: PortfolioWealthBucket;
  fragility: PortfolioFragility;
  target_pct: number | null;
  take_profit_pct: number | null;
  stop_loss_pct: number | null;
  kelly_p: number | null;
  kelly_b: number | null;
  archived_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface PortfolioEnrichedHolding extends PortfolioHolding {
  company_name?: string;
  current_price: number | null;
  day_change_pct: number | null;
  price_source: string;
  feed_note?: string;
  market_value: number;
  cost_basis: number;
  pnl_usd: number;
  pnl_pct: number | null;
  history_7d: HistoryPoint[];
  history_30d: HistoryPoint[];
  signals: PortfolioSignal[];
  research?: PortfolioHoldingResearch | null;
}

export interface PortfolioSettings {
  id: number;
  safe_target_pct: number;
  aggressive_target_pct: number;
  rebalance_drift_pct: number;
  last_rebalance_date: string | null;
  cash_buffer_usd: number;
  research_enabled?: number;
  research_min_history_days?: number;
  ollama_news_enabled?: number;
  last_research_at?: number | null;
  updated_at: number;
}

export interface PortfolioFactorSnapshot {
  return_5d: number | null;
  return_20d: number | null;
  vol_20d: number | null;
  drawdown_30d: number | null;
  drawdown_60d: number | null;
  trend_score: number | null;
  mean_reversion_score: number | null;
  concentration_pct: number | null;
  corr_to_portfolio: number | null;
  corr_to_benchmark: number | null;
  data_points: number;
}

export interface PortfolioForecastSnapshot {
  prob_up_5d: number;
  prob_up_20d: number;
  expected_return_low_5d: number | null;
  expected_return_high_5d: number | null;
  downside_risk_low_5d: number | null;
  downside_risk_high_5d: number | null;
  regime: "risk_on" | "risk_off" | "range" | "stress";
}

export interface PortfolioResearchAction {
  action: "add" | "hold" | "trim" | "reduce" | "no_add";
  severity: "info" | "warn" | "critical";
  reason_code: string;
  reason: string;
  precedence: number;
}

export interface PortfolioHoldingResearch {
  evaluated_at: number;
  engine: "python" | "typescript_fallback";
  factors: PortfolioFactorSnapshot | null;
  forecast: PortfolioForecastSnapshot | null;
  action: PortfolioResearchAction | null;
}

export interface PortfolioResearchMeta {
  status?: "idle" | "running" | "ready" | "error";
  engine: "python" | "typescript_fallback" | null;
  python: boolean;
  ollama: boolean;
  startedAt?: number | null;
  evaluatedAt?: number | null;
  error?: string | null;
}

export interface PortfolioAggregates {
  totalValue: number;
  totalCost: number;
  dayPnlUsd: number;
  safePct: number;
  aggressivePct: number;
  ponziPct: number;
}

export interface PortfolioTransaction {
  id: number;
  symbol: string;
  tx_date: string;
  tx_type: "buy" | "sell";
  shares: number;
  price: number;
  amount_usd: number;
  source?: string;
  source_line?: number | null;
}

export interface PortfolioResponse {
  success: boolean;
  settings: PortfolioSettings;
  aggregates: PortfolioAggregates;
  signals: PortfolioSignal[];
  holdings: PortfolioEnrichedHolding[];
  refreshed_at: string;
  message?: string;
  research?: PortfolioResearchMeta;
}

export type JournalEntryType =
  | "news_clip"
  | "manual"
  | "social_x"
  | "article";

export interface JournalSnapshotMedia {
  type: "image" | "video";
  url: string;
}

export interface JournalSnapshot {
  platform?: "x" | "web" | "news";
  author?: string | null;
  text?: string | null;
  title?: string | null;
  tweetId?: string | null;
  embedHtml?: string | null;
  imageUrl?: string | null;
  media?: JournalSnapshotMedia[];
  sentiment?: string;
  score?: number;
  linkedAssetKey?: string | null;
}

export interface JournalMediaItem {
  type: "image" | "video";
  remoteUrl: string;
  localPath?: string | null;
  sizeBytes?: number | null;
  downloadedAt?: number | null;
  downloadError?: string | null;
}

export interface JournalEntry {
  id: number;
  url: string;
  title: string;
  snippet: string | null;
  source: string | null;
  entry_type: JournalEntryType;
  snapshot: JournalSnapshot | null;
  media: JournalMediaItem[];
  tags: string | null;
  notes: string | null;
  linked_asset_key: string | null;
  sentiment: "Bullish" | "Neutral" | "Negative" | string | null;
  score: number | null;
  created_at: number;
  updated_at: number;
  last_unfurled_at: number | null;
}

export interface JournalEntriesResponse {
  success: boolean;
  entries: JournalEntry[];
  message?: string;
}

export interface JournalEntryResponse {
  success: boolean;
  entry: JournalEntry;
  duplicate?: boolean;
  message?: string;
}

export interface JournalUnfurlResponse {
  success: boolean;
  entry_type: JournalEntryType;
  title: string;
  snippet: string | null;
  source: string | null;
  snapshot: JournalSnapshot;
  media: JournalMediaItem[];
  message?: string;
}

export type SymbolSearchSource =
  | "yahoo"
  | "google_finance"
  | "coinbase"
  | "alpha_vantage"
  | "local";

export interface SymbolSearchHit {
  symbol: string;
  name: string;
  market: string;
  type: string;
  currency: string;
  defaultPrice: number;
  category: Asset["category"];
  desc?: string;
  source: SymbolSearchSource;
  exchange?: string;
  googleFinanceId?: string;
  yahooSymbol?: string;
  inCatalog?: boolean;
}

export interface SymbolSearchResponse {
  success: boolean;
  matches: SymbolSearchHit[];
  sources?: SymbolSearchSource[];
  cached?: boolean;
  note?: string;
  message?: string;
}

export type DashboardSkin =
  | "classic"
  | "compact"
  | "terminal"
  | "minimal"
  | "branded";
export type DashboardSortMode =
  | "manual"
  | "gainers"
  | "losers"
  | "name"
  | "price_desc"
  | "price_asc";

export interface DashboardGroupV1 {
  id: string;
  name: string;
  color: string;
  collapsed?: boolean;
  symbols: string[];
}

export interface DashboardLayoutV1 {
  version: 1;
  skin: DashboardSkin;
  sortMode: DashboardSortMode;
  groups: DashboardGroupV1[];
  symbolAccents: Record<string, string>;
}

/** Snapshot of where the user is in RawMarkets (sent with local AI chat). */
export interface PlatformLocation {
  page: string;
  pageLabel: string;
  selectedSymbol?: string;
  selectedAsset?: {
    symbol: string;
    name: string;
    price: number;
    changePercent: string;
    priceSource?: string;
  };
  activeCategory?: string;
  searchQuery?: string;
  pinnedSymbols?: string[];
  newsBaySymbol?: string;
  newsBayLane?: string;
  capturedAt: string;
}

export interface LocalAiCompactArticle {
  symbol: string;
  feedId: string;
  sourceLabel: string;
  title: string;
  snippet: string;
  publishedAt: string | null;
  url: string | null;
}

export interface LocalAiCompactPortfolioNews {
  symbol: string;
  title: string;
  snippet: string;
  sentiment: number | null;
  eventType: string | null;
  macroTags: string[];
  fetchedAt: string;
}

export interface LocalAiCompactQuote {
  symbol: string;
  price: number | null;
  changePercent: string | null;
  priceSource: string | null;
  lastCheckedAt: string | null;
}

export interface LocalAiCompactResearch {
  symbol: string;
  regime: string | null;
  probUp5d: number | null;
  trendScore: number | null;
  action: string | null;
  reason: string | null;
  evaluatedAt: string;
}

export interface LocalAiDataContext {
  focusSymbols: string[];
  articleCount: number;
  articles: LocalAiCompactArticle[];
  portfolioNews: LocalAiCompactPortfolioNews[];
  quotes: LocalAiCompactQuote[];
  research: LocalAiCompactResearch[];
  dataFreshness: {
    newsBayLatestSeenAt?: string;
    researchEvaluatedAt?: string;
  };
  truncated: boolean;
}

export interface LocalAiChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LocalAiStatusResponse {
  ready: boolean;
  model: string;
  modelReady: boolean;
  message?: string;
  wealthBibleEnabled?: boolean;
  wealthBibleRuleCount?: number;
  aiLocalToolsEnabled?: boolean;
  aiLocalSerpEnabled?: boolean;
  hasSerpApiKey?: boolean;
  playwrightEnabled?: boolean;
}

export interface LocalAiChatStreamEvent {
  delta?: string;
  toolStatus?: { name: string; state: "running" | "done" };
  openTab?: { url: string; title: string };
  done?: boolean;
  error?: string;
}
