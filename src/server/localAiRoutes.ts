import type { Express, Request, Response } from "express";
import type { LocalAiChatMessage, PlatformLocation } from "../types";
import { getApiKey, getEngineSettings } from "./db";
import { buildLocalAiDataContext } from "./localAiContext";
import { countActiveWealthBibleRules } from "./wealthBibleRuleSpace";
import {
  DEFAULT_OLLAMA_MODEL,
  ollamaNotReadyMessage,
} from "./ollamaDefaults";
import { runLocalAiAgentStream } from "./localAiAgent";
import {
  buildLocalAiSystemPrompt,
  chatWithOllama,
  getOllamaChatStatus,
  streamChatWithOllama,
} from "./ollamaChat";
import { requestRemoteAddress } from "./requestSecurity";

const CHAT_MIN_INTERVAL_MS = 1000;
const lastChatByIp = new Map<string, number>();

function clientIp(req: Request): string {
  return requestRemoteAddress(req) ?? "local";
}

function isChatThrottled(ip: string): boolean {
  const now = Date.now();
  const last = lastChatByIp.get(ip) ?? 0;
  if (now - last < CHAT_MIN_INTERVAL_MS) return true;
  lastChatByIp.set(ip, now);
  return false;
}

function parseContext(raw: unknown): PlatformLocation | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const page = String(o.page ?? "").trim();
  const pageLabel = String(o.pageLabel ?? page).trim();
  if (!page) return null;
  const ctx: PlatformLocation = {
    page,
    pageLabel: pageLabel || page,
    capturedAt: String(o.capturedAt ?? new Date().toISOString()),
  };
  if (o.selectedSymbol) ctx.selectedSymbol = String(o.selectedSymbol);
  if (o.activeCategory) ctx.activeCategory = String(o.activeCategory);
  if (o.searchQuery) ctx.searchQuery = String(o.searchQuery);
  if (Array.isArray(o.pinnedSymbols)) {
    ctx.pinnedSymbols = o.pinnedSymbols.map(String);
  }
  if (o.newsBaySymbol) ctx.newsBaySymbol = String(o.newsBaySymbol);
  if (o.newsBayLane) ctx.newsBayLane = String(o.newsBayLane);
  const asset = o.selectedAsset;
  if (asset && typeof asset === "object") {
    const a = asset as Record<string, unknown>;
    ctx.selectedAsset = {
      symbol: String(a.symbol ?? ctx.selectedSymbol ?? ""),
      name: String(a.name ?? ""),
      price: Number(a.price ?? 0),
      changePercent: String(a.changePercent ?? ""),
      priceSource: a.priceSource ? String(a.priceSource) : undefined,
    };
  }
  return ctx;
}

function parseMessages(raw: unknown): LocalAiChatMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: LocalAiChatMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const role = m.role === "assistant" ? "assistant" : m.role === "user" ? "user" : null;
    const content = String(m.content ?? "").trim();
    if (!role || !content) continue;
    out.push({ role, content });
  }
  return out.length > 0 ? out : null;
}

export function registerLocalAiRoutes(app: Express): void {
  app.get("/api/local-ai/status", async (_req: Request, res: Response) => {
    try {
      const engine = getEngineSettings();
      const status = await getOllamaChatStatus();
      res.json({
        success: true,
        ...status,
        wealthBibleEnabled: engine.aiWealthBibleEnabled,
        wealthBibleRuleCount: countActiveWealthBibleRules(engine),
        aiLocalToolsEnabled: engine.aiLocalToolsEnabled,
        aiLocalSerpEnabled: engine.aiLocalSerpEnabled,
        hasSerpApiKey: !!getApiKey("serpapi")?.trim(),
        playwrightEnabled: engine.usePlaywrightScrapers,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Status check failed";
      res.json({
        success: false,
        ready: false,
        modelReady: false,
        model: DEFAULT_OLLAMA_MODEL,
        message,
        wealthBibleEnabled: false,
        wealthBibleRuleCount: 0,
        aiLocalToolsEnabled: false,
        aiLocalSerpEnabled: false,
        hasSerpApiKey: false,
        playwrightEnabled: false,
      });
    }
  });

  app.post("/api/local-ai/chat", async (req: Request, res: Response) => {
    const ip = clientIp(req);
    if (isChatThrottled(ip)) {
      return res.status(429).json({
        success: false,
        message: "Please wait a moment before sending another message.",
      });
    }

    const context = parseContext(req.body?.context);
    if (!context) {
      return res.status(400).json({
        success: false,
        message: "Missing or invalid platform context.",
      });
    }

    const messages = parseMessages(req.body?.messages);
    if (!messages) {
      return res.status(400).json({
        success: false,
        message: "Missing or invalid messages array.",
      });
    }

    const status = await getOllamaChatStatus();
    if (!status.ready) {
      return res.status(503).json({
        success: false,
        message:
          status.message ??
          ollamaNotReadyMessage(),
      });
    }

    const engine = getEngineSettings();
    const platformData = await buildLocalAiDataContext(context);
    const systemPrompt = buildLocalAiSystemPrompt(context, platformData);
    const stream = req.body?.stream === true;
    const useTools = engine.aiLocalToolsEnabled;

    try {
      if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders?.();

        if (useTools) {
          await runLocalAiAgentStream(messages, context, platformData, (event) => {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
          });
          return res.end();
        }

        await streamChatWithOllama(messages, systemPrompt, (delta) => {
          res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        });
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        return res.end();
      }

      const reply = await chatWithOllama(messages, systemPrompt);
      return res.json({ success: true, reply });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Chat failed";
      if (stream && !res.headersSent) {
        return res.status(503).json({ success: false, message });
      }
      if (stream) {
        res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
        return res.end();
      }
      return res.status(503).json({ success: false, message });
    }
  });
}
