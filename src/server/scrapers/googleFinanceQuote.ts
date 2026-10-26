import {
  scrapeGoogleFinanceBetaQuote,
  scrapeGoogleFinanceBetaQuoteFetch,
} from "./googleFinanceBeta";

/** Scrape quote via Google Finance Beta (Playwright). */
export async function scrapeGoogleFinanceQuote(
  googleFinanceId: string,
  options?: { preferFetch?: boolean }
): Promise<import("./types").ScrapeResult> {
  if (options?.preferFetch) {
    const fetched = await scrapeGoogleFinanceBetaQuoteFetch(googleFinanceId);
    if (fetched.ok) return fetched;
  }
  const live = await scrapeGoogleFinanceBetaQuote(googleFinanceId);
  if (live.ok) return live;
  if (!options?.preferFetch) {
    return scrapeGoogleFinanceBetaQuoteFetch(googleFinanceId);
  }
  return live;
}
