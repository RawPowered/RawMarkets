/** Shared SerpApi Google News search (News Bay + Local Copilot). */

export interface SerpNewsArticle {
  title: string;
  snippet: string;
  url: string | null;
  source: string;
  published_at: string | null;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { timestamp: number; items: SerpNewsArticle[] }>();

function cacheKeyForQuery(query: string): string {
  return query.toLowerCase().replace(/\s+/g, "_").slice(0, 120);
}

export function clearSerpNewsCache(): void {
  cache.clear();
}

/** Live Google News via SerpApi; returns [] on error or empty results. */
export async function searchSerpGoogleNews(
  query: string,
  apiKey: string,
  options?: { limit?: number; skipCache?: boolean }
): Promise<SerpNewsArticle[]> {
  const q = query.trim();
  const key = apiKey.trim();
  if (!q || !key) return [];

  const limit = Math.max(1, Math.min(12, options?.limit ?? 8));
  const ck = cacheKeyForQuery(q);
  const now = Date.now();

  if (!options?.skipCache) {
    const hit = cache.get(ck);
    if (hit && now - hit.timestamp < CACHE_TTL_MS) {
      return hit.items.slice(0, limit);
    }
  }

  try {
    const url = `https://serpapi.com/search.json?engine=google_news&q=${encodeURIComponent(q)}&api_key=${key}`;
    const resp = await fetch(url);
    const data = (await resp.json()) as {
      news_results?: Array<{
        title?: string;
        snippet?: string;
        description?: string;
        link?: string;
        date?: string;
        published_date?: string;
        source?: { name?: string } | string;
      }>;
    };

    const items: SerpNewsArticle[] = (data.news_results ?? [])
      .slice(0, limit)
      .map((n) => {
        const sourceRaw = n.source;
        const sourceLabel =
          typeof sourceRaw === "object" && sourceRaw?.name
            ? sourceRaw.name
            : typeof sourceRaw === "string"
              ? sourceRaw
              : "Finance Source";
        return {
          title: n.title ?? "",
          snippet: n.snippet ?? n.description ?? "",
          url: n.link ?? null,
          source: sourceLabel,
          published_at: n.date ?? n.published_date ?? null,
        };
      })
      .filter((n) => n.title);

    cache.set(ck, { timestamp: now, items });
    return items;
  } catch {
    return [];
  }
}

/** Query shape used by News Bay /api/news route. */
export function buildSerpMarketNewsQuery(qParam: string): string {
  return qParam.trim()
    ? `${qParam.trim()} market news sentiment`
    : "gold silver cooper commodities collectibles market news sentiment";
}
