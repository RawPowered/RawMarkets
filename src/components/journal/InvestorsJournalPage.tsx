import React, { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { apiFetch, readApiJson } from "../../lib/api";
import type { JournalEntriesResponse, JournalEntry } from "../../types";
import { useReader } from "../../context/ReaderContext";
import AddLinkForm from "./AddLinkForm";
import JournalEntryCard from "./JournalEntryCard";
import JournalSocialCard from "./JournalSocialCard";
import ReaderChrome from "../reader/ReaderChrome";

export default function InvestorsJournalPage() {
  const { openUrl } = useReader();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (filter !== "all") params.set("type", filter);
      const qs = params.toString();
      const resp = await apiFetch(`/api/journal/entries${qs ? `?${qs}` : ""}`);
      const data = await readApiJson<JournalEntriesResponse>(resp);
      if (data.success) setEntries(data.entries);
    } catch (err) {
      console.error("Journal load failed", err);
    } finally {
      setLoading(false);
    }
  }, [search, filter]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const handleOpen = (entry: JournalEntry) => {
    if (entry.url && !entry.url.startsWith("news://")) {
      openUrl(entry.url, { title: entry.title, openDrawer: true });
    } else {
      openUrl("#", {
        previewOnly: true,
        previewTitle: entry.title,
        previewSnippet: entry.snippet ?? undefined,
        title: entry.title,
        openDrawer: true,
      });
    }
  };

  const handleRefresh = async (id: number) => {
    await apiFetch(`/api/journal/entries/${id}/refresh`, { method: "POST" });
    void loadEntries();
  };

  const handleDownload = async (id: number) => {
    await apiFetch(`/api/journal/entries/${id}/download-media`, {
      method: "POST",
    });
    void loadEntries();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remove this journal entry?")) return;
    await apiFetch(`/api/journal/entries/${id}`, { method: "DELETE" });
    void loadEntries();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 border border-[#E5E8EB] rounded-[32px] shadow-xs">
        <h2 className="text-lg font-bold text-[#1D1D1F] tracking-tight">
          Investors Journal
        </h2>
        <p className="text-xs text-[#86868B] mt-1 leading-relaxed">
          Clip news, bookmark links, and save social posts with hybrid snapshots.
          Articles open in your default browser; snippet-only clips preview in-app.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5 space-y-4">
          <AddLinkForm onAdded={() => void loadEntries()} />

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B]"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clips..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E5E8EB] rounded-xl outline-none"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-xs border border-[#E5E8EB] rounded-xl px-2 bg-white"
            >
              <option value="all">All</option>
              <option value="news_clip">News</option>
              <option value="social_x">X / Social</option>
              <option value="article">Articles</option>
              <option value="manual">Manual</option>
            </select>
          </div>

          {loading ? (
            <div className="h-32 flex items-center justify-center">
              <span className="w-5 h-5 border-2 border-[#E5E8EB] border-t-[#007AFF] rounded-full animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-xs text-[#86868B] text-center py-8 border border-dashed border-[#E5E8EB] rounded-2xl">
              No clips yet. Add a link or clip from the news feed.
            </p>
          ) : (
            <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {entries.map((entry) =>
                entry.entry_type === "social_x" ? (
                  <div key={entry.id}>
                  <JournalSocialCard
                    entry={entry}
                    onOpen={handleOpen}
                    onRefresh={handleRefresh}
                    onDownload={handleDownload}
                    onDelete={handleDelete}
                  />
                  </div>
                ) : (
                  <div key={entry.id}>
                  <JournalEntryCard
                    entry={entry}
                    onOpen={handleOpen}
                    onRefresh={handleRefresh}
                    onDownload={handleDownload}
                    onDelete={handleDelete}
                  />
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <div className="xl:col-span-7 min-h-[520px]">
          <ReaderChrome embedded onClipMessage={() => void loadEntries()} />
        </div>
      </div>
    </div>
  );
}
