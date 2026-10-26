import type { Asset } from "../types";

const CATEGORY_TINT: Record<Asset["category"], string> = {
  METALS: "#C9A227",
  ENERGY: "#FF9500",
  TECH: "#007AFF",
  MARKETS: "#AF52DE",
  FINANCE: "#5856D6",
};

export function categoryBrandTint(category: Asset["category"]): string {
  return CATEGORY_TINT[category] ?? "#007AFF";
}
