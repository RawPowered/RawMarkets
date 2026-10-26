import { getEngineSettings } from "./db";
import { checkOllamaReady } from "./ollamaExtract";
import {
  DEFAULT_OLLAMA_MODEL,
  ollamaNotReadyMessage,
  resolveOllamaModel,
} from "./ollamaDefaults";
import { buildWealthBibleRuleSpacePrompt } from "./wealthBibleRuleSpace";
import type {
  LocalAiChatMessage,
  LocalAiDataContext,
  PlatformLocation,
} from "../types";

export const DEFAULT_CHAT_MODEL = DEFAULT_OLLAMA_MODEL;
export const DEFAULT_OLLAMA_BASE = "http://127.0.0.1:11434";

export function resolveOllamaChatModel(): string {
  return resolveOllamaModel();
}

export function buildLocalAiSystemPrompt(
  context: PlatformLocation,
  platformData: LocalAiDataContext,
  options?: { researchToolsEnabled?: boolean }
): string {
  const settings = getEngineSettings();
  const ruleSpace = buildWealthBibleRuleSpacePrompt(settings);
  const ruleSpaceBlock = ruleSpace ? `${ruleSpace}\n\n` : "";
  const toolsOn = options?.researchToolsEnabled ?? false;

  const groundingRules = toolsOn
    ? `- Start from platformLocation and platformData below; extend with research tool results when tools are enabled.
- Never fabricate articles, prices, or URLs not from platformData or tool output.
- You have server-side research tools (SQLite news, optional SerpApi, Playwright page read, Reader tabs) — use them instead of telling the user to browse manually.`
    : `- Ground every answer in platformLocation and platformData below.
- Never fabricate articles, prices, or research not listed in platformData.`;

  return `${ruleSpaceBlock}You are RawMarkets Local Copilot — a free on-device assistant inside the Raw Investor Markets Terminal.

Rules:
${groundingRules}
- When Wealth Bible Rule Space principles above are enabled, they take precedence over casual trade ideas.
- If the user asks what they are viewing, use selectedSymbol, page, and selectedAsset from platformLocation.
- Use platformData.articles and platformData.portfolioNews for news; cite headlines by title when relevant.
- Use platformData.quotes for prices and platformData.research for portfolio signals.
- If platformData.articles is empty, say RSS may not be ingested yet (suggest launcher refresh or News Bay).
- Keep replies concise and actionable unless the user asks for depth.
- You are not Gemini; you run locally via Ollama.

platformLocation:
${JSON.stringify(context, null, 2)}

platformData:
${JSON.stringify(platformData, null, 2)}`;
}

export interface OllamaChatOptions {
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface OllamaToolCall {
  id?: string;
  type?: string;
  function: { name: string; arguments: string | Record<string, unknown> };
}

export interface OllamaChatMessage {
  role: string;
  content?: string;
  tool_calls?: OllamaToolCall[];
  tool_name?: string;
}

interface OllamaChatLine {
  message?: OllamaChatMessage;
  done?: boolean;
  error?: string;
}

export interface OllamaToolRoundResult {
  content: string;
  tool_calls: OllamaToolCall[];
}

function buildOllamaPayload(
  systemPrompt: string,
  messages: OllamaChatMessage[],
  options: {
    model: string;
    stream: boolean;
    tools?: typeof import("./localAiTools").LOCAL_AI_TOOL_DEFINITIONS;
  }
): Record<string, unknown> {
  const ollamaMessages: OllamaChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];
  const body: Record<string, unknown> = {
    model: options.model,
    messages: ollamaMessages,
    stream: options.stream,
    options: { temperature: 0.4 },
  };
  if (options.tools?.length) {
    body.tools = options.tools;
    body.tool_choice = "auto";
  }
  return body;
}

/** Single non-streaming chat round; may return tool_calls. */
export async function chatOllamaToolRound(
  messages: OllamaChatMessage[],
  systemPrompt: string,
  tools: typeof import("./localAiTools").LOCAL_AI_TOOL_DEFINITIONS,
  options?: OllamaChatOptions
): Promise<OllamaToolRoundResult> {
  const model = options?.model ?? resolveOllamaChatModel();
  const baseUrl = options?.baseUrl ?? DEFAULT_OLLAMA_BASE;
  const timeoutMs = options?.timeoutMs ?? 120_000;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  const resp = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
    body: JSON.stringify(
      buildOllamaPayload(systemPrompt, messages, {
        model,
        stream: false,
        tools,
      })
    ),
  });
  clearTimeout(t);

  if (!resp.ok) {
    throw new Error(`Ollama HTTP ${resp.status}`);
  }

  const data = (await resp.json()) as OllamaChatLine;
  const msg = data.message;
  const tool_calls = msg?.tool_calls ?? [];
  return {
    content: msg?.content?.trim() ?? "",
    tool_calls,
  };
}

