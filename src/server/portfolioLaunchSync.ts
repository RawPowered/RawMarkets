import type { CachedData } from "./db";
import { setCustomAsset } from "./db";
import { classifySymbol } from "../lib/portfolioTaxonomy";
import { getLatestMarketPriceCheck } from "./marketPriceHistory";
import {
  upsertPriceSnapshot,
  type PortfolioHoldingRow,
  type PriceSnapshotSource,
} from "./portfolioDb";
import { isCryptoSymbol } from "./scrapers/types";
import { readCachedMarketQuote } from "./scrapers/marketQuote";
import { resolveCatalogKeyForSymbol } from "./launchIncremental";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function registerCustomAssetForSymbol(
  symbol: string,
  entryPrice: number,
  taxonomy: ReturnType<typeof classifySymbol>
): void {
  const key = symbol.toUpperCase();
  const category =
    taxonomy.wealth_bucket === "precious_metals"
      ? "METALS"
      : taxonomy.wealth_bucket === "energy"
        ? "ENERGY"
        : "MARKETS";
  setCustomAsset(key, {
    name: key,
    symbol: key,
    unit: isCryptoSymbol(key, key) ? "USD" : "USD per Share",
    current: entryPrice,
    open: entryPrice,
    high: entryPrice,
    low: entryPrice,
    volume: 0,
    change: 0,
    changePercent: "+0.00%",
    history: [],
    category,
    desc: `Portfolio holding — ${taxonomy.barbell_side} / ${taxonomy.fragility}`,
  });
}

function snapshotSourceFromMarket(
  source: string | undefined,
  isCrypto: boolean
): PriceSnapshotSource {
  if (isCrypto) return "coinbase";
  if (source === "scrape" || source === "live") return "yahoo_chart";
  if (source === "coinbase") return "coinbase";
  if (source === "yahoo_chart" || source === "manual" || source === "cached")
    return source;
  return "cached";
}

export interface PortfolioLaunchSyncResult {
  synced: number;
  skipped: number;
}

export async function syncPortfolioSnapshotsFromMarket(
  holdings: PortfolioHoldingRow[],
  deps: {
    apiCache: Record<string, CachedData>;
    saveCache: () => void;
    getCatalogItems: () => Record<string, import("../types").Asset>;
  }
): Promise<PortfolioLaunchSyncResult> {
  const catalog = deps.getCatalogItems();
  let synced = 0;
  let skipped = 0;

  for (const holding of holdings) {
    const sym = holding.symbol.toUpperCase();
    const assetKey = resolveCatalogKeyForSymbol(sym, catalog);
    const isCrypto = isCryptoSymbol(assetKey, sym);

    let price: number | null = null;
    let source = "cached";

    const latest = getLatestMarketPriceCheck(assetKey);
    if (latest && latest.price > 0) {
      price = latest.price;
      source = latest.source;
    } else {
      const cat = catalog[assetKey];
      if (cat && cat.current > 0) {
        price = cat.current;
        source = cat.priceSource ?? "cached";
      }
    }

    if ((price == null || price <= 0) && isCrypto) {
      const cached = await readCachedMarketQuote({
        apiCache: deps.apiCache,
        assetKey,
        symbol: sym,
        fresh: false,
        persist: deps.saveCache,
        usePlaywright: false,
      });
      if (cached?.ok && cached.price != null) {
        price = cached.price;
        source = "coinbase";
      }
    }

    if (price == null || price <= 0 || !Number.isFinite(price)) {
      skipped += 1;
      continue;
    }

    if (!catalog[assetKey]) {
      const taxonomy = classifySymbol(sym);
      registerCustomAssetForSymbol(sym, price, taxonomy);
    }

    upsertPriceSnapshot(
      holding.id,
      todayIso(),
      price,
      snapshotSourceFromMarket(source, isCrypto)
    );
    synced += 1;
  }

  return { synced, skipped };
}
