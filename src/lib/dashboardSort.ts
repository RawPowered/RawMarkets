import type { Asset, DashboardSortMode } from "../types";

export function parseChangePercentNumber(
  changePercent: string | undefined
): number | null {
  if (!changePercent) return null;
  const n = parseFloat(changePercent.replace("%", "").trim());
  return Number.isFinite(n) ? n : null;
}

function sortKey(
  symbol: string,
  assets: Record<string, Asset>,
  mode: DashboardSortMode
): number | string {
  const asset = assets[symbol];
  if (!asset) return mode === "name" ? symbol : -Infinity;

  switch (mode) {
    case "gainers":
    case "losers": {
      const pct = parseChangePercentNumber(asset.changePercent);
      if (pct == null || asset.priceSource === "unavailable") return -Infinity;
      return pct;
    }
    case "name":
      return asset.symbol.toUpperCase();
    case "price_desc":
    case "price_asc": {
      if (asset.priceSource === "unavailable" || !Number.isFinite(asset.current)) {
        return -Infinity;
      }
      return asset.current;
    }
    default:
      return 0;
  }
}

export function sortSymbols(
  symbols: string[],
  assets: Record<string, Asset>,
  mode: DashboardSortMode
): string[] {
  if (mode === "manual") return [...symbols];

  const copy = [...symbols];
  copy.sort((a, b) => {
    const ka = sortKey(a, assets, mode);
    const kb = sortKey(b, assets, mode);

    if (typeof ka === "string" && typeof kb === "string") {
      return ka.localeCompare(kb);
    }

    const na = ka as number;
    const nb = kb as number;

    if (na === -Infinity && nb === -Infinity) return a.localeCompare(b);
    if (na === -Infinity) return 1;
    if (nb === -Infinity) return -1;

    if (mode === "name") {
      return String(ka).localeCompare(String(kb));
    }
    if (mode === "losers" || mode === "price_asc") {
      return na < nb ? -1 : na > nb ? 1 : 0;
    }
    return nb - na;
  });
  return copy;
}

export function applySortToLayoutGroups(
  groups: { symbols: string[] }[],
  assets: Record<string, Asset>,
  mode: DashboardSortMode
): { symbols: string[] }[] {
  return groups.map((g) => ({
    ...g,
    symbols: sortSymbols(g.symbols, assets, mode),
  }));
}
