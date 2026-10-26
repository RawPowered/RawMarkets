import * as cheerio from "cheerio";
import { getDb } from "./db";
import { fetchRssFeed } from "./rssFetch";
import { loadCustomAssets } from "./db";

const DISCOVERY_STALE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_DISCOVER_PER_RUN = 5;

const IR_PATH_SUFFIXES = [
  "/investors",
  "/investor-relations",
  "/investor",
  "/ir",
  "/press",
  "/news",
  "/media",
];

const RSS_PATH_SUFFIXES = [
  "/feed",
  "/rss",
  "/press-releases/rss",
  "/news/rss",
  "/investors/rss",
];

export interface IrFeedRow {
  symbol: string;
  ir_page_url: string | null;
  rss_url: string | null;
  discovery_status: string;
  last_checked_at: number | null;
  error_message: string | null;
}

export function getIrRssUrl(symbol: string): string | null {
  const row = getDb()
    .prepare(
      "SELECT rss_url, discovery_status FROM symbol_ir_feeds WHERE symbol = ?"
    )
    .get(symbol.toUpperCase()) as
    | { rss_url: string | null; discovery_status: string }
    | undefined;
  if (row?.discovery_status === "ok" && row.rss_url) return row.rss_url;
  return null;
}

export function setIrFeedManual(
  symbol: string,
  rssUrl: string,
  irPageUrl?: string
): void {
  getDb()
    .prepare(
      `INSERT INTO symbol_ir_feeds (symbol, ir_page_url, rss_url, discovery_status, last_checked_at, error_message)
       VALUES (?, ?, ?, 'ok', ?, NULL)
       ON CONFLICT(symbol) DO UPDATE SET
         ir_page_url = excluded.ir_page_url,
         rss_url = excluded.rss_url,
         discovery_status = 'ok',
         last_checked_at = excluded.last_checked_at,
         error_message = NULL`
    )
    .run(
      symbol.toUpperCase(),
      irPageUrl ?? null,
      rssUrl,
      Date.now()
    );
}

function guessCompanyDomain(symbol: string, companyName?: string): string[] {
  const hosts: string[] = [];
  const catalog = loadCustomAssets() as Record<
    string,
    { website?: string; irDomain?: string; name?: string }
  >;
  const payload = catalog[symbol.toUpperCase()];
  if (payload?.irDomain) hosts.push(payload.irDomain.replace(/^https?:\/\//, "").split("/")[0]);
  if (payload?.website) {
    try {
      const h = new URL(
        payload.website.startsWith("http") ? payload.website : `https://${payload.website}`
      ).hostname;
      hosts.push(h);
    } catch {
      /* ignore */
    }
  }
  const slug = (companyName ?? symbol)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 24);
  if (slug.length >= 3) {
    hosts.push(`${slug}.com`, `www.${slug}.com`, `ir.${slug}.com`);
  }
  return [...new Set(hosts.filter(Boolean))];
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

function extractRssFromHtml(html: string, baseUrl: string): string | null {
  const $ = cheerio.load(html);
  for (const el of $('link[rel="alternate"]').toArray()) {
    const type = ($(el).attr("type") ?? "").toLowerCase();
    if (type.includes("rss") || type.includes("atom") || type.includes("xml")) {
      const href = $(el).attr("href");
      if (href) {
        try {
          return new URL(href, baseUrl).href;
        } catch {
          /* ignore */
        }
      }
    }
  }
  return null;
}

async function validateRssUrl(url: string): Promise<boolean> {
  try {
    const items = await fetchRssFeed(url, "IR", 2);
    return items.length > 0;
  } catch {
    return false;
  }
}

async function discoverForSymbol(
  symbol: string,
  companyName?: string
): Promise<void> {
  const sym = symbol.toUpperCase();
  const hosts = guessCompanyDomain(sym, companyName);
  let foundRss: string | null = null;
  let foundPage: string | null = null;

  for (const host of hosts) {
    const base = `https://${host.replace(/^www\./, "")}`;
    for (const suffix of IR_PATH_SUFFIXES) {
      const pageUrl = `${base}${suffix}`;
      const html = await fetchHtml(pageUrl);
      if (!html) continue;
      const rss = extractRssFromHtml(html, pageUrl);
      if (rss && (await validateRssUrl(rss))) {
        foundRss = rss;
        foundPage = pageUrl;
        break;
      }
      for (const rssSuffix of RSS_PATH_SUFFIXES) {
        const rssUrl = `${pageUrl.replace(/\/$/, "")}${rssSuffix}`;
        if (await validateRssUrl(rssUrl)) {
          foundRss = rssUrl;
          foundPage = pageUrl;
          break;
        }
      }
      if (foundRss) break;
    }
    if (foundRss) break;
  }

  const status = foundRss ? "ok" : "failed";
  getDb()
    .prepare(
      `INSERT INTO symbol_ir_feeds (symbol, ir_page_url, rss_url, discovery_status, last_checked_at, error_message)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(symbol) DO UPDATE SET
         ir_page_url = excluded.ir_page_url,
         rss_url = excluded.rss_url,
         discovery_status = excluded.discovery_status,
         last_checked_at = excluded.last_checked_at,
         error_message = excluded.error_message`
    )
    .run(
      sym,
      foundPage,
      foundRss,
      status,
      Date.now(),
      foundRss ? null : "No IR RSS found on common paths"
    );
}

export function getPendingIrSymbols(symbols: string[]): string[] {
  const now = Date.now();
  const pending: string[] = [];
  for (const sym of symbols) {
    const row = getDb()
      .prepare(
        "SELECT discovery_status, last_checked_at FROM symbol_ir_feeds WHERE symbol = ?"
      )
      .get(sym.toUpperCase()) as
      | { discovery_status: string; last_checked_at: number | null }
      | undefined;
    if (!row) {
      pending.push(sym);
      continue;
    }
    if (row.discovery_status === "pending") {
      pending.push(sym);
      continue;
    }
    if (
      row.discovery_status === "failed" &&
      (!row.last_checked_at || now - row.last_checked_at > DISCOVERY_STALE_MS)
    ) {
      pending.push(sym);
    }
  }
  return pending;
}

/** Fire-and-forget IR discovery for watchlist symbols. */
export function scheduleIrDiscovery(
  symbols: Array<{ symbol: string; name?: string }>
): void {
  const pending = getPendingIrSymbols(symbols.map((s) => s.symbol)).slice(
    0,
    MAX_DISCOVER_PER_RUN
  );
  if (pending.length === 0) return;

  void (async () => {
    for (const sym of pending) {
      const entry = symbols.find((s) => s.symbol.toUpperCase() === sym);
      try {
        await discoverForSymbol(sym, entry?.name);
      } catch {
        getDb()
          .prepare(
            `INSERT INTO symbol_ir_feeds (symbol, discovery_status, last_checked_at, error_message)
             VALUES (?, 'failed', ?, ?)
             ON CONFLICT(symbol) DO UPDATE SET
               discovery_status = 'failed',
               last_checked_at = excluded.last_checked_at,
               error_message = excluded.error_message`
          )
          .run(sym, Date.now(), "Discovery error");
      }
    }
  })();
}
