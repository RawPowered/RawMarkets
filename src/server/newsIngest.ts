import type { CachedData } from "./db";
import { insertNewsHistory, type NewsSource } from "./portfolioResearchDb";
import { extractNewsWithOllama, keywordSentimentFallback } from "./ollamaExtract";
import { fetchRssFeed } from "./rssFetch";
import { searchSerpGoogleNews } from "./serpNewsSearch";

export interface RawNewsItem {
  title: string;
  snippet: string;
  url: string | null;
  published_at: string | null;
  source: NewsSource;
}

export async function fetchYahooRssNews(symbol: string): Promise<RawNewsItem[]> {
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`;
  const items = await fetchRssFeed(url, "Yahoo Finance", 8);
  return items.map((item) => ({
    title: item.title,
    snippet: item.snippet,
    url: item.url,
    published_at: item.published_at,
    source: "yahoo_rss" as const,
    imageUrl: item.imageUrl,
  }));
}

export async function fetchSerpNewsForSymbol(
  symbol: string,
  apiKey: string,
  apiCache: Record<string, CachedData>,
  saveCache: () => void
): Promise<RawNewsItem[]> {
  const query = `${symbol} stock news`;
  const cacheKey = `serp_news_${symbol.toLowerCase()}_portfolio`;
  const cached = apiCache[cacheKey];
  const now = Date.now();
  const TTL = 60 * 60 * 1000;

  if (cached && now - cached.timestamp < TTL) {
    return cached.data as RawNewsItem[];
  }

  try {
    const serpItems = await searchSerpGoogleNews(query, apiKey, { limit: 8 });
    const items: RawNewsItem[] = serpItems.map((n) => ({
      title: n.title,
      snippet: n.snippet,
      url: n.url,
      published_at: n.published_at,
      source: "serpapi" as const,
    }));

    apiCache[cacheKey] = { timestamp: now, data: items };
    saveCache();
    return items;
  } catch {
    return [];
  }
}

export async function ingestNewsForSymbols(
  symbols: string[],
  options: {
    getApiKey: (id: string) => string | undefined;
    apiCache: Record<string, CachedData>;
    saveCache: () => void;
    ollamaEnabled: boolean;
    ollamaModel?: string;
    /** SerpApi is manual-only in UI; automated ingest uses RSS unless explicitly allowed */
    allowSerp?: boolean;
  }
): Promise<Record<string, Array<{ sentiment: number; confidence: number; novelty: number }>>> {
  const serpKey = options.allowSerp ? options.getApiKey("serpapi") : undefined;
  const fetchedAt = Date.now();
  const newsBySymbol: Record<
    string,
    Array<{ sentiment: number; confidence: number; novelty: number }>
  > = {};

  await Promise.all(
    symbols.map(async (symbol) => {
      const sym = symbol.toUpperCase();
      let items: RawNewsItem[] = [];

      if (serpKey?.trim()) {
        items = await fetchSerpNewsForSymbol(
          sym,
          serpKey,
          options.apiCache,
          options.saveCache
        );
      }
      if (items.length === 0) {
        items = await fetchYahooRssNews(sym);
      }

      newsBySymbol[sym] = [];

      for (const item of items) {
        const rawText = `${item.title} ${item.snippet}`.trim();
        let sentiment = 0.05;
        let confidence = 0.3;
        let novelty = 0.5;
        let timeHorizon = "days";
        let macroTags: string[] = [];
        let eventType = "general";
        let extractedJson: string | null = null;

        if (options.ollamaEnabled) {
          const { extracted, engine } = await extractNewsWithOllama(
            item.title,
            item.snippet,
            sym,
            { model: options.ollamaModel }
          );
          sentiment = extracted.sentiment;
          confidence = extracted.confidence;
          novelty = extracted.novelty;
          timeHorizon = extracted.time_horizon;
          macroTags = extracted.macro_tags;
          eventType = extracted.event_type;
          extractedJson = JSON.stringify({ ...extracted, engine });
        } else {
          const fb = keywordSentimentFallback(rawText);
          sentiment = fb.sentiment;
          confidence = fb.confidence;
        }

        insertNewsHistory({
          symbol: sym,
          source: item.source,
          title: item.title,
          snippet: item.snippet,
          url: item.url,
          published_at: item.published_at,
          raw_text: rawText,
          extracted_json: extractedJson,
          sentiment,
          novelty,
          time_horizon: timeHorizon,
          macro_tags: JSON.stringify(macroTags),
          event_type: eventType,
          confidence,
          fetched_at: fetchedAt,
        });

        newsBySymbol[sym].push({ sentiment, confidence, novelty });
      }
    })
  );

  return newsBySymbol;
}
