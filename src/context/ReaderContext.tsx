import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { openExternalUrl } from "../lib/openExternal";
import { apiFetch, readApiJson } from "../lib/api";
import type { JournalEntryResponse } from "../types";

export interface ReaderTab {
  id: string;
  url: string;
  title: string;
  previewOnly?: boolean;
  previewTitle?: string;
  previewSnippet?: string;
}

export interface OpenUrlOptions {
  title?: string;
  openDrawer?: boolean;
  previewOnly?: boolean;
  previewTitle?: string;
  previewSnippet?: string;
}

interface ReaderContextValue {
  tabs: ReaderTab[];
  activeTabId: string | null;
  isDrawerOpen: boolean;
  openUrl: (url: string, options?: OpenUrlOptions) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  refreshTab: (tabId?: string) => void;
  navigateTab: (url: string, tabId?: string) => void;
  closeDrawer: () => void;
  openDrawer: () => void;
  clipActiveTab: () => Promise<{ ok: boolean; message?: string }>;
  goToJournal: () => void;
  refreshNonce: number;
  isElectron: boolean;
}

const ReaderContext = createContext<ReaderContextValue | null>(null);

function newTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isBrowsableUrl(url: string): boolean {
  return !!url && url !== "#" && !url.startsWith("news://");
}

export function ReaderProvider({
  children,
  onNavigateToJournal,
}: {
  children: React.ReactNode;
  onNavigateToJournal?: () => void;
}) {
  const [tabs, setTabs] = useState<ReaderTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const isElectron =
    typeof navigator !== "undefined" &&
    /Electron/i.test(navigator.userAgent);

  const openUrl = useCallback((url: string, options?: OpenUrlOptions) => {
    const previewOnly =
      options?.previewOnly || !isBrowsableUrl(url);

    if (!previewOnly && isBrowsableUrl(url)) {
      void openExternalUrl(url);
      return;
    }

    const title =
      options?.title ||
      options?.previewTitle ||
      (previewOnly ? "Article preview" : url);

    setTabs((prev) => {
      const existing = prev.find(
        (t) => t.url === url && t.previewOnly === previewOnly
      );
      if (existing) {
        setActiveTabId(existing.id);
        return prev;
      }
      const tab: ReaderTab = {
        id: newTabId(),
        url: previewOnly ? "" : url,
        title,
        previewOnly,
        previewTitle: options?.previewTitle,
        previewSnippet: options?.previewSnippet,
      };
      setActiveTabId(tab.id);
      return [...prev, tab];
    });

    if (options?.openDrawer !== false) {
      setIsDrawerOpen(true);
    }
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== tabId);
      setActiveTabId((current) => {
        if (current !== tabId) return current;
        return next.length ? next[next.length - 1].id : null;
      });
      if (next.length === 0) setIsDrawerOpen(false);
      return next;
    });
  }, []);

  const setActiveTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const refreshTab = useCallback((tabId?: string) => {
    setRefreshNonce((n) => n + 1);
    void tabId;
  }, []);

  const navigateTab = useCallback(
    (url: string, tabId?: string) => {
      if (isBrowsableUrl(url)) {
        void openExternalUrl(url);
        return;
      }

      const targetId = tabId ?? activeTabId;
      if (!targetId) {
        openUrl(url);
        return;
      }
      setTabs((prev) =>
        prev.map((t) =>
          t.id === targetId
            ? {
                ...t,
                url,
                title: url,
                previewOnly: !isBrowsableUrl(url),
                previewTitle: undefined,
                previewSnippet: undefined,
              }
            : t
        )
      );
      setRefreshNonce((n) => n + 1);
    },
    [activeTabId, openUrl]
  );

  const clipActiveTab = useCallback(async () => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) {
      return { ok: false, message: "No active tab" };
    }
    const url = tab.url || tab.previewTitle || "about:blank";
    if (tab.previewOnly && !tab.previewTitle) {
      return { ok: false, message: "Nothing to clip" };
    }
    try {
      if (tab.previewOnly) {
        const resp = await apiFetch("/api/journal/clip-news", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: tab.previewTitle ?? "Clipped article",
            snippet: tab.previewSnippet ?? "",
            source: "Reader",
            link: "#",
            date: "Just now",
            sentiment: "Neutral",
            score: 0,
          }),
        });
        const data = await readApiJson<JournalEntryResponse>(resp);
        if (!data.success) throw new Error(data.message ?? "Clip failed");
        return { ok: true, message: data.duplicate ? "Already in journal" : "Saved to journal" };
      }

      const resp = await apiFetch("/api/journal/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: tab.url, title: tab.title }),
      });
      const data = await readApiJson<JournalEntryResponse>(resp);
      if (!data.success) throw new Error(data.message ?? "Clip failed");
      return { ok: true, message: data.duplicate ? "Already in journal" : "Saved to journal" };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, message: msg };
    }
  }, [activeTabId, tabs]);

  const value = useMemo<ReaderContextValue>(
    () => ({
      tabs,
      activeTabId,
      isDrawerOpen,
      openUrl,
      closeTab,
      setActiveTab,
      refreshTab,
      navigateTab,
      closeDrawer: () => setIsDrawerOpen(false),
      openDrawer: () => setIsDrawerOpen(true),
      clipActiveTab,
      goToJournal: () => onNavigateToJournal?.(),
      refreshNonce,
      isElectron,
    }),
    [
      tabs,
      activeTabId,
      isDrawerOpen,
      openUrl,
      closeTab,
      setActiveTab,
      refreshTab,
      navigateTab,
      clipActiveTab,
      onNavigateToJournal,
      refreshNonce,
      isElectron,
    ]
  );

  return (
    <ReaderContext.Provider value={value}>{children}</ReaderContext.Provider>
  );
}

export function useReader(): ReaderContextValue {
  const ctx = useContext(ReaderContext);
  if (!ctx) {
    throw new Error("useReader must be used within ReaderProvider");
  }
  return ctx;
}

export function useReaderOptional(): ReaderContextValue | null {
  return useContext(ReaderContext);
}
