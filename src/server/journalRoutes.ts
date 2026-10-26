import type { Express, Request, Response } from "express";
import path from "path";
import { getEngineSettings } from "./db";
import {
  createJournalEntry,
  deleteJournalEntry,
  findJournalEntryByUrl,
  getJournalEntry,
  listJournalEntries,
  updateJournalEntry,
} from "./journalDb";
import {
  downloadJournalMedia,
  initJournalMediaStore,
  resolveMediaFilePath,
  deleteJournalMediaFiles,
} from "./journalMediaStore";
import { buildNewsClipUnfurl, unfurlUrl } from "./journalUnfurl";
import { markNewsArticleClipped } from "./newsArticleStore";
import type { NewsItem } from "../types";

export function registerJournalRoutes(app: Express): void {
  initJournalMediaStore();

  app.get("/api/journal/entries", (req: Request, res: Response) => {
    try {
      const type = typeof req.query.type === "string" ? req.query.type : undefined;
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const entries = listJournalEntries({ type, q });
      res.json({ success: true, entries });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  });

  app.get("/api/journal/entries/:id", (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const entry = getJournalEntry(id);
    if (!entry) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    res.json({ success: true, entry });
  });

  app.post("/api/journal/unfurl", async (req: Request, res: Response) => {
    try {
      const url = String(req.body?.url ?? "").trim();
      if (!url) {
        return res.status(400).json({ success: false, message: "URL required" });
      }
      const result = await unfurlUrl(url);
      res.json({ success: true, ...result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ success: false, message: msg });
    }
  });

  app.post("/api/journal/entries", async (req: Request, res: Response) => {
    try {
      const url = String(req.body?.url ?? "").trim();
      if (!url) {
        return res.status(400).json({ success: false, message: "URL required" });
      }

      const existing = findJournalEntryByUrl(url);
      if (existing) {
        return res.json({ success: true, entry: existing, duplicate: true });
      }

      const unfurled = await unfurlUrl(url);
      const settings = getEngineSettings();
      let entry = createJournalEntry({
        url,
        title: req.body?.title ?? unfurled.title,
        snippet: req.body?.snippet ?? unfurled.snippet,
        source: unfurled.source,
        entry_type: unfurled.entry_type,
        snapshot: unfurled.snapshot,
        media: unfurled.media,
        tags: req.body?.tags ?? null,
        notes: req.body?.notes ?? null,
        linked_asset_key: req.body?.linked_asset_key ?? null,
      });

      if (unfurled.media.length) {
        const media = await downloadJournalMedia(entry.id, unfurled.media, {
          settings,
        });
        const updated = updateJournalEntry(entry.id, { media });
        if (updated) entry = updated;
      }

      res.json({ success: true, entry });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ success: false, message: msg });
    }
  });

  app.post("/api/journal/clip-news", async (req: Request, res: Response) => {
    try {
      const news = req.body as NewsItem & {
        linked_asset_key?: string;
      };
      if (!news?.title) {
        return res.status(400).json({ success: false, message: "Invalid news item" });
      }

      const url = news.link && news.link !== "#" ? news.link : `news://${Date.now()}`;
      const existing =
        news.link && news.link !== "#" ? findJournalEntryByUrl(news.link) : null;
      if (existing) {
        markNewsArticleClipped(news.link);
        return res.json({ success: true, entry: existing, duplicate: true });
      }

      const unfurled = buildNewsClipUnfurl(news, req.body?.linked_asset_key);
      let entry = createJournalEntry({
        url,
        title: news.title,
        snippet: news.snippet,
        source: news.source,
        entry_type: "news_clip",
        snapshot: unfurled.snapshot,
        media: unfurled.media,
        linked_asset_key: req.body?.linked_asset_key ?? null,
        sentiment: news.sentiment,
        score: news.score,
      });
      markNewsArticleClipped(news.link);

      if (news.link && news.link !== "#") {
        try {
          const live = await unfurlUrl(news.link);
          const settings = getEngineSettings();
          let media = live.media;
          if (media.length) {
            media = await downloadJournalMedia(entry.id, media, { settings });
          }
          const updated = updateJournalEntry(entry.id, {
            snapshot: { ...unfurled.snapshot, ...live.snapshot },
            media,
            entry_type:
              live.entry_type === "social_x" ? "social_x" : "news_clip",
            last_unfurled_at: Date.now(),
          });
          if (updated) entry = updated;
        } catch {
          /* keep news clip snapshot */
        }
      }

      res.json({ success: true, entry });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ success: false, message: msg });
    }
  });

  app.patch("/api/journal/entries/:id", (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const entry = updateJournalEntry(id, {
      title: req.body?.title,
      snippet: req.body?.snippet,
      tags: req.body?.tags,
      notes: req.body?.notes,
    });
    if (!entry) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    res.json({ success: true, entry });
  });

  app.post(
    "/api/journal/entries/:id/refresh",
    async (req: Request, res: Response) => {
      const id = parseInt(String(req.params.id), 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid id" });
      }
      const existing = getJournalEntry(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: "Not found" });
      }
      if (!existing.url || existing.url.startsWith("news://")) {
        return res.status(400).json({
          success: false,
          message: "Cannot refresh synthetic news clip URL",
        });
      }
      try {
        const unfurled = await unfurlUrl(existing.url);
        const settings = getEngineSettings();
        let media = unfurled.media;
        if (media.length) {
          media = await downloadJournalMedia(id, media, { settings });
        }
        const entry = updateJournalEntry(id, {
          title: unfurled.title,
          snippet: unfurled.snippet,
          snapshot: unfurled.snapshot,
          media,
          entry_type: unfurled.entry_type,
          last_unfurled_at: Date.now(),
        });
        res.json({ success: true, entry });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(400).json({ success: false, message: msg });
      }
    }
  );

  app.post(
    "/api/journal/entries/:id/download-media",
    async (req: Request, res: Response) => {
      const id = parseInt(String(req.params.id), 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid id" });
      }
      const existing = getJournalEntry(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: "Not found" });
      }
      const settings = getEngineSettings();
      const media = await downloadJournalMedia(id, existing.media, {
        settings,
        force: true,
      });
      const entry = updateJournalEntry(id, { media });
      res.json({ success: true, entry });
    }
  );

  app.delete("/api/journal/entries/:id", (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    deleteJournalMediaFiles(id);
    const ok = deleteJournalEntry(id);
    if (!ok) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    res.json({ success: true });
  });

  app.get(
    "/api/journal/media/:entryId/:filename",
    (req: Request, res: Response) => {
      const entryId = parseInt(String(req.params.entryId), 10);
      const filename = String(req.params.filename);
      if (Number.isNaN(entryId)) {
        return res.status(400).json({ success: false, message: "Invalid id" });
      }
      const filePath = resolveMediaFilePath(entryId, filename);
      if (!filePath) {
        return res
          .status(404)
          .json({ success: false, message: "File not found" });
      }
      res.sendFile(path.resolve(filePath));
    }
  );
}
