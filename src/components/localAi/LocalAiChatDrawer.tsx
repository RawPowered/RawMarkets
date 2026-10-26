import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bot, MessageCircle, Send, Trash2, X } from "lucide-react";
import { usePlatformContext } from "../../context/PlatformContext";
import { useReader } from "../../context/ReaderContext";
import { useLocalAiChat } from "../../hooks/useLocalAiChat";

interface LocalAiChatDrawerProps {
  open: boolean;
  onToggle: () => void;
}

export default function LocalAiChatDrawer({ open, onToggle }: LocalAiChatDrawerProps) {
  const { getSnapshot, formatLocationChip } = usePlatformContext();
  const { openUrl } = useReader();
  const { messages, streaming, error, toolStatus, status, sendMessage, clearChat, refreshStatus } =
    useLocalAiChat(getSnapshot, {
      onOpenTab: (url, title) => {
        openUrl(url, { title, openDrawer: true });
      },
    });
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const locationChip = formatLocationChip(getSnapshot());

  useEffect(() => {
    if (open) void refreshStatus();
  }, [open, refreshStatus]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = input;
      setInput("");
      await sendMessage(text);
    },
    [input, sendMessage]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(e);
    }
  };

  const ready = status?.ready === true;

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#1D1D1F] text-white shadow-lg shadow-zinc-900/25 transition hover:scale-105 hover:bg-zinc-800"
        title="Local AI (Ctrl+Shift+L)"
        aria-label="Toggle local AI assistant"
      >
        <MessageCircle size={22} />
        <span
          className={`absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-[#1D1D1F] ${
            ready ? "bg-[#34C759]" : "bg-amber-400"
          }`}
        />
      </button>

      {open && (
        <div
          className="fixed bottom-20 right-6 z-50 flex w-[min(100vw-2rem,400px)] flex-col overflow-hidden rounded-2xl border border-[#E5E8EB] bg-white shadow-2xl shadow-zinc-900/15"
          role="dialog"
          aria-label="Local AI assistant"
        >
          <header className="flex items-start justify-between gap-2 border-b border-[#E5E8EB] bg-[#F9FAFB] px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Bot size={16} className="shrink-0 text-[#007AFF]" />
                <span className="text-sm font-bold text-[#1D1D1F]">Local Copilot</span>
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${ready ? "bg-[#34C759]" : "bg-amber-400"}`}
                  title={ready ? "Local Copilot ready" : status?.message ?? "Local Copilot offline"}
                />
              </div>
              <p className="mt-1 truncate text-[10px] font-mono text-[#86868B]" title={locationChip}>
                {locationChip}
              </p>
              {status?.wealthBibleEnabled && (status.wealthBibleRuleCount ?? 0) > 0 && (
                <p className="mt-0.5 text-[9px] font-mono text-emerald-700">
                  Wealth Bible: {status.wealthBibleRuleCount} rules active
                </p>
              )}
              {status?.aiLocalToolsEnabled && (
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className="rounded-md bg-[#007AFF]/10 px-1.5 py-0.5 text-[9px] font-mono font-bold text-[#007AFF]">
                    Research tools
                  </span>
                  {status.playwrightEnabled && (
                    <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[9px] font-mono text-violet-700">
                      Page reader
                    </span>
                  )}
                  {status.aiLocalSerpEnabled && status.hasSerpApiKey && (
                    <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-mono text-emerald-700">
                      SerpApi
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => clearChat()}
                className="rounded-lg p-1.5 text-[#86868B] hover:bg-[#E5E8EB]/60"
                title="Clear chat"
              >
                <Trash2 size={14} />
              </button>
              <button
                type="button"
                onClick={onToggle}
                className="rounded-lg p-1.5 text-[#86868B] hover:bg-[#E5E8EB]/60"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </header>

          {!ready && status?.message && (
            <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-[10px] leading-relaxed text-amber-800">
              {status.message}
            </p>
          )}

          <div
            ref={listRef}
            className="flex max-h-[min(50vh,360px)] min-h-[200px] flex-1 flex-col gap-3 overflow-y-auto px-4 py-3"
          >
            {messages.length === 0 && (
              <p className="text-center text-xs text-[#86868B] leading-relaxed py-8">
                Ask about the screen you are on — symbol, page, or portfolio view. Runs free with Local Copilot.
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[92%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  m.role === "user"
                    ? "ml-auto bg-[#007AFF] text-white"
                    : "mr-auto bg-[#F5F5F7] text-[#1D1D1F]"
                }`}
              >
                {m.content || (streaming ? "…" : "")}
              </div>
            ))}
          </div>

          {toolStatus && (
            <p className="px-4 pb-1 text-[10px] font-mono text-[#007AFF]">{toolStatus}</p>
          )}

          {error && (
            <p className="px-4 pb-1 text-[10px] text-[#FF3B30]">{error}</p>
          )}

          <form onSubmit={handleSubmit} className="border-t border-[#E5E8EB] p-3">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about this view…"
                rows={2}
                disabled={streaming}
                className="flex-1 resize-none rounded-xl border border-[#E5E8EB] bg-[#FAFAFA] px-3 py-2 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF]/50 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={streaming || !input.trim()}
                className="flex h-auto shrink-0 items-center justify-center rounded-xl bg-[#1D1D1F] px-3 text-white disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="mt-1.5 text-[9px] text-[#86868B]">Enter send · Shift+Enter newline · Ctrl+Shift+L toggle</p>
          </form>
        </div>
      )}
    </>
  );
}
