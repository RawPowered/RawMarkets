import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { Asset, DashboardLayoutV1, DashboardSkin, DashboardSortMode } from "../types";
import { apiFetch, readApiJson } from "../lib/api";
import {
  addSymbolToLayout,
  createDefaultLayout,
  flattenLayoutSymbols,
  newGroupId,
  DEFAULT_GROUP_COLOR,
  GROUP_COLOR_PRESETS,
} from "../lib/dashboardLayout";
import { applySortToLayoutGroups } from "../lib/dashboardSort";

interface UseDashboardLayoutOptions {
  pinnedSymbols: string[];
  setPinnedSymbols: Dispatch<SetStateAction<string[]>>;
  assets: Record<string, Asset>;
}

export function useDashboardLayout({
  pinnedSymbols,
  setPinnedSymbols,
  assets,
}: UseDashboardLayoutOptions) {
  const [layout, setLayout] = useState<DashboardLayoutV1>(() =>
    createDefaultLayout(pinnedSymbols)
  );
  const [editMode, setEditMode] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistLayout = useCallback(
    async (next: DashboardLayoutV1, syncPins = true) => {
      try {
        const resp = await apiFetch("/api/dashboard/layout", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ layout: next }),
        });
        if (resp.ok) {
          const data = await readApiJson<{
            layout?: DashboardLayoutV1;
            pinned?: string[];
          }>(resp);
          if (data.layout) setLayout(data.layout);
          if (syncPins && data.pinned) {
            setPinnedSymbols(data.pinned);
            try {
              localStorage.setItem("signalnode_pinned", JSON.stringify(data.pinned));
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        /* optional offline */
      }
    },
    [setPinnedSymbols]
  );

  const scheduleSave = useCallback(
    (next: DashboardLayoutV1) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void persistLayout(next);
      }, 300);
    },
    [persistLayout]
  );

  const commitLayout = useCallback(
    (next: DashboardLayoutV1, options?: { immediate?: boolean }) => {
      setLayout(next);
      const flat = flattenLayoutSymbols(next);
      setPinnedSymbols(flat);
      try {
        localStorage.setItem("signalnode_pinned", JSON.stringify(flat));
      } catch {
        /* ignore */
      }
      if (options?.immediate) {
        void persistLayout(next);
      } else {
        scheduleSave(next);
      }
    },
    [persistLayout, scheduleSave, setPinnedSymbols]
  );

  useEffect(() => {
    void (async () => {
      try {
        const resp = await apiFetch("/api/dashboard/layout");
        if (resp.ok) {
          const data = await readApiJson<{
            layout?: DashboardLayoutV1;
            pinned?: string[];
          }>(resp);
          if (data.layout) setLayout(data.layout);
          if (data.pinned && data.pinned.length > 0) {
            setPinnedSymbols(data.pinned);
            try {
              localStorage.setItem("signalnode_pinned", JSON.stringify(data.pinned));
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        /* server starting */
      } finally {
        setLoaded(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setLayout((prev) => {
      let next = prev;
      for (const sym of pinnedSymbols) {
        next = addSymbolToLayout(next, sym);
      }
      const pinnedSet = new Set(pinnedSymbols.map((s) => s.toUpperCase()));
      const pruned = {
        ...next,
        groups: next.groups.map((g) => ({
          ...g,
          symbols: g.symbols.filter((s) => pinnedSet.has(s.toUpperCase())),
        })),
      };
      return pruned;
    });
  }, [pinnedSymbols, loaded]);

  const handleLayoutChange = useCallback(
    (next: DashboardLayoutV1) => {
      commitLayout(next);
    },
    [commitLayout]
  );

  const handleSkinChange = useCallback(
    (skin: DashboardSkin) => {
      commitLayout({ ...layout, skin }, { immediate: true });
    },
    [commitLayout, layout]
  );

  const handleSortChange = useCallback(
    (sortMode: DashboardSortMode) => {
      const groups =
        sortMode === "manual"
          ? layout.groups
          : applySortToLayoutGroups(layout.groups, assets, sortMode);
      commitLayout({ ...layout, sortMode, groups }, { immediate: true });
    },
    [assets, commitLayout, layout]
  );

  const handleAddGroup = useCallback(() => {
    const name = `Group ${layout.groups.length + 1}`;
    const color =
      GROUP_COLOR_PRESETS[layout.groups.length % GROUP_COLOR_PRESETS.length] ??
      DEFAULT_GROUP_COLOR;
    commitLayout({
      ...layout,
      groups: [
        ...layout.groups,
        { id: newGroupId(), name, color, symbols: [], collapsed: false },
      ],
    });
  }, [commitLayout, layout]);

  const handleResetLayout = useCallback(() => {
    commitLayout(createDefaultLayout(pinnedSymbols), { immediate: true });
  }, [commitLayout, pinnedSymbols]);

  const handleGroupColorChange = useCallback(
    (groupId: string, color: string) => {
      commitLayout({
        ...layout,
        groups: layout.groups.map((g) => (g.id === groupId ? { ...g, color } : g)),
      });
    },
    [commitLayout, layout]
  );

  const handleSymbolAccentChange = useCallback(
    (symbol: string, color: string | null) => {
      const key = symbol.toUpperCase();
      const symbolAccents = { ...layout.symbolAccents };
      if (color) symbolAccents[key] = color;
      else delete symbolAccents[key];
      commitLayout({ ...layout, symbolAccents });
    },
    [commitLayout, layout]
  );

  return {
    layout,
    editMode,
    setEditMode,
    loaded,
    handleLayoutChange,
    handleSkinChange,
    handleSortChange,
    handleAddGroup,
    handleResetLayout,
    handleGroupColorChange,
    handleSymbolAccentChange,
  };
}
