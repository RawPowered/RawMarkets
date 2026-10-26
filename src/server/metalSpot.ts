import type { Asset } from "../types";
import type { FeedSource } from "../types";
import { historyAlignedToScrapePrice } from "../lib/scrapeHistory";

export type MetalSpotRate = {
  name: string;
  symbol: string;
  price: number;
  rate: number;
  change: number;
  changePercent: string;
  unit: string;
};

export type MetalSpotResult = {
  rates: Record<string, MetalSpotRate>;
  source:
    | "metalpriceapi"
    | "kitco-scrape"
    | "kitco-scrape-failed"
    | "kitco-scrape-cached"
    | "scrape-disabled"
    | "unavailable"
    | "yahoo-futures"
    | "yahoo-futures+kitco";
  message?: string;
  fromLive: boolean;
};

/** USD per troy ounce from MetalPriceAPI (base USD, quote = metal per 1 USD). */
export function ouncePriceFromRate(ratePerUsd: number, fallback: number): number {
  if (!ratePerUsd || ratePerUsd <= 0 || !Number.isFinite(ratePerUsd)) {
    return fallback;
  }
  return 1 / ratePerUsd;
}

/** Prefer USDXAU / USDXAG direct USD-per-oz fields from MetalPriceAPI. */
export function ouncePriceUsdFromApiRates(
  raw: Record<string, number>,
  iso: string,
  fallback: number
): number {
  const directKey = `USD${iso}`;
  const direct = parseFloat(String(raw[directKey]));
  if (direct > 0 && Number.isFinite(direct)) {
    return direct;
  }
  const inverse = parseFloat(String(raw[iso]));
  return ouncePriceFromRate(inverse, fallback);
}

/** Reject legacy AV-era cache (~$31 silver) and other bad snapshots. */
export function isPlausibleMetalSpotCache(
  rates: Record<string, MetalSpotRate> | null | undefined
): boolean {
  const xag = rates?.XAG?.price;
  const xau = rates?.XAU?.price;
  return (
    typeof xag === "number" &&
    xag > 50 &&
    Number.isFinite(xag) &&
    typeof xau === "number" &&
    xau > 1000 &&
    Number.isFinite(xau)
  );
}

export function emptyMetalSpotRates(): Record<string, MetalSpotRate> {
  return {};
}

export function parseMetalPriceApiResponse(apiData: {
  success?: boolean;
  rates?: Record<string, number>;
}): Record<string, MetalSpotRate> | null {
  if (!apiData.success || !apiData.rates) return null;
  const raw = apiData.rates;

  const goldPrice = ouncePriceUsdFromApiRates(raw, "XAU", 0);
  const silverPrice = ouncePriceUsdFromApiRates(raw, "XAG", 0);
  const platinumPrice = ouncePriceUsdFromApiRates(raw, "XPT", 0);
  const palladiumPrice = ouncePriceUsdFromApiRates(raw, "XPD", 0);

  if (goldPrice <= 0 || silverPrice <= 0) return null;

  const mockGoldChange = 0.2 + (Math.random() - 0.45) * 0.3;
  const mockSilverChange = 0.8 + (Math.random() - 0.45) * 1.2;
  const mockPtChange = -0.1 + (Math.random() - 0.5) * 0.6;
  const mockPdChange = 0.5 + (Math.random() - 0.5) * 0.8;

  return {
    XAU: {
      name: "Gold Spot",
      symbol: "XAU",
      price: parseFloat(goldPrice.toFixed(2)),
      rate: parseFloat(String(raw.XAU)),
      change: parseFloat((goldPrice * (mockGoldChange / 100)).toFixed(2)),
      changePercent: `${mockGoldChange >= 0 ? "+" : ""}${mockGoldChange.toFixed(2)}%`,
      unit: "oz",
    },
    XAG: {
      name: "Silver Spot",
      symbol: "XAG",
      price: parseFloat(silverPrice.toFixed(2)),
      rate: parseFloat(String(raw.XAG)),
      change: parseFloat((silverPrice * (mockSilverChange / 100)).toFixed(2)),
      changePercent: `${mockSilverChange >= 0 ? "+" : ""}${mockSilverChange.toFixed(2)}%`,
      unit: "oz",
    },
    XPT: {
      name: "Platinum Spot",
      symbol: "XPT",
      price: parseFloat(platinumPrice.toFixed(2)),
      rate: parseFloat(String(raw.XPT || 0.001015)),
      change: parseFloat((platinumPrice * (mockPtChange / 100)).toFixed(2)),
      changePercent: `${mockPtChange >= 0 ? "+" : ""}${mockPtChange.toFixed(2)}%`,
      unit: "oz",
    },
    XPD: {
      name: "Palladium Spot",
      symbol: "XPD",
      price: parseFloat(palladiumPrice.toFixed(2)),
      rate: parseFloat(String(raw.XPD || 0.000955)),
      change: parseFloat((palladiumPrice * (mockPdChange / 100)).toFixed(2)),
      changePercent: `${mockPdChange >= 0 ? "+" : ""}${mockPdChange.toFixed(2)}%`,
      unit: "oz",
    },
  };
}

/** Map ISO metal codes onto dashboard asset keys (GOLD, SILVER). */
export function applyMetalSpotToItems(
  items: Record<string, Asset>,
  rates: Record<string, MetalSpotRate>,
  priceSource: FeedSource
): string[] {
  const updated: string[] = [];
  const map: [string, string][] = [
    ["XAU", "GOLD"],
    ["XAG", "SILVER"],
  ];

  for (const [iso, key] of map) {
    const r = rates[iso];
    if (!r || !items[key]) continue;
    const prior = items[key].history ?? [];
    const history =
      (priceSource === "scrape" || priceSource === "live") && prior.length >= 1
        ? historyAlignedToScrapePrice(prior, items[key].current, r.price)
        : prior;
    const values = history.length > 0 ? history.map((p) => p.value) : [r.price];
    items[key] = {
      ...items[key],
      current: r.price,
      change: r.change,
      changePercent: r.changePercent,
      history,
      open: history[0]?.value ?? r.price,
      high: Math.max(...values, r.price),
      low: Math.min(...values, r.price),
      priceSource,
      historySource:
        history.length >= 2
          ? priceSource === "scrape" || priceSource === "live"
            ? priceSource
            : items[key].historySource ?? "scrape"
          : items[key].historySource ?? "unavailable",
    };
    updated.push(key);
  }
  return updated;
}
