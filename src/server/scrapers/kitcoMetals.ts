import type { Page } from "playwright";

import type { MetalSpotRate } from "../metalSpot";

import { withScrapeTab } from "./browserPool";

import { runTrackedScrape } from "./scrapeQueue";

import type { ScrapeResult } from "./types";



export const KITCO_METAL_PAGES: Record<

  string,

  { url: string; name: string }

> = {

  XAU: {

    url: "https://www.kitco.com/charts/livegold.html",

    name: "Gold Spot",

  },

  XAG: {

    url: "https://www.kitco.com/charts/livesilver.html",

    name: "Silver Spot",

  },

  XPT: {

    url: "https://www.kitco.com/charts/liveplatinum.html",

    name: "Platinum Spot",

  },

  XPD: {

    url: "https://www.kitco.com/charts/livepalladium.html",

    name: "Palladium Spot",

  },

};



const KITCO_INTER_METAL_DELAY_MS = 2000;



function parsePriceText(raw: string | null | undefined): number | null {

  if (!raw) return null;

  const cleaned = raw.replace(/,/g, "").trim();

  const n = parseFloat(cleaned);

  return Number.isFinite(n) && n > 0 ? n : null;

}



function parseChangeFromText(text: string): {

  changePercent: string;

  change: number;

} {

  const pctMatch = text.match(/([+-]?\d+\.?\d*)\s*%/);

  const pct = pctMatch ? parseFloat(pctMatch[1]) : 0;

  const sign = pct >= 0 ? "+" : "";

  return {

    changePercent: `${sign}${pct.toFixed(2)}%`,

    change: 0,

  };

}



function plausibilityBounds(iso: string): { min: number; max: number } {

  if (iso === "XAG") return { min: 40, max: 200 };

  if (iso === "XAU") return { min: 1500, max: 8000 };

  return { min: 400, max: 5000 };

}



async function extractKitcoSpotFromPage(

  page: Page,

  iso: string

): Promise<ScrapeResult> {

  const meta = KITCO_METAL_PAGES[iso];

  if (!meta) {

    return {

      ok: false,

      sourceUrl: "",

      provider: "Kitco",

      error: `Unknown metal ISO: ${iso}`,

    };

  }



  try {

    const extracted = await page.evaluate(() => {

      const bodyText = document.body?.innerText ?? "";

      const candidates: string[] = [];



      const priceLike = document.querySelectorAll(

        "[class*='spot-price' i], [class*='SpotPrice' i], [data-testid*='price' i], [class*='bid-price' i]"

      );

      priceLike.forEach((el) => {

        const t = (el as HTMLElement).innerText?.trim();

        if (t && /\d/.test(t)) candidates.push(t);

      });



      const bidEl = document.querySelector(

        "[class*='bid' i], [id*='bid' i], [data-testid*='bid' i]"

      );

      if (bidEl) {

        const t = (bidEl as HTMLElement).innerText?.trim();

        if (t) candidates.push(t);

      }



      document.querySelectorAll("h1, h2, h3, [class*='price' i]").forEach((el) => {

        const t = (el as HTMLElement).innerText?.trim();

        if (t && /\d/.test(t)) candidates.push(t);

      });



      const bidLine = bodyText.match(/Bid[^\d$]*\$?\s*([\d,]+\.?\d*)/i);

      const askLine = bodyText.match(/Ask[^\d$]*\$?\s*([\d,]+\.?\d*)/i);

      const liveGold = bodyText.match(

        /Live\s+gold\s+Price[\s\S]{0,200}?Bid[\s\S]{0,80}?([\d,]+\.?\d*)/i

      );

      const ozUsd = bodyText.match(/\$\s*([\d,]+\.\d{2})\s*(?:\/|\s*)?(?:oz|OZ)/i);



      return {

        bodySnippet: bodyText.slice(0, 800),

        candidates: candidates.slice(0, 25),

        bid: bidLine?.[1] ?? liveGold?.[1] ?? ozUsd?.[1] ?? null,

        ask: askLine?.[1] ?? null,

      };

    });



    let price = parsePriceText(extracted.bid) ?? parsePriceText(extracted.ask);



    if (!price) {

      for (const c of extracted.candidates) {

        const m = c.match(/([\d,]+\.\d{2})/);

        if (m) {

          const p = parsePriceText(m[1]);

          if (p && p > 10) {

            price = p;

            break;

          }

        }

      }

    }



    const { min, max } = plausibilityBounds(iso);

    if (!price || price < min || price > max) {

      const hint = extracted.candidates.slice(0, 3).join(" | ") || extracted.bodySnippet.slice(0, 120);

      return {

        ok: false,

        sourceUrl: meta.url,

        provider: "Kitco",

        error: `Could not parse plausible ${iso} spot (got ${price ?? "none"}). Candidates: ${hint}`,

      };

    }



    const ch = parseChangeFromText(extracted.bodySnippet);
    const pctMatch = ch.changePercent.match(/([+-]?\d+\.?\d*)/);
    const pctNum = pctMatch ? parseFloat(pctMatch[1]) : 0;
    const changeAmt = parseFloat((price * (pctNum / 100)).toFixed(2));

    return {

      ok: true,

      price,

      change: changeAmt,

      changePercent: ch.changePercent,

      sourceUrl: meta.url,

      provider: "Kitco",

      scrapedAt: Date.now(),

    };

  } catch (err: unknown) {

    const msg = err instanceof Error ? err.message : String(err);

    return {

      ok: false,

      sourceUrl: meta.url,

      provider: "Kitco",

      error: msg,

    };

  }

}



