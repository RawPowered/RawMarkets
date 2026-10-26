import React, { useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { apiFetch, readApiJson } from "../../lib/api";
import type { JournalEntryResponse, JournalUnfurlResponse } from "../../types";

interface AddLinkFormProps {
  onAdded: () => void;
}

export default function AddLinkForm({ onAdded }: AddLinkFormProps) {
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<JournalUnfurlResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await apiFetch("/api/journal/unfurl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await readApiJson<JournalUnfurlResponse>(resp);
      if (!data.success) throw new Error(data.message ?? "Unfurl failed");
      setPreview(data);
    } catch (err: unknown) {
      setPreview(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await apiFetch("/api/journal/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, notes: notes || null }),
      });
      const data = await readApiJson<JournalEntryResponse>(resp);
      if (!data.success) throw new Error(data.message ?? "Save failed");
      setUrl("");
      setNotes("");
      setPreview(null);
      onAdded();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-[#F5F5F7] border border-[#E5E8EB] rounded-2xl space-y-3">
      <div className="flex items-center gap-2">
        <Link2 size={14} className="text-[#007AFF]" />
        <span className="text-xs font-bold text-[#1D1D1F]">Add bookmark</span>
      </div>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://x.com/... or article URL"
        className="w-full px-3 py-2 text-xs bg-white border border-[#E5E8EB] rounded-xl outline-none focus:border-[#007AFF]"
      />
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Personal notes (optional)"
        className="w-full px-3 py-2 text-xs bg-white border border-[#E5E8EB] rounded-xl outline-none"
      />
      {preview && (
        <div className="p-3 bg-white border border-[#E5E8EB] rounded-xl text-[11px]">
          <span className="font-bold text-[#1D1D1F] block">{preview.title}</span>
          {preview.snippet && (
            <p className="text-[#86868B] mt-1 line-clamp-2">{preview.snippet}</p>
          )}
        </div>
      )}
      {error && (
        <p className="text-[11px] text-rose-600">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={loading || !url.trim()}
          onClick={() => void handlePreview()}
          className="flex-1 py-2 text-[10px] font-bold border border-[#E5E8EB] rounded-xl bg-white hover:bg-[#F5F5F7] disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin mx-auto" /> : "Preview"}
        </button>
        <button
          type="button"
          disabled={loading || !url.trim()}
          onClick={() => void handleSave()}
          className="flex-1 py-2 text-[10px] font-bold bg-[#007AFF] text-white rounded-xl disabled:opacity-50"
        >
          Save to Journal
        </button>
      </div>
    </div>
  );
}
