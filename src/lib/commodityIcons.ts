import goldIcon from "../assets/icons/gold.png";
import silverIcon from "../assets/icons/silver.png";
import platinumIcon from "../assets/icons/platinum.png";
import palladiumIcon from "../assets/icons/palladium.png";
import btcUsdIcon from "../assets/icons/btc-usd.png";
import goldSilverIcon from "../assets/icons/gold-silver.png";

export type CommodityIconId =
  | "gold"
  | "silver"
  | "platinum"
  | "palladium"
  | "btc-usd"
  | "gold-silver";

export const COMMODITY_ICON_SRC: Record<CommodityIconId, string> = {
  gold: goldIcon,
  silver: silverIcon,
  platinum: platinumIcon,
  palladium: palladiumIcon,
  "btc-usd": btcUsdIcon,
  "gold-silver": goldSilverIcon,
};

const SYMBOL_TO_ICON: Record<string, CommodityIconId> = {
  GOLD: "gold",
  XAU: "gold",
  XAUUSD: "gold",
  "XAU/USD": "gold",
  SILVER: "silver",
  XAG: "silver",
  XAGUSD: "silver",
  "XAG/USD": "silver",
  PLATINUM: "platinum",
  XPT: "platinum",
  XPTUSD: "platinum",
  "XPT/USD": "platinum",
  PALLADIUM: "palladium",
  XPD: "palladium",
  XPDUSD: "palladium",
  "XPD/USD": "palladium",
  BTC: "btc-usd",
  BTCUSD: "btc-usd",
  "BTC/USD": "btc-usd",
  "BTC-USD": "btc-usd",
  "GOLD/SILVER": "gold-silver",
  "GOLD-SILVER": "gold-silver",
  GOLDSILVER: "gold-silver",
  XAUXAG: "gold-silver",
  "XAU/XAG": "gold-silver",
  GS: "gold-silver",
};

export function resolveCommodityIconId(symbol: string): CommodityIconId | null {
  const key = symbol.trim().toUpperCase().replace(/\s+/g, "");
  return SYMBOL_TO_ICON[key] ?? null;
}

export function resolveCommodityIconSrc(symbol: string): string | null {
  const id = resolveCommodityIconId(symbol);
  return id ? COMMODITY_ICON_SRC[id] : null;
}
