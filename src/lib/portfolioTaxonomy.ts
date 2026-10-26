import type {
  BarbellSide,
  Fragility,
  WealthBucket,
} from "../server/portfolioDb";
import { isCryptoSymbol } from "../server/scrapers/types";

const SAFE_ETFS = new Set([
  "GLD",
  "SLV",
  "IAU",
  "BIL",
  "SGOV",
  "SHV",
  "VOO",
  "VTI",
  "SPY",
  "QQQ",
  "SCHD",
  "VIG",
  "JEPI",
]);

const METALS_ETFS = new Set(["GLD", "SLV", "IAU", "PPLT", "PALL"]);

const MEGA_CAP_SAFE = new Set([
  "AAPL",
  "MSFT",
  "GOOGL",
  "GOOG",
  "AMZN",
  "BRK.B",
  "BRK-B",
  "JNJ",
  "PG",
  "KO",
  "PEP",
  "WMT",
  "JPM",
  "V",
  "MA",
]);

const CRYPTO_OR_DIGITAL = new Set([
  "BTC",
  "ETH",
  "GBTC",
  "ETHE",
  "BITO",
  "COIN",
  "MSTR",
]);

const AGGRESSIVE_MEME = new Set([
  "GME",
  "AMC",
  "BBBY",
  "PLTR",
  "SOFI",
  "RIVN",
  "LCID",
  "NIO",
  "HOOD",
]);

export interface TaxonomyResult {
  barbell_side: BarbellSide;
  wealth_bucket: WealthBucket;
  fragility: Fragility;
}

export function classifySymbol(
  symbol: string,
  overrides?: Partial<TaxonomyResult>
): TaxonomyResult {
  const sym = symbol.trim().toUpperCase();
  if (overrides?.barbell_side && overrides?.wealth_bucket && overrides?.fragility) {
    return {
      barbell_side: overrides.barbell_side,
      wealth_bucket: overrides.wealth_bucket,
      fragility: overrides.fragility,
    };
  }

  let barbell_side: BarbellSide = "aggressive";
  let wealth_bucket: WealthBucket = "public_equities";
  let fragility: Fragility = "speculative";

  if (METALS_ETFS.has(sym)) {
    barbell_side = "safe";
    wealth_bucket = "precious_metals";
    fragility = "hedged";
  } else if (SAFE_ETFS.has(sym) || MEGA_CAP_SAFE.has(sym)) {
    barbell_side = "safe";
    wealth_bucket = "public_equities";
    fragility = "hedged";
  } else if (CRYPTO_OR_DIGITAL.has(sym) || isCryptoSymbol(sym, sym)) {
    barbell_side = "aggressive";
    wealth_bucket = "digital";
    fragility = "speculative";
  } else if (AGGRESSIVE_MEME.has(sym)) {
    barbell_side = "aggressive";
    wealth_bucket = "public_equities";
    fragility = "ponzi";
  } else if (/^[A-Z]{1,5}$/.test(sym)) {
    barbell_side = "aggressive";
    wealth_bucket = "public_equities";
    fragility = "speculative";
  }

  return {
    barbell_side: overrides?.barbell_side ?? barbell_side,
    wealth_bucket: overrides?.wealth_bucket ?? wealth_bucket,
    fragility: overrides?.fragility ?? fragility,
  };
}

/** UHNW-style target % of portfolio value for seed-capital display */
export const WEALTH_BUCKET_TARGETS: Record<WealthBucket, number> = {
  public_equities: 20,
  precious_metals: 5,
  digital: 10,
  energy: 5,
  private_vc: 15,
};
