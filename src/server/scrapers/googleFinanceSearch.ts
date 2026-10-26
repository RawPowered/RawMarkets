import * as cheerio from "cheerio";
import type { SymbolSearchHit } from "../../types";
import { withScrapeTab } from "./browserPool";
import { googleFinanceBetaSearchUrl } from "./googleFinanceBeta";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function parseQuoteHref(href: string): string | null {
  const match = href.match(/\/finance(?:\/beta)?\/quote\/([^:?#]+)/);
  if (!match) {
    const rel = href.match(/^\.\/quote\/([^:?#]+)/);
    if (rel) return decodeURIComponent(rel[1]);
    return null;
  }
  return decodeURIComponent(match[1]);
}

function parseSearchHtml(html: string, q: string): SymbolSearchHit[] {
  const $ = cheerio.load(html);
  const hits: SymbolSearchHit[] = [];
  const seen = new Set<string>();

  $('a[href*="/finance/quote/"], a[href*="/finance/beta/quote/"], a[href^="./quote/"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const googleFinanceId = parseQuoteHref(href);
    if (!googleFinanceId) return;
    const symPart = googleFinanceId.split(":")[0]?.toUpperCase() ?? "";
    if (!symPart || seen.has(googleFinanceId)) return;
    seen.add(googleFinanceId);

    const name =
      $(el).find('[class*="tOzDHb"]').first().text().trim() ||
      $(el).text().trim().split("\n")[0]?.trim() ||
      symPart;

    hits.push({
      symbol: symPart,
      name: name || symPart,
      market: googleFinanceId.includes(":") ? googleFinanceId.split(":")[1] : "Google",
      type: "Equity",
      currency: "USD",
      defaultPrice: 100,
      category: "MARKETS",
      desc: `Google Finance — ${googleFinanceId}`,
      source: "google_finance",
      googleFinanceId,
      exchange: googleFinanceId.includes(":") ? googleFinanceId.split(":")[1] : undefined,
    });
  });

  if (hits.length === 0 && q.length >= 1) {
    hits.push({
      symbol: q.toUpperCase().slice(0, 12),
      name: q,
      market: "Google Finance",
      type: "Equity",
      currency: "USD",
      defaultPrice: 100,
      category: "MARKETS",
      desc: `Google Finance search: ${q}`,
      source: "google_finance",
      googleFinanceId: `${q.toUpperCase()}`,
    });
  }

  return hits.slice(0, 10);
}

async function fetchSearchHtml(q: string): Promise<string | null> {
  const urls = [
    googleFinanceBetaSearchUrl(q),
    `https://www.google.com/finance/search?q=${encodeURIComponent(q)}`,
  ];
  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
      });
      if (!resp.ok) continue;
      const html = await resp.text();
      if (html.length > 500) return html;
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function searchGoogleFinance(q: string): Promise<SymbolSearchHit[]> {
  const html = await fetchSearchHtml(q);
  if (html && html.length > 500) {
    const parsed = parseSearchHtml(html, q);
    if (parsed.length > 0) return parsed;
  }

  try {
    return await withScrapeTab(googleFinanceBetaSearchUrl(q), async (page) => {
      await page.waitForTimeout(2000);
      const content = await page.content();
      const parsed = parseSearchHtml(content, q);
      if (parsed.length > 0) return parsed;
      return parseSearchHtml(await page.content(), q);
    });
  } catch {
    return [];
  }
}
