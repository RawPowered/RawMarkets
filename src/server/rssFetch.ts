import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { throttleForUrl } from "./fetchThrottle";

const RSS_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface RssItem {
  title: string;
  snippet: string;
  url: string | null;
  published_at: string | null;
  sourceLabel: string;
  /** Featured image from media RSS, enclosure, or description HTML */
  imageUrl: string | null;
}

export function normalizeRssImageUrl(raw: string | undefined | null): string | null {
  if (!raw?.trim()) return null;
  let u = raw
    .trim()
    .replace(/&amp;/g, "&")
    .replace(/&#0*39;/g, "'");
  if (u.startsWith("//")) u = `https:${u}`;
  if (!/^https?:\/\//i.test(u)) return null;
  const lower = u.toLowerCase();
  if (
    /1x1|pixel\.gif|spacer\.|transparent\.|data:image\/svg/i.test(lower) ||
    /favicon|logo\.(png|gif|svg)/i.test(lower)
  ) {
    return null;
  }
  return u;
}

function firstImgFromHtml(html: string): string | null {
  if (!html?.trim()) return null;
  try {
    const $h = cheerio.load(html);
    for (const el of $h("img").toArray()) {
      const src =
        $h(el).attr("src") ||
        $h(el).attr("data-src") ||
        $h(el).attr("data-lazy-src");
      const normalized = normalizeRssImageUrl(src);
      if (normalized) return normalized;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Extract featured thumbnail from RSS 2.0 / Media RSS item */
export function extractRssThumbnail(
  $: cheerio.CheerioAPI,
  el: Element
): string | null {
  const $el = $(el);

  const mediaThumb = $el
    .find("thumbnail, media\\:thumbnail")
    .first()
    .attr("url");
  const fromMediaThumb = normalizeRssImageUrl(mediaThumb);
  if (fromMediaThumb) return fromMediaThumb;

  const mediaNodes = $el.find("content, media\\:content").toArray();
  for (const node of mediaNodes) {
    const $n = $(node);
    const url = $n.attr("url");
    const medium = ($n.attr("medium") || "").toLowerCase();
    const type = ($n.attr("type") || "").toLowerCase();
    if (medium === "image" || type.startsWith("image/")) {
      const normalized = normalizeRssImageUrl(url);
      if (normalized) return normalized;
    }
  }

  const enclosureUrl = $el.find("enclosure").first().attr("url");
  const enclosureType = ($el.find("enclosure").first().attr("type") || "").toLowerCase();
  if (enclosureType.startsWith("image/")) {
    const normalized = normalizeRssImageUrl(enclosureUrl);
    if (normalized) return normalized;
  }

  const description =
    $el.find("description").first().text() ||
    $el.find("summary").first().text() ||
    $el.find("content\\:encoded").first().text() ||
    "";
  const fromDesc = firstImgFromHtml(description);
  if (fromDesc) return fromDesc;

  const contentEncoded = $el.find("content\\:encoded").first().html() || "";
  return firstImgFromHtml(contentEncoded);
}

export function parseRssXml(xml: string, sourceLabel: string, maxItems: number): RssItem[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items: RssItem[] = [];
  $("item").each((_, el) => {
    const title = $(el).find("title").first().text().trim();
    if (!title) return;
    const descriptionRaw =
      $(el).find("description").first().text().trim() ||
      $(el).find("summary").first().text().trim() ||
      $(el).find("content\\:encoded").first().text().trim();
    const link =
      $(el).find("link").first().text().trim() ||
      $(el).find("guid").first().text().trim() ||
      null;
    const pubDate =
      $(el).find("pubDate").first().text().trim() ||
      $(el).find("published").first().text().trim() ||
      $(el).find("updated").first().text().trim() ||
      null;
    items.push({
      title,
      snippet: stripHtml(descriptionRaw),
      url: link && link.startsWith("http") ? link : null,
      published_at: pubDate,
      sourceLabel,
      imageUrl: extractRssThumbnail($, el),
    });
  });

  if (items.length === 0) {
    $("entry").each((_, el) => {
      const title = $(el).find("title").first().text().trim();
      if (!title) return;
      const summary =
        $(el).find("summary").first().text().trim() ||
        $(el).find("content").first().text().trim();
      const link =
        $(el).find("link").attr("href") ||
        $(el).find("id").first().text().trim() ||
        null;
      const pubDate =
        $(el).find("published").first().text().trim() ||
        $(el).find("updated").first().text().trim() ||
        null;
      items.push({
        title,
        snippet: stripHtml(summary),
        url: link && link.startsWith("http") ? link : null,
        published_at: pubDate,
        sourceLabel,
        imageUrl: extractRssThumbnail($, el),
      });
    });
  }

  return items.slice(0, maxItems);
}

function stripHtml(html: string): string {
  if (!html) return "";
  return cheerio.load(html).text().replace(/\s+/g, " ").trim();
}

export async function fetchRssFeed(
  url: string,
  sourceLabel: string,
  maxItems = 10,
  extraHeaders?: Record<string, string>
): Promise<RssItem[]> {
  try {
    const resp = await throttleForUrl(url, () =>
      fetch(url, {
        headers: { "User-Agent": RSS_USER_AGENT, ...extraHeaders },
      })
    );
    if (!resp.ok) return [];
    const xml = await resp.text();
    return parseRssXml(xml, sourceLabel, maxItems);
  } catch {
    return [];
  }
}
