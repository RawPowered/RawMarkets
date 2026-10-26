import express, { type Express, type Request, type Response } from "express";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { requireAdminAccess } from "./adminMiddleware";
import {
  getAvQuotaStatus,
  isAvQuotaPaused,
  markAvDailyLimitExhausted,
  parseAvLimitMessage,
} from "./avQuota";
import {
  DB_PATH,
  clearAllApiCache,
  clearApiCacheForProvider,
  deleteApiKey,
  getApiKey,
  isValidSqliteFile,
  listApiKeysMeta,
  replaceDatabaseFile,
  upsertApiKey,
  wipeAppData,
  KEY_ENV_MAP,
} from "./db";

export type GeminiHolder = { client: GoogleGenAI | null };

export function createGeminiClient(): GoogleGenAI | null {
  const key = getApiKey("gemini");
  if (!key) return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: { "User-Agent": "aistudio-build" },
    },
  });
}

export type AdminHooks = {
  onDatabaseChanged?: () => void;
};

export function registerAdminRoutes(
  app: Express,
  gemini: GeminiHolder,
  hooks?: AdminHooks
): void {
  app.use("/api/admin", requireAdminAccess);

  app.get("/api/admin/keys", (_req, res) => {
    res.json({ success: true, keys: listApiKeysMeta() });
  });

  app.post("/api/admin/av-quota/acknowledge", (_req, res) => {
    markAvDailyLimitExhausted(
      "Daily limit acknowledged — no Alpha Vantage calls until UTC midnight."
    );
    hooks?.onDatabaseChanged?.();
    res.json({
      success: true,
      avQuota: getAvQuotaStatus(),
      message:
        "Alpha Vantage paused for today. Metals and cached quotes still work.",
    });
  });

  app.post("/api/admin/cache/clear", (_req, res) => {
    const removed = clearAllApiCache();
    hooks?.onDatabaseChanged?.();
    res.json({
      success: true,
      message: `Cleared ${removed} cached API snapshot(s). Refresh the dashboard.`,
    });
  });

  app.put("/api/admin/keys", (req, res) => {
    const body = req.body as {
      keys?: { id: string; value: string }[];
      id?: string;
      value?: string;
    };
    try {
      let geminiTouched = false;
      if (Array.isArray(body.keys)) {
        for (const item of body.keys) {
          if (item.id && item.value) {
            upsertApiKey(item.id, item.value);
            if (item.id === "gemini") geminiTouched = true;
          }
        }
      } else if (body.id && typeof body.value === "string") {
        upsertApiKey(body.id, body.value);
        if (body.id === "gemini") geminiTouched = true;
      } else {
        return res.status(400).json({
          success: false,
          message: "Provide { id, value } or { keys: [] }",
        });
      }
      if (geminiTouched) gemini.client = createGeminiClient();
      const touchedIds = Array.isArray(body.keys)
        ? body.keys.map((k) => k.id).filter(Boolean)
        : body.id
          ? [body.id]
          : [];
      for (const id of touchedIds) {
        clearApiCacheForProvider(id);
      }
      hooks?.onDatabaseChanged?.();
      res.json({ success: true, keys: listApiKeysMeta() });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ success: false, message: msg });
    }
  });

  app.delete("/api/admin/keys/:id", (req, res) => {
    const id = req.params.id;
    if (!KEY_ENV_MAP[id]) {
      return res.status(400).json({ success: false, message: "Unknown key id" });
    }
    deleteApiKey(id);
    clearApiCacheForProvider(id);
    if (id === "gemini") gemini.client = createGeminiClient();
    hooks?.onDatabaseChanged?.();
    res.json({ success: true, keys: listApiKeysMeta() });
  });

  app.post("/api/admin/keys/:id/test", async (req, res) => {
    const id = req.params.id;
    const key = getApiKey(id);
    if (!key) {
      return res.json({
        success: false,
        message: "No key configured for this provider.",
      });
    }

    try {
      if (id === "gemini") {
        const client = new GoogleGenAI({ apiKey: key });
        await client.models.generateContent({
          model: "gemini-2.0-flash",
          contents: "ping",
        });
        return res.json({ success: true, message: "Gemini API responded." });
      }
      if (id === "alpha_vantage") {
        if (isAvQuotaPaused()) {
          const q = getAvQuotaStatus();
          return res.json({
            success: false,
            message: `Daily limit already hit. Resets ${q.resetsAt ?? "midnight UTC"}. Test skipped to save quota.`,
          });
        }
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=TSLA&apikey=${key}`;
        const r = await fetch(url);
        const data = (await r.json()) as Record<string, unknown>;
        const limitMsg = parseAvLimitMessage(data);
        if (limitMsg) {
          markAvDailyLimitExhausted(limitMsg);
          return res.json({
            success: false,
            message: limitMsg,
          });
        }
        const gq = data["Global Quote"] as Record<string, string> | undefined;
        const price = gq?.["05. price"];
        if (!price) {
          return res.json({
            success: false,
            message:
              "Key accepted but no Global Quote returned (invalid key or throttled). Wait 1 minute and Test again.",
          });
        }
        return res.json({
          success: true,
          message: `Live TSLA quote: $${price} (dashboard uses this API for stocks).`,
        });
      }
      if (id === "serpapi") {
        const url = `https://serpapi.com/search.json?engine=google&q=test&api_key=${key}`;
        const r = await fetch(url);
        if (!r.ok)
          return res.json({ success: false, message: `HTTP ${r.status}` });
        return res.json({ success: true, message: "SerpApi reachable." });
      }
      if (id === "metalprice") {
        const url = `https://api.metalpriceapi.com/v1/latest?api_key=${key}&base=USD&currencies=XAU,XAG`;
        const r = await fetch(url);
        const data = (await r.json()) as {
          success?: boolean;
          rates?: Record<string, number>;
          error?: { info?: string };
        };
        if (!r.ok) {
          return res.json({ success: false, message: `HTTP ${r.status}` });
        }
        if (!data.success || !data.rates?.XAG) {
          return res.json({
            success: false,
            message:
              data.error?.info ||
              "MetalPriceAPI did not return live rates (check plan/key).",
          });
        }
        const silverOz = (1 / data.rates.XAG).toFixed(2);
        const goldOz = data.rates.XAU
          ? (1 / data.rates.XAU).toFixed(2)
          : "—";
        return res.json({
          success: true,
          message: `Live spot — silver $${silverOz}/oz, gold $${goldOz}/oz (Kitco scale).`,
        });
      }
      if (id === "app_url") {
        try {
          const r = await fetch(key, { method: "HEAD" });
          return res.json({
            success: r.ok,
            message: r.ok ? "URL reachable." : `HTTP ${r.status}`,
          });
        } catch {
          return res.json({
            success: true,
            message: "URL stored (HEAD check skipped).",
          });
        }
      }
      res.status(400).json({ success: false, message: "Unknown provider" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.json({ success: false, message: msg });
    }
  });

  app.get("/api/admin/db/export", (_req, res) => {
    if (!fs.existsSync(DB_PATH)) {
      return res
        .status(404)
        .json({ success: false, message: "Database file not found." });
    }
    const stamp = new Date().toISOString().slice(0, 10);
    res.download(DB_PATH, `rawmarkets-${stamp}.db`);
  });

  app.post(
    "/api/admin/db/import",
    express.raw({ type: "application/octet-stream", limit: "50mb" }),
    (req: Request, res: Response) => {
      const buffer = req.body as Buffer;
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            "Send raw SQLite file as application/octet-stream body.",
        });
      }
      if (!isValidSqliteFile(buffer)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid SQLite database file." });
      }
      try {
        replaceDatabaseFile(buffer);
        gemini.client = createGeminiClient();
        hooks?.onDatabaseChanged?.();
        res.json({
          success: true,
          message:
            "Database imported. Restart recommended if behavior looks stale.",
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ success: false, message: msg });
      }
    }
  );

  app.post("/api/admin/db/reset", (_req, res) => {
    wipeAppData();
    res.json({
      success: true,
      message: "Cache and custom assets cleared from database.",
    });
  });
}
