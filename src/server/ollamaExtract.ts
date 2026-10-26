import { DEFAULT_OLLAMA_MODEL, resolveOllamaModel } from "./ollamaDefaults";

/** Keyword sentiment fallback (mirrors server.ts /api/news lexicon). */

const BULLISH = [
  "surge", "climb", "gain", "high", "outperform", "bull", "all-time",
  "buying", "acquisition", "grow", "rally", "rise", "positive", "strong",
];
const BEARISH = [
  "drop", "plummet", "fall", "bear", "shrink", "down", "negative", "loss",
  "recession", "cut", "sell", "decrease", "weak", "concern",
];

export interface ExtractedNewsJson {
  symbols: string[];
  sentiment: number;
  novelty: number;
  time_horizon: "intraday" | "days" | "weeks" | "months";
  macro_tags: string[];
  event_type: string;
  confidence: number;
}

export function keywordSentimentFallback(text: string): {
  sentiment: number;
  confidence: number;
} {
  const lower = text.toLowerCase();
  let bullishHits = 0;
  let bearishHits = 0;
  for (const k of BULLISH) if (lower.includes(k)) bullishHits++;
  for (const k of BEARISH) if (lower.includes(k)) bearishHits++;

  if (bullishHits > bearishHits) {
    return {
      sentiment: Math.min(0.95, 0.2 + (bullishHits - bearishHits) * 0.12),
      confidence: 0.3,
    };
  }
  if (bearishHits > bullishHits) {
    return {
      sentiment: Math.max(-0.95, -0.2 - (bearishHits - bullishHits) * 0.12),
      confidence: 0.3,
    };
  }
  return { sentiment: 0.05, confidence: 0.3 };
}

export function validateExtractedJson(
  raw: unknown,
  fallbackSymbol: string
): ExtractedNewsJson | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const sentiment = Number(o.sentiment);
  const novelty = Number(o.novelty ?? 0.5);
  const confidence = Number(o.confidence ?? 0.5);
  if (!Number.isFinite(sentiment)) return null;

  const symbols = Array.isArray(o.symbols)
    ? o.symbols.map(String).map((s) => s.toUpperCase())
    : [fallbackSymbol];

  const horizon = String(o.time_horizon ?? "days");
  const validHorizon = ["intraday", "days", "weeks", "months"].includes(horizon)
    ? (horizon as ExtractedNewsJson["time_horizon"])
    : "days";

  return {
    symbols,
    sentiment: Math.max(-1, Math.min(1, sentiment)),
    novelty: Math.max(0, Math.min(1, novelty)),
    time_horizon: validHorizon,
    macro_tags: Array.isArray(o.macro_tags) ? o.macro_tags.map(String) : [],
    event_type: String(o.event_type ?? "general"),
    confidence: Math.max(0, Math.min(1, confidence)),
  };
}

export interface OllamaExtractOptions {
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

const DEFAULT_BASE = "http://127.0.0.1:11434";

export async function checkOllamaReady(
  model = DEFAULT_OLLAMA_MODEL,
  baseUrl = DEFAULT_BASE
): Promise<{ ok: boolean; modelReady: boolean }> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    const r = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(t);
    if (!r.ok) return { ok: false, modelReady: false };
    const data = (await r.json()) as { models?: { name: string }[] };
    const names = (data.models ?? []).map((m) => m.name.split(":")[0]);
    const modelReady = (data.models ?? []).some(
      (m) => m.name === model || m.name.startsWith(`${model.split(":")[0]}:`)
    );
    void names;
    return { ok: true, modelReady };
  } catch {
    return { ok: false, modelReady: false };
  }
}

export async function extractNewsWithOllama(
  title: string,
  snippet: string,
  symbol: string,
  options?: OllamaExtractOptions
): Promise<{ extracted: ExtractedNewsJson; engine: "ollama" | "keyword_fallback" }> {
  const model = options?.model ?? resolveOllamaModel();
  const baseUrl = options?.baseUrl ?? DEFAULT_BASE;
  const text = `${title} ${snippet}`.trim();

  try {
    const controller = new AbortController();
    const timeout = options?.timeoutMs ?? 30_000;
    const t = setTimeout(() => controller.abort(), timeout);

    const prompt = `Extract structured fields from this financial news. Output ONLY valid JSON:
{"symbols":["${symbol}"],"sentiment":0.0,"novelty":0.5,"time_horizon":"days","macro_tags":[],"event_type":"general","confidence":0.7}
Rules: sentiment -1..1, novelty 0..1, confidence 0..1, time_horizon one of intraday|days|weeks|months, symbols uppercase tickers mentioned.

News: ${text}`;

    const resp = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: "json",
        options: { temperature: 0 },
      }),
    });
    clearTimeout(t);

    if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);

    const data = (await resp.json()) as { response?: string };
    const parsed = JSON.parse(data.response ?? "{}") as unknown;
    const validated = validateExtractedJson(parsed, symbol);
    if (validated) {
      return { extracted: validated, engine: "ollama" };
    }
  } catch {
    /* fallback below */
  }

  const fb = keywordSentimentFallback(text);
  return {
    extracted: {
      symbols: [symbol.toUpperCase()],
      sentiment: fb.sentiment,
      novelty: 0.5,
      time_horizon: "days",
      macro_tags: [],
      event_type: "general",
      confidence: fb.confidence,
    },
    engine: "keyword_fallback",
  };
}
