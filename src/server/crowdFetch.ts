export interface CrowdItem {
  title: string;
  snippet: string;
  url: string | null;
  published_at: string | null;
  sourceLabel: string;
  imageUrl: string | null;
}

export async function fetchStocktwitsStream(
  symbol: string,
  maxItems = 10
): Promise<CrowdItem[]> {
  const sym = symbol.toUpperCase();
  const url = `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(sym)}.json`;
  try {
    const resp = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return [];
    const data = (await resp.json()) as {
      messages?: Array<{
        body?: string;
        created_at?: string;
        id?: number;
        user?: { username?: string };
        entities?: { sentiment?: { basic?: string } };
      }>;
    };
    return (data.messages ?? []).slice(0, maxItems).map((m) => ({
      title: m.body?.slice(0, 200) ?? "Stocktwits message",
      snippet: m.user?.username
        ? `@${m.user.username}${m.entities?.sentiment?.basic ? ` · ${m.entities.sentiment.basic}` : ""}`
        : "Stocktwits",
      url: m.id
        ? `https://stocktwits.com/message/${m.id}`
        : `https://stocktwits.com/symbol/${sym}`,
      published_at: m.created_at ?? null,
      sourceLabel: "Stocktwits",
      imageUrl: null,
    }));
  } catch {
    return [];
  }
}

export async function fetchRedditSearchRss(
  symbol: string,
  maxItems = 10
): Promise<CrowdItem[]> {
  const sym = symbol.toUpperCase();
  const url = `https://www.reddit.com/search.rss?q=${encodeURIComponent(sym + " stock")}&sort=new`;
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "RawMarkets/1.0 (news-bay crowd lane)",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!resp.ok) return [];
    const xml = await resp.text();
    const { parseRssXml } = await import("./rssFetch");
    const items = parseRssXml(xml, "Reddit", maxItems);
    return items.map((item) => ({
      title: item.title,
      snippet: item.snippet,
      url: item.url,
      published_at: item.published_at,
      sourceLabel: item.sourceLabel,
      imageUrl: item.imageUrl,
    }));
  } catch {
    return [];
  }
}