/** Stream final assistant message (no tools in request). */
export async function streamOllamaAgentReply(
  messages: OllamaChatMessage[],
  systemPrompt: string,
  onDelta: (text: string) => void,
  options?: OllamaChatOptions
): Promise<void> {
  const model = options?.model ?? resolveOllamaChatModel();
  const baseUrl = options?.baseUrl ?? DEFAULT_OLLAMA_BASE;
  const timeoutMs = options?.timeoutMs ?? 180_000;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  const resp = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
    body: JSON.stringify(
      buildOllamaPayload(systemPrompt, messages, {
        model,
        stream: true,
      })
    ),
  });

  if (!resp.ok) {
    clearTimeout(t);
    throw new Error(`Ollama HTTP ${resp.status}`);
  }

  if (!resp.body) {
    clearTimeout(t);
    throw new Error("Ollama returned no response body");
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let parsed: OllamaChatLine;
        try {
          parsed = JSON.parse(trimmed) as OllamaChatLine;
        } catch {
          continue;
        }
        if (parsed.error) throw new Error(parsed.error);
        const chunk = parsed.message?.content;
        if (chunk) onDelta(chunk);
      }
    }
    const tail = buffer.trim();
    if (tail) {
      const parsed = JSON.parse(tail) as OllamaChatLine;
      if (parsed.error) throw new Error(parsed.error);
      const chunk = parsed.message?.content;
      if (chunk) onDelta(chunk);
    }
  } finally {
    clearTimeout(t);
    reader.releaseLock();
  }
}

export function toOllamaChatMessages(
  messages: LocalAiChatMessage[]
): OllamaChatMessage[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

export async function getOllamaChatStatus(
  model?: string,
  baseUrl = DEFAULT_OLLAMA_BASE
): Promise<{ ready: boolean; model: string; modelReady: boolean; message?: string }> {
  const resolved = model ?? resolveOllamaChatModel();
  const check = await checkOllamaReady(resolved, baseUrl);
  if (!check.ok) {
    return {
      ready: false,
      model: resolved,
      modelReady: false,
      message: ollamaNotReadyMessage(resolved),
    };
  }
  if (!check.modelReady) {
    return {
      ready: false,
      model: resolved,
      modelReady: false,
      message: `Model ${resolved} is not installed. Run: ollama pull ${resolved}`,
    };
  }
  return { ready: true, model: resolved, modelReady: true };
}

/** Non-streaming chat completion. */
export async function chatWithOllama(
  messages: LocalAiChatMessage[],
  systemPrompt: string,
  options?: OllamaChatOptions
): Promise<string> {
  const model = options?.model ?? resolveOllamaChatModel();
  const baseUrl = options?.baseUrl ?? DEFAULT_OLLAMA_BASE;
  const timeoutMs = options?.timeoutMs ?? 120_000;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  const ollamaMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const resp = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
    body: JSON.stringify({
      model,
      messages: ollamaMessages,
      stream: false,
      options: { temperature: 0.4 },
    }),
  });
  clearTimeout(t);

  if (!resp.ok) {
    throw new Error(`Ollama HTTP ${resp.status}`);
  }

  const data = (await resp.json()) as OllamaChatLine;
  const content = data.message?.content?.trim();
  if (!content) throw new Error("Empty response from Ollama");
  return content;
}

/** Stream tokens from Ollama; calls onDelta for each content chunk. */
export async function streamChatWithOllama(
  messages: LocalAiChatMessage[],
  systemPrompt: string,
  onDelta: (text: string) => void,
  options?: OllamaChatOptions
): Promise<void> {
  const model = options?.model ?? resolveOllamaChatModel();
  const baseUrl = options?.baseUrl ?? DEFAULT_OLLAMA_BASE;
  const timeoutMs = options?.timeoutMs ?? 180_000;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  const ollamaMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const resp = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
    body: JSON.stringify({
      model,
      messages: ollamaMessages,
      stream: true,
      options: { temperature: 0.4 },
    }),
  });

  if (!resp.ok) {
    clearTimeout(t);
    throw new Error(`Ollama HTTP ${resp.status}`);
  }

  if (!resp.body) {
    clearTimeout(t);
    throw new Error("Ollama returned no response body");
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let parsed: OllamaChatLine;
        try {
          parsed = JSON.parse(trimmed) as OllamaChatLine;
        } catch {
          continue;
        }
        if (parsed.error) throw new Error(parsed.error);
        const chunk = parsed.message?.content;
        if (chunk) onDelta(chunk);
      }
    }
    const tail = buffer.trim();
    if (tail) {
      const parsed = JSON.parse(tail) as OllamaChatLine;
      if (parsed.error) throw new Error(parsed.error);
      const chunk = parsed.message?.content;
      if (chunk) onDelta(chunk);
    }
  } finally {
    clearTimeout(t);
    reader.releaseLock();
  }
}

/** Parse a single NDJSON line from Ollama stream (for tests). */
export function parseOllamaStreamLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const parsed = JSON.parse(trimmed) as OllamaChatLine;
  if (parsed.error) throw new Error(parsed.error);
  return parsed.message?.content ?? null;
}
