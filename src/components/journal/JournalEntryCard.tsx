import React from "react";
import {
  ArrowUpRight,
  Download,
  ExternalLink,
  RefreshCw,
  Trash2,
} from "lucide-react";
import type { JournalEntry } from "../../types";
import { journalMediaUrl } from "../../lib/journalMedia";

interface JournalEntryCardProps {
  entry: JournalEntry;
  onOpen: (entry: JournalEntry) => void;
  onRefresh: (id: number) => void;
  onDownload: (id: number) => void;
  onDelete: (id: number) => void;
}

export default function JournalEntryCard({
  entry,
  onOpen,
  onRefresh,
  onDownload,
  onDelete,
}: JournalEntryCardProps) {
  const imageUrl =
    entry.media.find((m) => m.type === "image" && m.localPath)?.localPath
      ? journalMediaUrl(
          entry.id,
          entry.media.find((m) => m.type === "image" && m.localPath)!.localPath!
        )
      : entry.snapshot?.imageUrl ?? null;

  return (
    <div className="p-4 bg-white border border-[#E5E8EB] hover:border-[#86868B] rounded-2xl transition-all space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          {entry.source && (
            <span className="text-[9px] font-extrabold font-mono bg-[#F5F5F7] border border-[#E5E8EB] px-2 py-0.5 rounded-md">
              {entry.source}
            </span>
          )}
          <h4 className="text-xs font-bold text-[#1D1D1F] leading-snug line-clamp-2">
            {entry.title}
          </h4>
          {entry.snippet && (
            <p className="text-[11px] text-[#86868B] line-clamp-2">{entry.snippet}</p>
          )}
        </div>
        {entry.sentiment && (
          <span className="text-[9px] font-extrabold px-2 py-0.5 rounded font-mono shrink-0 bg-[#86868B]/10 text-[#86868B]">
            {entry.sentiment}
          </span>
        )}
      </div>

      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="w-full h-32 object-cover rounded-xl border border-[#E5E8EB]"
        />
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#E5E8EB]/55">
        <button
          type="button"
          onClick={() => onOpen(entry)}
          className="text-[10px] font-bold text-[#007AFF] inline-flex items-center gap-0.5"
        >
          Open
          <ArrowUpRight size={10} />
        </button>
        {entry.url && !entry.url.startsWith("news://") && (
          <a
            href={entry.url}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] font-bold text-[#86868B] inline-flex items-center gap-0.5"
          >
            Live
            <ExternalLink size={10} />
          </a>
        )}
        <button
          type="button"
          onClick={() => onRefresh(entry.id)}
          className="p-1 hover:bg-[#F5F5F7] rounded"
          title="Refresh snapshot"
        >
          <RefreshCw size={12} className="text-[#86868B]" />
        </button>
        <button
          type="button"
          onClick={() => onDownload(entry.id)}
          className="p-1 hover:bg-[#F5F5F7] rounded"
          title="Download media"
        >
          <Download size={12} className="text-[#86868B]" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(entry.id)}
          className="p-1 hover:bg-rose-50 rounded ml-auto"
          title="Delete"
        >
          <Trash2 size={12} className="text-rose-500" />
        </button>
      </div>
    </div>
  );
}
