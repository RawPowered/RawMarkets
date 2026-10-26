import {
  getApiKey,
  getEngineSettings,
  loadCustomAssets,
  type EngineSettings,
} from "./db";
import { resolveFocusSymbols } from "./localAiContext";
import {
  extractNewsQueryTerms,
  resolveSymbolsFromUserText,
} from "./localAiNewsResolve";
import { extractWebResearchQuery } from "./localAiWebIntent";
import {
  listNewsArticlesByTextSearch,
  listRecentNewsBySymbols,
  type StoredNewsArticleRow,
} from "./newsArticleStore";
import { searchSerpGoogleNews } from "./serpNewsSearch";
import { fetchReadablePage } from "./scrapers/fetchReadablePage";
import type { PlatformLocation } from "../types";

export const LOCAL_AI_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "search_platform_news",
      description:
        "Search headlines already stored in RawMarkets (RSS/News Bay SQLite). Use before guessing about news.",
      parameters: {
        type: "object",
        properties: {
          symbols: {
            type: "array",
            items: { type: "string" },
            description: "Ticker symbols, e.g. GOLD, AAPL. Defaults to user focus symbols.",
          },
          query: {
            type: "string",
            description: "Optional keyword filter on title/snippet.",
          },
          limit: {
            type: "number",
            description: "Max articles to return (default 12, max 25).",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_web_news",
      description:
        "Live Google News via SerpApi (only when enabled in Engine Settings and API key present).",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query, e.g. Hasbro stock news.",
          },
          limit: {
            type: "number",
            description: "Max results (default 8, max 12).",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "web_research",
      description:
        "Orchestrated web research: platform SQLite news, optional SerpApi, then headless Playwright page reads on top URLs.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Topic, company, or ticker to research.",
          },
          fetchPages: {
            type: "number",
            description: "How many article pages to fetch (0-2, default 2).",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "fetch_page_text",
      description:
        "Read a public https URL with the server headless Playwright Chromium browser. Use for URLs from news search or the user.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "https URL to read." },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "open_reader_tab",
      description:
        "Open a URL in the Electron in-app Reader drawer (user-visible webview; not used for scraping).",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "https URL to open." },
          title: { type: "string", description: "Short tab title." },
        },
        required: ["url"],
      },
    },
  },
];

export interface ToolBudget {
  fetchPage: number;
  openTab: number;
}

export function freshToolBudget(): ToolBudget {
  return { fetchPage: 0, openTab: 0 };
}

const MAX_FETCH_PAGE = 3;
const MAX_OPEN_TAB = 2;

export function isUrlAllowed(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    host.startsWith("172.16.") ||
    host.startsWith("172.17.") ||
    host.startsWith("172.18.") ||
    host.startsWith("172.19.") ||
    host.startsWith("172.2") ||
    host.startsWith("172.30.") ||
    host.startsWith("172.31.") ||
    host === "[::1]"
  ) {
    return false;
  }
  return true;
}

function parseToolArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export interface ToolExecutionResult {
  content: string;
  openTab?: { url: string; title: string };
}

export interface LocalAiToolContext {
  lastUserMessage?: string;
}

