import type { DashboardLayoutV1, DashboardSkin, DashboardSortMode } from "../types";

export const DEFAULT_GROUP_COLOR = "#007AFF";

export const GROUP_COLOR_PRESETS = [
  "#007AFF",
  "#34C759",
  "#FF9500",
  "#FF3B30",
  "#AF52DE",
  "#C9A227",
  "#5AC8FA",
  "#86868B",
];

export function newGroupId(): string {
  return `g-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createDefaultLayout(pinnedSymbols: string[] = []): DashboardLayoutV1 {
  const symbols = pinnedSymbols.map((s) => s.toUpperCase());
  return {
    version: 1,
    skin: "classic",
    sortMode: "manual",
    groups: [
      {
        id: "watchlist-default",
        name: "Watchlist",
        color: DEFAULT_GROUP_COLOR,
        symbols,
      },
    ],
    symbolAccents: {},
  };
}

export function flattenLayoutSymbols(layout: DashboardLayoutV1): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of layout.groups) {
    for (const sym of group.symbols) {
      const key = sym.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

export function pruneLayoutSymbols(
  layout: DashboardLayoutV1,
  validSymbols: Set<string>
): DashboardLayoutV1 {
  const groups = layout.groups.map((g) => ({
    ...g,
    symbols: g.symbols
      .map((s) => s.toUpperCase())
      .filter((s) => validSymbols.has(s)),
  }));
  const symbolAccents: Record<string, string> = {};
  for (const [sym, color] of Object.entries(layout.symbolAccents)) {
    const key = sym.toUpperCase();
    if (validSymbols.has(key)) symbolAccents[key] = color;
  }
  return { ...layout, groups, symbolAccents };
}

export function mergePinnedIntoLayout(
  layout: DashboardLayoutV1,
  pinnedSymbols: string[]
): DashboardLayoutV1 {
  const pinned = pinnedSymbols.map((s) => s.toUpperCase());
  const inLayout = new Set(flattenLayoutSymbols(layout));
  const missing = pinned.filter((s) => !inLayout.has(s));
  if (missing.length === 0) {
    return pruneLayoutSymbols(layout, new Set(pinned));
  }
  const groups = layout.groups.map((g) => ({ ...g, symbols: [...g.symbols] }));
  if (groups.length === 0) {
    return createDefaultLayout(pinned);
  }
  const target = groups[groups.length - 1];
  target.symbols.push(...missing);
  return pruneLayoutSymbols({ ...layout, groups }, new Set(pinned));
}

export function removeSymbolFromLayout(
  layout: DashboardLayoutV1,
  symbol: string
): DashboardLayoutV1 {
  const key = symbol.toUpperCase();
  const groups = layout.groups.map((g) => ({
    ...g,
    symbols: g.symbols.filter((s) => s.toUpperCase() !== key),
  }));
  const symbolAccents = { ...layout.symbolAccents };
  delete symbolAccents[key];
  return { ...layout, groups, symbolAccents };
}

export function addSymbolToLayout(
  layout: DashboardLayoutV1,
  symbol: string
): DashboardLayoutV1 {
  const key = symbol.toUpperCase();
  const flat = flattenLayoutSymbols(layout);
  if (flat.includes(key)) return layout;
  const groups = layout.groups.map((g) => ({ ...g, symbols: [...g.symbols] }));
  if (groups.length === 0) {
    return createDefaultLayout([key]);
  }
  groups[groups.length - 1].symbols.push(key);
  return { ...layout, groups };
}

export function parseDashboardLayout(raw: unknown): DashboardLayoutV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  if (!Array.isArray(o.groups)) return null;
  const skin = o.skin as DashboardSkin;
  const sortMode = o.sortMode as DashboardSortMode;
  const validSkins: DashboardSkin[] = [
    "classic",
    "compact",
    "terminal",
    "minimal",
    "branded",
  ];
  const validSort: DashboardSortMode[] = [
    "manual",
    "gainers",
    "losers",
    "name",
    "price_desc",
    "price_asc",
  ];
  return {
    version: 1,
    skin: validSkins.includes(skin) ? skin : "classic",
    sortMode: validSort.includes(sortMode) ? sortMode : "manual",
    groups: o.groups.map((g: Record<string, unknown>) => ({
      id: String(g.id ?? newGroupId()),
      name: String(g.name ?? "Group"),
      color: String(g.color ?? DEFAULT_GROUP_COLOR),
      collapsed: !!g.collapsed,
      symbols: Array.isArray(g.symbols)
        ? g.symbols.map((s) => String(s).toUpperCase())
        : [],
    })),
    symbolAccents:
      o.symbolAccents && typeof o.symbolAccents === "object"
        ? Object.fromEntries(
            Object.entries(o.symbolAccents as Record<string, string>).map(
              ([k, v]) => [k.toUpperCase(), String(v)]
            )
          )
        : {},
  };
}
