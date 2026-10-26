import {
  checkOllamaReady,
  extractNewsWithOllama,
  keywordSentimentFallback,
} from "./ollamaExtract";

export type UiSentiment = "Bullish" | "Neutral" | "Negative";

export interface ScoredSentiment {
  sentiment: UiSentiment;
  score: number;
  engine: "keyword" | "ollama";
}

export function numericToUiSentiment(sentiment: number): UiSentiment {
  if (sentiment > 0.15) return "Bullish";
  if (sentiment < -0.15) return "Negative";
  return "Neutral";
}

/** Keyword-only scoring (mirrors legacy /api/news). */
export function keywordScoreFromText(text: string): ScoredSentiment {
  const fb = keywordSentimentFallback(text);
  return {
    sentiment: numericToUiSentiment(fb.sentiment),
    score: fb.sentiment,
    engine: "keyword",
  };
}

export interface ScoreHeadlineOptions {
  symbol?: string;
  ollamaEnabled?: boolean;
  ollamaModel?: string;
  useOllama?: boolean;
}

const OLLAMA_CAP_PER_REQUEST = 12;
let ollamaCallsThisRequest = 0;

export function resetOllamaRequestCap(): void {
  ollamaCallsThisRequest = 0;
}

export async function scoreHeadline(
  title: string,
  snippet: string,
  options: ScoreHeadlineOptions
): Promise<ScoredSentiment> {
  const text = `${title} ${snippet}`.trim();
  const sym = options.symbol?.toUpperCase() ?? "";

  const tryOllama =
    !!sym &&
    options.useOllama !== false &&
    options.ollamaEnabled === true &&
    ollamaCallsThisRequest < OLLAMA_CAP_PER_REQUEST;

  if (tryOllama) {
    const ready = await checkOllamaReady(options.ollamaModel);
    if (ready.ok && ready.modelReady) {
      ollamaCallsThisRequest += 1;
      const { extracted, engine } = await extractNewsWithOllama(
        title,
        snippet,
        sym,
        { model: options.ollamaModel }
      );
      if (engine === "ollama") {
        return {
          sentiment: numericToUiSentiment(extracted.sentiment),
          score: extracted.sentiment,
          engine: "ollama",
        };
      }
    }
  }

  return keywordScoreFromText(text);
}

export function scoreSerpApiNewsItem(news: {
  title?: string;
  snippet?: string;
  description?: string;
}): ScoredSentiment {
  const text = `${news.title ?? ""} ${news.snippet ?? news.description ?? ""}`.trim();
  return keywordScoreFromText(text);
}
