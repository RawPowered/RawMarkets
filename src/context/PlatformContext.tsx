import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import type { Asset, PlatformLocation } from "../types";
import { labelForPage } from "../lib/pageLabels";

export interface PlatformSnapshotInput {
  activePage: string;
  selectedKey: string;
  activeCategory: string;
  searchQuery: string;
  pinnedSymbols: string[];
  assets: Record<string, Asset>;
}

export type PageDetailPatch = Pick<
  PlatformLocation,
  "newsBaySymbol" | "newsBayLane"
>;

interface PlatformContextValue {
  getSnapshot: () => PlatformLocation;
  formatLocationChip: (loc: PlatformLocation) => string;
  registerPageDetail: (pageId: string, detail: PageDetailPatch) => void;
  unregisterPageDetail: (pageId: string) => void;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

export function buildLocationSnapshot(input: PlatformSnapshotInput): PlatformLocation {
  const asset = input.assets[input.selectedKey];
  const loc: PlatformLocation = {
    page: input.activePage,
    pageLabel: labelForPage(input.activePage),
    capturedAt: new Date().toISOString(),
  };
  if (input.selectedKey) loc.selectedSymbol = input.selectedKey;
  if (input.activeCategory && input.activeCategory !== "ALL") {
    loc.activeCategory = input.activeCategory;
  }
  if (input.searchQuery.trim()) loc.searchQuery = input.searchQuery.trim();
  if (input.pinnedSymbols.length > 0) {
    loc.pinnedSymbols = [...input.pinnedSymbols];
  }
  if (asset) {
    loc.selectedAsset = {
      symbol: asset.symbol || input.selectedKey,
      name: asset.name,
      price: asset.current,
      changePercent: asset.changePercent,
      priceSource: asset.priceSource,
    };
  }
  return loc;
}

export function formatLocationChip(loc: PlatformLocation): string {
  const parts: string[] = [loc.pageLabel];
  if (loc.page === "news-bay" && loc.newsBayLane) {
    parts.push(`Lane: ${loc.newsBayLane}`);
  }
  if (loc.newsBaySymbol) parts.push(loc.newsBaySymbol);
  else if (loc.selectedSymbol) parts.push(loc.selectedSymbol);
  if (loc.activeCategory) parts.push(`Category: ${loc.activeCategory}`);
  if (loc.searchQuery) parts.push(`Search: "${loc.searchQuery}"`);
  return parts.join(" · ");
}

interface PlatformContextProviderProps {
  getSnapshotInput: () => PlatformSnapshotInput;
  children: React.ReactNode;
}

export function PlatformContextProvider({
  getSnapshotInput,
  children,
}: PlatformContextProviderProps) {
  const inputRef = useRef(getSnapshotInput);
  inputRef.current = getSnapshotInput;
  const pageDetailsRef = useRef<Record<string, PageDetailPatch>>({});

  const registerPageDetail = useCallback((pageId: string, detail: PageDetailPatch) => {
    pageDetailsRef.current[pageId] = detail;
  }, []);

  const unregisterPageDetail = useCallback((pageId: string) => {
    delete pageDetailsRef.current[pageId];
  }, []);

  const getSnapshot = useCallback((): PlatformLocation => {
    const base = buildLocationSnapshot(inputRef.current());
    const extra = pageDetailsRef.current[base.page];
    if (!extra) return base;
    return {
      ...base,
      ...extra,
      capturedAt: new Date().toISOString(),
    };
  }, []);

  const value = useMemo<PlatformContextValue>(
    () => ({
      getSnapshot,
      formatLocationChip,
      registerPageDetail,
      unregisterPageDetail,
    }),
    [getSnapshot, registerPageDetail, unregisterPageDetail]
  );

  return (
    <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>
  );
}

export function usePlatformContext(): PlatformContextValue {
  const ctx = useContext(PlatformContext);
  if (!ctx) {
    throw new Error("usePlatformContext must be used within PlatformContextProvider");
  }
  return ctx;
}

/** Register page-specific fields (e.g. News Bay symbol/lane) while mounted. */
export function useRegisterPageDetail(
  pageId: string,
  detail: PageDetailPatch | null
): void {
  const { registerPageDetail, unregisterPageDetail } = usePlatformContext();
  useEffect(() => {
    if (detail) {
      registerPageDetail(pageId, detail);
    }
    return () => unregisterPageDetail(pageId);
  }, [
    pageId,
    detail?.newsBaySymbol,
    detail?.newsBayLane,
    registerPageDetail,
    unregisterPageDetail,
  ]);
}
