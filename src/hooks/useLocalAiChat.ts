import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api";
import type {
  LocalAiChatMessage,
  LocalAiChatStreamEvent,
  LocalAiStatusResponse,
  PlatformLocation,
} from "../types";

const DEFAULT_OLLAMA_MODEL = "qwen2.5:14b";

const TOOL_STATUS_LABELS: Record<string, string> = {
  search_platform_news: "Searching platform news",
  search_web_news: "Searching web (SerpApi)",
  web_research: "Web research",
  fetch_page_text: "Fetching page (Playwright)",
  open_reader_tab: "Opening Reader tab",
};

export interface ChatUiMessage extends LocalAiChatMessage {
  id: string;
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface UseLocalAiChatOptions {
  onOpenTab?: (url: string, title: string) => void;
}

export function useLocalAiChat(
  getContext: () => PlatformLocation,
  options?: UseLocalAiChatOptions
) {
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [status, setStatus] = useState<LocalAiStatusResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const onOpenTabRef = useRef(options?.onOpenTab);
  onOpenTabRef.current = options?.onOpenTab;

  const refreshStatus = useCallback(async () => {
    try {
      const resp = await apiFetch("/api/local-ai/status");
      const data = (await resp.json()) as LocalAiStatusResponse & {
        success?: boolean;
      };
      setStatus({
        ready: !!data.ready,
        model: data.model ?? DEFAULT_OLLAMA_MODEL,
        modelReady: !!data.modelReady,
        message: data.message,
        wealthBibleEnabled: data.wealthBibleEnabled,
        wealthBibleRuleCount: data.wealthBibleRuleCount,
        aiLocalToolsEnabled: data.aiLocalToolsEnabled,
        aiLocalSerpEnabled: data.aiLocalSerpEnabled,
        hasSerpApiKey: data.hasSerpApiKey,
        playwrightEnabled: data.playwrightEnabled,
      });
    } catch {
      setStatus({
        ready: false,
        model: DEFAULT_OLLAMA_MODEL,
        modelReady: false,
        message: "Could not reach local AI status endpoint.",
      });
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setToolStatus(null);
  }, []);

  const handleStreamEvent = useCallback(
    (payload: LocalAiChatStreamEvent, assistantId: string) => {
      if (payload.error) throw new Error(payload.error);
      if (payload.toolStatus) {
        const label =
          TOOL_STATUS_LABELS[payload.toolStatus.name] ??
          payload.toolStatus.name;
        setToolStatus(
          payload.toolStatus.state === "running"
            ? `${label}…`
            : null
        );
      }
      if (payload.openTab?.url) {
        onOpenTabRef.current?.(
          payload.openTab.url,
          payload.openTab.title ?? "Article"
        );
      }
      if (payload.delta) {
        const delta = payload.delta;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content + delta }
              : m
          )
        );
      }
    },
    []
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      setError(null);
      setToolStatus(null);
      const userMsg: ChatUiMessage = { id: newId(), role: "user", content: trimmed };
      const assistantId = newId();
      setMessages((prev) => [...prev, userMsg]);
      setStreaming(true);

      const history: LocalAiChatMessage[] = [
        ...messages.map(({ role, content }) => ({ role, content })),
        { role: "user", content: trimmed },
      ];

      const context = getContext();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const resp = await apiFetch("/api/local-ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            messages: history,
            context,
            stream: true,
          }),
        });

        if (!resp.ok) {
          const errBody = (await resp.json().catch(() => ({}))) as {
            message?: string;
          };
          throw new Error(errBody.message ?? `Chat failed (${resp.status})`);
        }

        if (!resp.body) throw new Error("No response stream");

        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: "" },
        ]);

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const event of events) {
            const line = event.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            const payload = JSON.parse(line.slice(6)) as LocalAiChatStreamEvent;
            handleStreamEvent(payload, assistantId);
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Chat failed";
        setError(message);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } finally {
        setStreaming(false);
        setToolStatus(null);
        abortRef.current = null;
      }
    },
    [streaming, messages, getContext, handleStreamEvent]
  );

  return {
    messages,
    streaming,
    error,
    toolStatus,
    status,
    refreshStatus,
    sendMessage,
    clearChat,
  };
}
