import type { Page } from "playwright";
import * as cheerio from "cheerio";
import type { ScrapeResult } from "./types";
import { withScrapeTab } from "./browserPool";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const GOOGLE_FINANCE_BETA_PROVIDER = "Google Finance Beta";

/** Canonical Beta quote page (redirects from legacy /finance/quote/). */
export function googleFinanceBetaQuoteUrl(googleFinanceId: string): string {
  const id = googleFinanceId.trim();
  return `https://www.google.com/finance/beta/quote/${encodeURIComponent(id)}`;
}

export function googleFinanceBetaSearchUrl(q: string): string {
  return `https://www.google.com/finance/beta/?q=${encodeURIComponent(q)}`;
}

function parsePriceText(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function formatChangePercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

/** Parse visible quote block from Beta page innerText. */
export function parseGoogleFinanceBetaInnerText(
  innerText: string,
  googleFinanceId: string
): { price: number; changePercent: string | null } | null {
  const sym = googleFinanceId.split(":")[0]?.toUpperCase() ?? "";
  const lines = innerText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const tryWindow = (start: number): { price: number; changePercent: string | null } | null => {
    for (let j = start; j < Math.min(start + 10, lines.length); j++) {
      const price = parsePriceText(lines[j]);
      if (price == null || price <= 0) continue;
      let changePercent: string | null = null;
      for (let k = j + 1; k < Math.min(j + 6, lines.length); k++) {
        const cm = lines[k].match(/^([+-]?[\d.]+)%$/);
        if (cm) {
          changePercent = formatChangePercent(parseFloat(cm[1]));
          break;
        }
      }
      return { price, changePercent };
    }
    return null;
  };

  if (sym) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toUpperCase();
      if (line === sym || line.includes(`(${sym})`) || line.startsWith(sym + " ")) {
        const hit = tryWindow(i + 1);
        if (hit) return hit;
      }
    }
  }

  const block = innerText.match(
    /\$([0-9,]+\.[0-9]{2})\s*[\s\S]{0,80}?([+-]?[0-9.]+)%/
  );
  if (block) {
    const price = parsePriceText(block[1]);
    if (price != null) {
      return {
        price,
        changePercent: formatChangePercent(parseFloat(block[2])),
      };
    }
  }

  return null;
}

export function parseGoogleFinanceBetaHtml(
  html: string,
  googleFinanceId: string,
  sourceUrl: string
): ScrapeResult {
  const $ = cheerio.load(html);
  let price: number | null = null;

  const dataLast = $("[data-last-price]").attr("data-last-price");
  if (dataLast) price = parsePriceText(dataLast);

  if (price == null) {
    const metaPrice = $('meta[itemprop="price"]').attr("content");
    price = parsePriceText(metaPrice);
  }

  if (price == null) {
    const text = $("body").text();
    const parsed = parseGoogleFinanceBetaInnerText(text, googleFinanceId);
    if (parsed) {
      return {
        ok: true,
        price: parsed.price,
        changePercent: parsed.changePercent ?? undefined,
        sourceUrl,
        provider: GOOGLE_FINANCE_BETA_PROVIDER,
        scrapedAt: Date.now(),
      };
    }
  }

  if (price != null) {
    return {
      ok: true,
      price,
      sourceUrl,
      provider: GOOGLE_FINANCE_BETA_PROVIDER,
      scrapedAt: Date.now(),
    };
  }

  return {
    ok: false,
    sourceUrl,
    provider: GOOGLE_FINANCE_BETA_PROVIDER,
    error: "Could not parse price from Google Finance Beta page",
  };
}

async function extractFromPage(
  page: Page,
  googleFinanceId: string,
  sourceUrl: string
): Promise<ScrapeResult> {
  await page
    .waitForFunction(
      () => {
        const t = document.body?.innerText ?? "";
        return /\$[\d,]+\.\d{2}/.test(t) && t.length > 200;
      },
      { timeout: 20_000 }
    )
    .catch(() => {});

  await page.waitForTimeout(1200);

  const parsed = await page.evaluate((id) => {
    const innerText = document.body?.innerText ?? "";
    const sym = id.split(":")[0]?.toUpperCase() ?? "";
    const lines = innerText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const tryWindow = (start: number) => {
      for (let j = start; j < Math.min(start + 10, lines.length); j++) {
        const m = lines[j].match(/^\$?([0-9,]+\.[0-9]{2})$/);
        if (!m) continue;
        const price = parseFloat(m[1].replace(/,/g, ""));
        if (!Number.isFinite(price) || price <= 0) continue;
        let changePercent: string | null = null;
        for (let k = j + 1; k < Math.min(j + 6, lines.length); k++) {
          const cm = lines[k].match(/^([+-]?[0-9.]+)%$/);
          if (cm) {
            const v = parseFloat(cm[1]);
            changePercent = `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
            break;
          }
        }
        return { price, changePercent };
      }
      return null;
    };

    if (sym) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toUpperCase();
        if (line === sym || line.includes(`(${sym})`) || line.startsWith(`${sym} `)) {
          const hit = tryWindow(i + 1);
          if (hit) return hit;
        }
      }
    }

    const block = innerText.match(
      /\$([0-9,]+\.[0-9]{2})\s*[\s\S]{0,80}?([+-]?[0-9.]+)%/
    );
    if (block) {
      const price = parseFloat(block[1].replace(/,/g, ""));
      if (Number.isFinite(price)) {
        const v = parseFloat(block[2]);
        return {
          price,
          changePercent: `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,
        };
      }
    }
    return null;
  }, googleFinanceId);

  if (parsed?.price != null) {
    return {
      ok: true,
      price: parsed.price,
      changePercent: parsed.changePercent ?? undefined,
      sourceUrl,
      provider: GOOGLE_FINANCE_BETA_PROVIDER,
      scrapedAt: Date.now(),
    };
  }

  const html = await page.content();
  return parseGoogleFinanceBetaHtml(html, googleFinanceId, sourceUrl);
}

export async function scrapeGoogleFinanceBetaQuote(
  googleFinanceId: string
): Promise<ScrapeResult> {
  const id = googleFinanceId.trim();
  if (!id) {
    return {
      ok: false,
      sourceUrl: "",
      provider: GOOGLE_FINANCE_BETA_PROVIDER,
      error: "Missing Google Finance id (e.g. AAPL:NASDAQ).",
    };
  }

  const sourceUrl = googleFinanceBetaQuoteUrl(id);

  try {
    return await withScrapeTab(sourceUrl, (page) =>
      extractFromPage(page, id, sourceUrl)
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      sourceUrl,
      provider: GOOGLE_FINANCE_BETA_PROVIDER,
      error: msg,
    };
  }
}

/** Lightweight fetch fallback when Playwright is unavailable. */
export async function scrapeGoogleFinanceBetaQuoteFetch(
  googleFinanceId: string
): Promise<ScrapeResult> {
  const id = googleFinanceId.trim();
  const sourceUrl = googleFinanceBetaQuoteUrl(id);
  try {
    const resp = await fetch(sourceUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
    if (!resp.ok) {
      return {
        ok: false,
        sourceUrl,
        provider: GOOGLE_FINANCE_BETA_PROVIDER,
        error: `HTTP ${resp.status}`,
      };
    }
    const html = await resp.text();
    return parseGoogleFinanceBetaHtml(html, id, sourceUrl);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      sourceUrl,
      provider: GOOGLE_FINANCE_BETA_PROVIDER,
      error: msg,
    };
  }
}
