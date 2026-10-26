/** Favicon domains for News Bay RSS registry feeds */
export const FEED_ID_DOMAINS: Record<string, string> = {
  yahoo: "finance.yahoo.com",
  google_news: "news.google.com",
  reuters_markets: "reuters.com",
  fox_business: "foxbusiness.com",
  cnbc_top: "cnbc.com",
  marketwatch_top: "marketwatch.com",
  nasdaq_news: "nasdaq.com",
  globenewswire: "globenewswire.com",
  prnewswire: "prnewswire.com",
  businesswire: "businesswire.com",
  company_ir: "sec.gov",
  fed_press: "federalreserve.gov",
  bls_latest: "bls.gov",
  bea_news: "bea.gov",
  census_econ: "census.gov",
  eia_today: "eia.gov",
  cme_news: "cmegroup.com",
  stocktwits: "stocktwits.com",
  reddit: "reddit.com",
  sec_8k: "sec.gov",
  sec_10q: "sec.gov",
  sec_10k: "sec.gov",
  sec_form4: "sec.gov",
  sec_s1: "sec.gov",
  sec_13d: "sec.gov",
  sec_13g: "sec.gov",
};

/** Common publisher labels → domain (SerpApi / RSS source names) */
const PUBLISHER_LABEL_DOMAINS: Record<string, string> = {
  "yahoo finance": "finance.yahoo.com",
  yahoo: "finance.yahoo.com",
  reuters: "reuters.com",
  "fox business": "foxbusiness.com",
  fox: "foxnews.com",
  cnbc: "cnbc.com",
  marketwatch: "marketwatch.com",
  bloomberg: "bloomberg.com",
  "wall street journal": "wsj.com",
  wsj: "wsj.com",
  "financial times": "ft.com",
  ft: "ft.com",
  "business insider": "businessinsider.com",
  seeking: "seekingalpha.com",
  "seeking alpha": "seekingalpha.com",
  nasdaq: "nasdaq.com",
  barrons: "barrons.com",
  fool: "fool.com",
  "the motley fool": "fool.com",
  benzinga: "benzinga.com",
  investopedia: "investopedia.com",
  "globenewswire": "globenewswire.com",
  "pr newswire": "prnewswire.com",
  "business wire": "businesswire.com",
  stocktwits: "stocktwits.com",
  reddit: "reddit.com",
  sec: "sec.gov",
};

export function extractDomainFromUrl(url: string | null | undefined): string | null {
  if (!url || url === "#") return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
    if (!host || host === "news.google.com" || host === "google.com") {
      return null;
    }
    return host;
  } catch {
    return null;
  }
}

export function domainFromPublisherLabel(label: string): string | null {
  const key = label.trim().toLowerCase();
  if (!key) return null;
  if (PUBLISHER_LABEL_DOMAINS[key]) return PUBLISHER_LABEL_DOMAINS[key];
  for (const [needle, domain] of Object.entries(PUBLISHER_LABEL_DOMAINS)) {
    if (key.includes(needle)) return domain;
  }
  return null;
}

export function resolveNewsSourceDomain(options: {
  feedId?: string | null;
  sourceLabel?: string;
  articleUrl?: string | null;
}): string | null {
  if (options.feedId) {
    if (FEED_ID_DOMAINS[options.feedId]) {
      return FEED_ID_DOMAINS[options.feedId];
    }
    if (options.feedId.startsWith("sec_")) return "sec.gov";
  }

  const fromUrl = extractDomainFromUrl(options.articleUrl);
  if (fromUrl) return fromUrl;

  if (options.sourceLabel) {
    const fromLabel = domainFromPublisherLabel(options.sourceLabel);
    if (fromLabel) return fromLabel;
  }

  return null;
}
