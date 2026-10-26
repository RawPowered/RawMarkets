import React, { useState } from "react";
import {
  ArrowLeft,
  BookmarkPlus,
  BookOpen,
  RefreshCw,
  X,
} from "lucide-react";
import { openExternalUrl } from "../../lib/openExternal";
import { useReader } from "../../context/ReaderContext";
import ReaderViewport from "./ReaderViewport";

interface ReaderChromeProps {
  embedded?: boolean;
  onClipMessage?: (msg: string) => void;
}

export default function ReaderChrome({
  embedded = false,
  onClipMessage,
}: ReaderChromeProps) {
  const {
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    refreshTab,
    clipActiveTab,
    goToJournal,
    refreshNonce,
    isElectron,
  } = useReader();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [urlInput, setUrlInput] = useState(activeTab?.url ?? "");
  const [clipStatus, setClipStatus] = useState<string | null>(null);

  React.useEffect(() => {
    setUrlInput(activeTab?.url ?? "");
  }, [activeTab?.url, activeTabId]);

  const handleNavigate = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    void openExternalUrl(url);
  };

  const handleClip = async () => {
    const result = await clipActiveTab();
    const msg = result.message ?? (result.ok ? "Saved" : "Failed");
    setClipStatus(msg);
    onClipMessage?.(msg);
    setTimeout(() => setClipStatus(null), 2500);
  };

  return (
    <div
      className={`flex flex-col bg-white border border-[#E5E8EB] rounded-2xl overflow-hidden ${
        embedded ? "h-full min-h-[420px]" : "h-full"
      }`}
    >
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[#E5E8EB] bg-[#F5F5F7] overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`group flex items-center gap-1 max-w-[160px] px-2 py-1 rounded-lg text-[10px] font-semibold shrink-0 ${
              tab.id === activeTabId
                ? "bg-white border border-[#E5E8EB] text-[#1D1D1F]"
                : "text-[#86868B] hover:bg-white/80"
            }`}
          >
            <span className="truncate">{tab.title}</span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  closeTab(tab.id);
                }
              }}
              className="opacity-60 hover:opacity-100 p-0.5"
            >
              <X size={10} />
            </span>
          </button>
        ))}
        {tabs.length === 0 && (
          <span className="text-[10px] text-[#86868B] px-2 font-mono">
            No tabs open
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 p-2 border-b border-[#E5E8EB]">
        <button
          type="button"
          onClick={() => activeTab?.url && void openExternalUrl(activeTab.url)}
          disabled={!activeTab?.url}
          className="p-1.5 rounded-lg hover:bg-[#F5F5F7] disabled:opacity-40"
          title="Open in default browser"
        >
          <ArrowLeft size={14} />
        </button>
        <button
          type="button"
          onClick={() => refreshTab()}
          className="p-1.5 rounded-lg hover:bg-[#F5F5F7]"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleNavigate();
          }}
          placeholder="Paste URL — opens in default browser"
          className="flex-1 min-w-[120px] px-2 py-1.5 text-xs bg-[#F5F5F7] border border-[#E5E8EB] rounded-lg outline-none focus:border-[#007AFF]"
        />
        <button
          type="button"
          onClick={handleNavigate}
          className="px-2 py-1.5 text-[10px] font-bold bg-[#007AFF] text-white rounded-lg"
        >
          Go
        </button>
        <button
          type="button"
          onClick={() => void handleClip()}
          className="p-1.5 rounded-lg hover:bg-[#F0F7FF] text-[#007AFF]"
          title="Clip to Journal"
        >
          <BookmarkPlus size={14} />
        </button>
        <button
          type="button"
          onClick={goToJournal}
          className="p-1.5 rounded-lg hover:bg-[#F5F5F7]"
          title="Open Investors Journal"
        >
          <BookOpen size={14} />
        </button>
      </div>

      {clipStatus && (
        <div className="px-3 py-1 text-[10px] font-mono font-bold text-[#34C759] bg-[#34C759]/5 border-b border-[#34C759]/20">
          {clipStatus}
        </div>
      )}

      <div className="relative flex-1 min-h-[280px] bg-[#F5F5F7]">
        {tabs.map((tab) => (
          <div
            key={`${tab.id}-${refreshNonce}`}
            className={`absolute inset-0 ${tab.id === activeTabId ? "block" : "hidden"}`}
          >
            <ReaderViewport
              tab={tab}
              isActive={tab.id === activeTabId}
              refreshNonce={refreshNonce}
              isElectron={isElectron}
            />
          </div>
        ))}
        {tabs.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-[#86868B]">
            Open an article preview or paste a URL to open in your browser
          </div>
        )}
      </div>
    </div>
  );
}
