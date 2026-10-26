import React from "react";
import {
  Download,
  ExternalLink,
  RefreshCw,
  Trash2,
} from "lucide-react";
import type { JournalEntry } from "../../types";
import { journalMediaUrl } from "../../lib/journalMedia";

interface JournalSocialCardProps {
  entry: JournalEntry;
  onOpen: (entry: JournalEntry) => void;
  onRefresh: (id: number) => void;
  onDownload: (id: number) => void;
  onDelete: (id: number) => void;
}

export default function JournalSocialCard({
  entry,
  onOpen,
  onRefresh,
  onDownload,
  onDelete,
}: JournalSocialCardProps) {
  const snap = entry.snapshot;
  const author = snap?.author ?? entry.source ?? "X User";
  const text = snap?.text ?? entry.snippet ?? entry.title;

  const images = entry.media.filter((m) => m.type === "image");
  const videos = entry.media.filter((m) => m.type === "video");

  function mediaSrc(item: (typeof entry.media)[0]): string {
    if (item.localPath) return journalMediaUrl(entry.id, item.localPath);
    return item.remoteUrl;
  }

  return (
    <div className="p-4 bg-white border border-[#E5E8EB] rounded-2xl space-y-3 hover:border-[#86868B] transition-all">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-[#1D1D1F] text-white flex items-center justify-center text-xs font-bold">
          {author.charAt(0).toUpperCase()}
        </div>
        <div>
          <span className="text-xs font-bold text-[#1D1D1F] block">{author}</span>
          <span className="text-[9px] text-[#86868B] font-mono">@ X snapshot</span>
        </div>
      </div>

      <p className="text-sm text-[#1D1D1F] leading-relaxed whitespace-pre-wrap">
        {text}
      </p>

      {images.map((img, i) => (
        <img
          key={i}
          src={mediaSrc(img)}
          alt=""
          className="w-full max-h-64 object-cover rounded-xl border border-[#E5E8EB]"
        />
      ))}

      {videos.map((vid, i) => (
        <div
          key={i}
          className="relative rounded-xl border border-[#E5E8EB] overflow-hidden bg-[#F5F5F7]"
        >
          {vid.localPath ? (
            <video
              src={mediaSrc(vid)}
              controls
              className="w-full max-h-64"
            />
          ) : (
            <div className="p-4 text-center space-y-2">
              <p className="text-[11px] text-[#86868B]">
                Video not stored locally
                {vid.downloadError ? `: ${vid.downloadError}` : ""}
              </p>
              <a
                href={entry.url}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-bold text-[#007AFF] inline-flex items-center gap-1"
              >
                View live on X
                <ExternalLink size={10} />
              </a>
            </div>
          )}
        </div>
      ))}

      {snap?.embedHtml && !images.length && !videos.length && (
        <div
          className="text-sm border border-[#E5E8EB] rounded-xl p-3 bg-[#F5F5F7] prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: snap.embedHtml }}
        />
      )}

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E5E8EB]/55">
        <button
          type="button"
          onClick={() => onOpen(entry)}
          className="text-[10px] font-bold text-[#007AFF]"
        >
          Open in reader
        </button>
         <a
          href={entry.url}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] font-bold text-[#86868B] inline-flex items-center gap-0.5"
        >
          View live post
          <ExternalLink size={10} />
        </a>
        <button type="button" onClick={() => onRefresh(entry.id)} className="p-1 hover:bg-[#F5F5F7] rounded">
          <RefreshCw size={12} className="text-[#86868B]" />
        </button>
        <button type="button" onClick={() => onDownload(entry.id)} className="p-1 hover:bg-[#F5F5F7] rounded">
          <Download size={12} className="text-[#86868B]" />
        </button>
        <button type="button" onClick={() => onDelete(entry.id)} className="p-1 hover:bg-rose-50 rounded ml-auto">
          <Trash2 size={12} className="text-rose-500" />
        </button>
      </div>
    </div>
  );
}