export async function executeLocalAiTool(
  name: string,
  argsJson: string,
  context: PlatformLocation,
  budget: ToolBudget,
  toolCtx?: LocalAiToolContext
): Promise<ToolExecutionResult> {
  const args = parseToolArgs(argsJson);
  const settings = getEngineSettings();

  if (name === "search_platform_news") {
    const symArg = Array.isArray(args.symbols)
      ? args.symbols.map((s) => String(s).trim().toUpperCase()).filter(Boolean)
      : [];
    const lastUser = toolCtx?.lastUserMessage?.trim() ?? "";
    const fromMessage = lastUser
      ? resolveSymbolsFromUserText(lastUser)
      : [];
    const symbols = [
      ...new Set([
        ...symArg,
        ...fromMessage,
        ...resolveFocusSymbols(context),
      ]),
    ];
    let query = String(args.query ?? "")
      .trim()
      .toLowerCase();
    if (!query && lastUser) {
      const extracted = extractNewsQueryTerms(lastUser).toLowerCase();
      if (extracted) query = extracted;
    }
    const limit = Math.max(
      1,
      Math.min(25, Math.round(Number(args.limit) || 12))
    );

    const retentionDays = settings.newsArticleRetentionDays;
    let rows: StoredNewsArticleRow[] = [];

    if (symbols.length > 0) {
      rows = listRecentNewsBySymbols({
        symbols,
        retentionDays,
        globalLimit: limit * 4,
      });
    }

    if (query) {
      const textHits = listNewsArticlesByTextSearch({
        query,
        retentionDays,
        limit: limit * 2,
      });
      const seen = new Set(rows.map((r) => `${r.url ?? r.title}|${r.symbol}`));
      for (const row of textHits) {
        const key = `${row.url ?? row.title}|${row.symbol}`;
        if (!seen.has(key)) {
          seen.add(key);
          rows.push(row);
        }
      }
      rows = rows.filter(
        (r) =>
          r.title.toLowerCase().includes(query) ||
          r.snippet.toLowerCase().includes(query) ||
          r.symbol.toLowerCase().includes(query)
      );
    }

    if (rows.length === 0 && symbols.length === 0 && !query) {
      return {
        content: JSON.stringify({
          ok: false,
          message:
            "No symbols or keywords to search. Name a ticker or company (e.g. HAS, Hasbro).",
          articles: [],
          catalogSize: Object.keys(
            loadCustomAssets() as Record<string, unknown>
          ).length,
        }),
      };
    }

    const articles = rows.slice(0, limit).map((r) => ({
      symbol: r.symbol,
      title: r.title,
      snippet: r.snippet,
      url: r.url,
      source: r.sourceLabel,
      feedId: r.feedId,
      published_at: r.published_at,
    }));

    return {
      content: JSON.stringify({
        ok: true,
        count: articles.length,
        symbols,
        articles,
      }),
    };
  }

  if (name === "search_web_news") {
    if (!settings.aiLocalSerpEnabled) {
      return {
        content: JSON.stringify({
          ok: false,
          message:
            "SerpApi for Copilot is disabled. Enable it under Engine Settings → Local Copilot research tools.",
          articles: [],
        }),
      };
    }
    const apiKey = getApiKey("serpapi");
    if (!apiKey?.trim()) {
      return {
        content: JSON.stringify({
          ok: false,
          message: "No SerpApi API key configured. Add one under Config → API Keys.",
          articles: [],
        }),
      };
    }
    const lastUser = toolCtx?.lastUserMessage?.trim() ?? "";
    let query = String(args.query ?? "").trim();
    if (!query && lastUser) {
      query = extractWebResearchQuery(lastUser);
    }
    if (!query) {
      return {
        content: JSON.stringify({
          ok: false,
          message: "Provide a search query.",
          articles: [],
        }),
      };
    }
    const serpQuery = /\bnews\b/i.test(query)
      ? query
      : `${query} market news`;
    const limit = Math.max(1, Math.min(12, Math.round(Number(args.limit) || 8)));
    const items = await searchSerpGoogleNews(serpQuery, apiKey, { limit });
    const articles = items.map((n) => ({
      title: n.title,
      snippet: n.snippet,
      url: n.url,
      source: n.source,
      published_at: n.published_at,
    }));
    return {
      content: JSON.stringify({
        ok: true,
        count: articles.length,
        query: serpQuery,
        source: "serpapi",
        articles,
      }),
    };
  }

  if (name === "web_research") {
    const lastUser = toolCtx?.lastUserMessage?.trim() ?? "";
    let query = String(args.query ?? "").trim();
    if (!query && lastUser) {
      query = extractWebResearchQuery(lastUser);
    }
    if (!query) {
      return {
        content: JSON.stringify({
          ok: false,
          message: "Provide a research query (company, ticker, or topic).",
        }),
      };
    }
    const fetchPages = Math.max(
      0,
      Math.min(2, Math.round(Number(args.fetchPages) ?? 2))
    );

    const platformResult = await executeLocalAiTool(
      "search_platform_news",
      JSON.stringify({
        query: query.toLowerCase(),
        limit: 15,
      }),
      context,
      budget,
      toolCtx
    );
    let serpResult: ToolExecutionResult | null = null;
    if (settings.aiLocalSerpEnabled && getApiKey("serpapi")?.trim()) {
      serpResult = await executeLocalAiTool(
        "search_web_news",
        JSON.stringify({ query, limit: 8 }),
        context,
        budget,
        toolCtx
      );
    }

    const urls: string[] = [];
    const collectUrls = (raw: string) => {
      try {
        const parsed = JSON.parse(raw) as {
          articles?: Array<{ url?: string | null }>;
        };
        for (const a of parsed.articles ?? []) {
          const u = a.url?.trim();
          if (u && isUrlAllowed(u) && !urls.includes(u)) urls.push(u);
        }
      } catch {
        /* ignore */
      }
    };
    collectUrls(platformResult.content);
    if (serpResult) collectUrls(serpResult.content);

    const pageFetches: unknown[] = [];
    if (settings.usePlaywrightScrapers && fetchPages > 0) {
      for (const url of urls.slice(0, fetchPages)) {
        if (budget.fetchPage >= MAX_FETCH_PAGE) break;
        const pageExec = await executeLocalAiTool(
          "fetch_page_text",
          JSON.stringify({ url }),
          context,
          budget,
          toolCtx
        );
        try {
          pageFetches.push(JSON.parse(pageExec.content));
        } catch {
          pageFetches.push({ ok: false, url });
        }
      }
    }

    let platformParsed: unknown = null;
    let serpParsed: unknown = null;
    try {
      platformParsed = JSON.parse(platformResult.content);
    } catch {
      platformParsed = platformResult.content;
    }
    if (serpResult) {
      try {
        serpParsed = JSON.parse(serpResult.content);
      } catch {
        serpParsed = serpResult.content;
      }
    }

    return {
      content: JSON.stringify({
        ok: true,
        query,
        platformNews: platformParsed,
        webNews: serpParsed,
        serpSkipped:
          !settings.aiLocalSerpEnabled || !getApiKey("serpapi")?.trim(),
        pagesFetched: pageFetches.length,
        pageTexts: pageFetches,
        playwrightEnabled: settings.usePlaywrightScrapers,
      }),
    };
  }

  if (name === "fetch_page_text") {
    if (!settings.usePlaywrightScrapers) {
      return {
        content: JSON.stringify({
          ok: false,
          message:
            "Playwright scrapers are disabled. Enable them under Engine Settings → Playwright scrapers.",
        }),
      };
    }
    if (budget.fetchPage >= MAX_FETCH_PAGE) {
      return {
        content: JSON.stringify({
          ok: false,
          message: "fetch_page_text limit reached for this turn.",
        }),
      };
    }
    budget.fetchPage += 1;
    const url = String(args.url ?? "").trim();
    if (!isUrlAllowed(url)) {
      return {
        content: JSON.stringify({
          ok: false,
          message: "URL not allowed. Use https public URLs only.",
        }),
      };
    }
    try {
      const page = await fetchReadablePage(url);
      return {
        content: JSON.stringify({ ok: true, ...page }),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: JSON.stringify({ ok: false, message }),
      };
    }
  }

  if (name === "open_reader_tab") {
    if (budget.openTab >= MAX_OPEN_TAB) {
      return {
        content: JSON.stringify({
          ok: false,
          message: "open_reader_tab limit reached for this turn.",
        }),
      };
    }
    budget.openTab += 1;
    const url = String(args.url ?? "").trim();
    if (!isUrlAllowed(url)) {
      return {
        content: JSON.stringify({
          ok: false,
          message: "URL not allowed for Reader tab.",
        }),
      };
    }
    const title = String(args.title ?? "").trim() || "Article";
    return {
      content: JSON.stringify({ ok: true, url, title }),
      openTab: { url, title },
    };
  }

  return {
    content: JSON.stringify({ ok: false, message: `Unknown tool: ${name}` }),
  };
}