export function scrapeResultToMetalRate(

  iso: string,

  result: ScrapeResult

): MetalSpotRate | null {

  if (!result.ok || result.price == null) return null;

  const meta = KITCO_METAL_PAGES[iso];

  const price = result.price;

  return {

    name: meta?.name ?? `${iso} Spot`,

    symbol: iso,

    price: parseFloat(price.toFixed(2)),

    rate: parseFloat((1 / price).toFixed(8)),

    change: result.change ?? 0,

    changePercent: result.changePercent ?? "0.00%",

    unit: "oz",

  };

}



export async function scrapeKitcoMetal(

  iso: string,

  priority = 0

): Promise<ScrapeResult> {

  const meta = KITCO_METAL_PAGES[iso];

  if (!meta) {

    return {

      ok: false,

      sourceUrl: "",

      provider: "Kitco",

      error: `Unknown metal ISO: ${iso}`,

    };

  }

  return runTrackedScrape(

    { provider: "Kitco", symbol: iso, url: meta.url, priority },

    () =>

      withScrapeTab(meta.url, (page) => extractKitcoSpotFromPage(page, iso))

  );

}



export async function scrapeKitcoMetals(

  isos: readonly string[] = ["XAU", "XAG", "XPT", "XPD"]

): Promise<{

  results: Record<string, ScrapeResult>;

  errors: string[];

}> {

  const results: Record<string, ScrapeResult> = {};

  const errors: string[] = [];



  for (let i = 0; i < isos.length; i++) {

    const iso = isos[i];

    if (i > 0) {

      await new Promise((r) => setTimeout(r, KITCO_INTER_METAL_DELAY_MS));

    }

    const r = await scrapeKitcoMetal(iso);

    results[iso] = r;

    if (!r.ok) errors.push(`${iso}: ${r.error ?? "failed"}`);

  }



  return { results, errors };

}



/** @deprecated Use scrapeKitcoMetals */

export async function scrapeAllKitcoMetals(): Promise<{

  results: Record<string, ScrapeResult>;

  errors: string[];

}> {

  return scrapeKitcoMetals(["XAU", "XAG", "XPT", "XPD"]);

}
