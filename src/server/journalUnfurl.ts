import * as cheerio from "cheerio";
import type {
  JournalEntryType,
  JournalMediaItem,
  JournalSnapshot,
} from "../types";
import { assertPublicHttpUrl, fetchPublicHttpUrl } from "./urlSafety";

export interface UnfurlResult {
  entry_type: JournalEntryType;
  title: string;
  snippet: string | null;
  source: string | null;
  snapshot: JournalSnapshot;
  media: JournalMediaItem[];
}

const TWEET_ID_RE =
  /(?:twitter\.com|x\.com)\/(?:\w+\/)?status(?:es)?\/(\d+)/i;

function isTwitterUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "twitter.com" || host === "x.com";
  } catch {
    return false;
  }
}

function extractTweetId(url: string): string | null {
  const match = url.match(TWEET_ID_RE);
  return match?.[1] ?? null;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseTwitterOembedHtml(html: string): {
  author: string | null;
  text: string | null;
  mediaUrls: string[];
} {
  const $ = cheerio.load(html);
  const blockquote = $("blockquote");
  const text = blockquote.text().trim() || stripHtml(html);
  const authorLink = blockquote.find("a").last();
  const author = authorLink.text().trim() || null;

  const mediaUrls: string[] = [];
  blockquote.find("a").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (
      href.includes("pic.twitter.com") ||
      href.includes("video.twimg.com") ||
      /\.(jpg|jpeg|png|gif|webp|mp4)(\?|$)/i.test(href)
    ) {
      mediaUrls.push(href);
    }
  });

  return { author, text, mediaUrls };
}

async function unfurlTwitter(url: string): Promise<UnfurlResult> {
  const tweetId = extractTweetId(url);
  const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true&dnt=true`;

  let author: string | null = null;
  let text: string | null = null;
  let embedHtml: string | null = null;
  let mediaUrls: string[] = [];

  try {
    const resp = await fetch(oembedUrl, {
      headers: { Accept: "application/json" },
    });
    if (resp.ok) {
      const data = (await resp.json()) as {
        author_name?: string;
        html?: string;
      };
      author = data.author_name ?? null;
      embedHtml = data.html ?? null;
      if (embedHtml) {
        const parsed = parseTwitterOembedHtml(embedHtml);
        text = parsed.text || (tweetId ? `Tweet ${tweetId}` : null);
        author = author ?? parsed.author;
        mediaUrls = parsed.mediaUrls;
      }
    }
  } catch {
    /* fallback below */
  }

  const media: JournalMediaItem[] = mediaUrls.map((remoteUrl) => ({
    type:
      remoteUrl.includes("video") || remoteUrl.endsWith(".mp4")
        ? ("video" as const)
        : ("image" as const),
    remoteUrl,
  }));

  return {
    entry_type: "social_x",
    title: author ? `${author} on X` : "X Post",
    snippet: text,
    source: "X",
    snapshot: {
      platform: "x",
      author,
      text,
      tweetId,
      embedHtml,
      imageUrl: media.find((m) => m.type === "image")?.remoteUrl ?? null,
      media: mediaUrls.map((u) => ({
        type: (u.includes("video") || u.endsWith(".mp4") ? "video" : "image") as
          | "image"
          | "video",
        url: u,
      })),
    },
    media,
  };
}

async function unfurlGeneric(url: string): Promise<UnfurlResult> {
  let title = url;
  let snippet: string | null = null;
  let imageUrl: string | null = null;
  let source: string | null = null;

  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    source = host;
  } catch {
    source = null;
  }

  try {
    const resp = await fetchPublicHttpUrl(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; RawMarketsBot/1.0; +https://rawmarkets.local)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (resp.ok) {
      const html = await resp.text();
      const $ = cheerio.load(html);
      title =
        $('meta[property="og:title"]').attr("content") ||
        $('meta[name="twitter:title"]').attr("content") ||
        $("title").first().text().trim() ||
        title;
      snippet =
        $('meta[property="og:description"]').attr("content") ||
        $('meta[name="description"]').attr("content") ||
        null;
      imageUrl =
        $('meta[property="og:image"]').attr("content") ||
        $('meta[name="twitter:image"]').attr("content") ||
        null;
    }
  } catch {
    /* use defaults */
  }

  const media: JournalMediaItem[] = imageUrl
    ? [{ type: "image", remoteUrl: imageUrl }]
    : [];

  return {
    entry_type: "article",
    title: title.slice(0, 500),
    snippet,
    source,
    snapshot: {
      platform: "web",
      title,
      text: snippet,
      imageUrl,
      media: imageUrl ? [{ type: "image", url: imageUrl }] : [],
    },
    media,
  };
}

export async function unfurlUrl(url: string): Promise<UnfurlResult> {
  const trimmed = url.trim();
  if (!trimmed || trimmed === "#") {
    throw new Error("Invalid URL");
  }

  let normalized = trimmed;
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }
  const safeUrl = await assertPublicHttpUrl(normalized);
  normalized = safeUrl.href;

  if (isTwitterUrl(normalized)) {
    return unfurlTwitter(normalized);
  }

  return unfurlGeneric(normalized);
}

export function buildNewsClipUnfurl(
  news: {
    title: string;
    snippet: string;
    source: string;
    link: string;
    sentiment?: string;
    score?: number;
    imageUrl?: string | null;
  },
  linkedAssetKey?: string | null
): UnfurlResult {
  const imageUrl =
    news.imageUrl && news.imageUrl.startsWith("http") ? news.imageUrl : null;
  return {
    entry_type: "news_clip",
    title: news.title,
    snippet: news.snippet,
    source: news.source,
    snapshot: {
      platform: "news",
      title: news.title,
      text: news.snippet,
      sentiment: news.sentiment,
      score: news.score,
      linkedAssetKey: linkedAssetKey ?? null,
      imageUrl,
    },
    media: imageUrl ? [{ type: "image", remoteUrl: imageUrl }] : [],
  };
}
