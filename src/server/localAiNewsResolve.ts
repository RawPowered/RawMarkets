import { loadCustomAssets } from "./db";

const NEWS_INTENT =
  /\b(news|headlines?|articles?|rss|press releases?|filings?|latest on|news on|news about|check .+ news|what.+ news)\b/i;

export function shouldPreflightNewsSearch(userText: string): boolean {
  return NEWS_INTENT.test(userText.trim());
}

/** Map company names / tickers mentioned in the user message to catalog symbols. */
export function resolveSymbolsFromUserText(text: string): string[] {
  const catalog = loadCustomAssets() as Record<
    string,
    { name?: string; symbol?: string }
  >;
  const lower = text.toLowerCase();
  const found: string[] = [];

  for (const [key, asset] of Object.entries(catalog)) {
    const sym = (asset.symbol ?? key).trim().toUpperCase();
    const name = (asset.name ?? "").trim();
    const keyLower = key.toLowerCase();
    const nameLower = name.toLowerCase();

    if (
      (sym.length >= 2 && lower.includes(sym.toLowerCase())) ||
      (keyLower.length >= 2 && lower.includes(keyLower)) ||
      (nameLower.length >= 4 &&
        lower.includes(nameLower.split(",")[0] ?? nameLower))
    ) {
      if (sym && !found.includes(sym)) found.push(sym);
    }
  }

  return found;
}

export function extractNewsQueryTerms(userText: string): string {
  const about = userText.match(
    /\b(?:news|headlines?|articles?)\s+(?:on|about|for|regarding)\s+([a-z0-9][a-z0-9\s.&'-]{1,40})/i
  );
  if (about?.[1]) return about[1].trim();

  const symbols = resolveSymbolsFromUserText(userText);
  if (symbols.length === 1) {
    const catalog = loadCustomAssets() as Record<string, { name?: string }>;
    const entry =
      catalog[symbols[0]] ??
      Object.values(catalog).find(
        (a) => (a as { symbol?: string }).symbol?.toUpperCase() === symbols[0]
      );
    const name = (entry as { name?: string })?.name ?? "";
    const short = name.split(",")[0]?.trim();
    if (short && short.length >= 3) return short;
    return symbols[0];
  }

  return "";
}