export function buildResearchCapabilitiesPrompt(settings: EngineSettings): string {
  const serpKey = !!getApiKey("serpapi")?.trim();
  const serpLine =
    settings.aiLocalSerpEnabled && serpKey
      ? "- Live web headlines: search_web_news (SerpApi Google News) is ON."
      : settings.aiLocalSerpEnabled && !serpKey
        ? "- SerpApi toggle is on but no API key — search_web_news will not run."
        : "- Live web headlines: SerpApi is OFF (enable in Engine Settings if desired).";
  const pwLine = settings.usePlaywrightScrapers
    ? "- Headless Chromium (Playwright): fetch_page_text and web_research can read article pages."
    : "- Playwright scrapers are OFF — page fetch tools are disabled until enabled in Engine Settings.";

  return `Research environment (tools ENABLED):
- NEVER tell the user to open an external web browser manually.
- Platform headlines (SQLite / News Bay): search_platform_news.
${serpLine}
${pwLine}
- web_research runs platform news + optional Serp + up to 2 page fetches in one step.
- open_reader_tab opens the Electron Reader drawer for the user (not for scraping).
- platformData is baseline context; tool results may extend it with live research.`;
}

export function buildToolUseInstructions(settings?: EngineSettings): string {
  const s = settings ?? getEngineSettings();
  const serpHint =
    s.aiLocalSerpEnabled && getApiKey("serpapi")?.trim()
      ? "search_web_news is available."
      : "search_web_news is unavailable (toggle or API key missing).";

  return `Research tools (ENABLED — you MUST use them for news and web research):
- NEVER tell the user to open a web browser or visit external sites manually.
- For news/headlines: search_platform_news or web_research (or use preflight results below).
- For "use the web" / online research: web_research first; then fetch_page_text if you need more detail.
- ${serpHint}
- Use open_reader_tab to show sources in the in-app Reader when helpful.
- Answer from tool results and platformData; cite titles and URLs when present.`;
}
