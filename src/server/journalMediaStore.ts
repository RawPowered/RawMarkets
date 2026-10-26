import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { EngineSettings } from "./db";
import type { JournalMediaItem } from "../types";
import { fetchPublicHttpUrl } from "./urlSafety";

function resolveMediaRoot(): string {
  const configured = process.env.RAWMARKETS_DATA_DIR?.trim();
  const base = configured || path.join(process.cwd(), "data");
  return path.join(base, "journal-media");
}

export const JOURNAL_MEDIA_DIR = resolveMediaRoot();

function ensureMediaDir(entryId: number): string {
  const dir = path.join(JOURNAL_MEDIA_DIR, String(entryId));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function extFromContentType(ct: string | null, url: string): string {
  if (ct?.includes("jpeg") || ct?.includes("jpg")) return ".jpg";
  if (ct?.includes("png")) return ".png";
  if (ct?.includes("gif")) return ".gif";
  if (ct?.includes("webp")) return ".webp";
  if (ct?.includes("mp4") || ct?.includes("video")) return ".mp4";
  const urlExt = path.extname(new URL(url).pathname);
  if (urlExt && urlExt.length <= 5) return urlExt;
  return ".bin";
}

async function getRemoteSize(url: string): Promise<number | null> {
  try {
    const resp = await fetchPublicHttpUrl(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(8000),
    });
    const len = resp.headers.get("content-length");
    return len ? parseInt(len, 10) : null;
  } catch {
    return null;
  }
}

async function downloadToFile(
  url: string,
  destPath: string,
  maxBytes: number
): Promise<{ sizeBytes: number }> {
  const resp = await fetchPublicHttpUrl(url, {
    signal: AbortSignal.timeout(30000),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; RawMarketsBot/1.0; +https://rawmarkets.local)",
    },
  });
  if (!resp.ok) {
    throw new Error(`Download failed: ${resp.status}`);
  }
  if (!resp.body) {
    throw new Error("Download failed: empty response body");
  }

  const writer = fs.createWriteStream(destPath, { flags: "wx" });
  let sizeBytes = 0;
  const reader = resp.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sizeBytes += value.byteLength;
      if (sizeBytes > maxBytes) {
        throw new Error("Download exceeds configured size limit");
      }
      await new Promise<void>((resolve, reject) => {
        writer.write(Buffer.from(value), (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  } catch (err) {
    writer.destroy();
    if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
    throw err;
  } finally {
    reader.releaseLock();
  }
  await new Promise<void>((resolve, reject) => {
    writer.end((err: Error | null | undefined) => {
      if (err) reject(err);
      else resolve();
    });
  });
  return { sizeBytes };
}

export function resolveMediaFilePath(
  entryId: number,
  filename: string
): string | null {
  const safe = path.basename(filename);
  const full = path.join(JOURNAL_MEDIA_DIR, String(entryId), safe);
  if (!full.startsWith(JOURNAL_MEDIA_DIR)) return null;
  if (!fs.existsSync(full)) return null;
  return full;
}

export interface DownloadMediaOptions {
  force?: boolean;
  settings: EngineSettings;
}

export async function downloadJournalMedia(
  entryId: number,
  items: JournalMediaItem[],
  options: DownloadMediaOptions
): Promise<JournalMediaItem[]> {
  const { settings, force = false } = options;
  const dir = ensureMediaDir(entryId);
  const updated: JournalMediaItem[] = [];

  for (const item of items) {
    const isVideo = item.type === "video";
    const autoOk = isVideo
      ? settings.journalAutoDownloadVideos
      : settings.journalAutoDownloadImages;
    if (!force && !autoOk) {
      updated.push(item);
      continue;
    }

    const maxMb = isVideo
      ? settings.journalMaxVideoMb
      : settings.journalMaxImageMb;
    const maxBytes = maxMb * 1024 * 1024;

    try {
      const remoteSize = await getRemoteSize(item.remoteUrl);
      if (remoteSize !== null && remoteSize > maxBytes) {
        updated.push({ ...item, downloadError: `Exceeds ${maxMb}MB limit` });
        continue;
      }

      const hash = crypto
        .createHash("md5")
        .update(item.remoteUrl)
        .digest("hex")
        .slice(0, 12);
      const ext = extFromContentType(null, item.remoteUrl);
      const filename = `${hash}${ext}`;
      const dest = path.join(dir, filename);

      if (fs.existsSync(dest)) {
        const stat = fs.statSync(dest);
        updated.push({
          ...item,
          localPath: `${entryId}/${filename}`,
          sizeBytes: stat.size,
          downloadedAt: Date.now(),
        });
        continue;
      }

      const { sizeBytes } = await downloadToFile(item.remoteUrl, dest, maxBytes);
      if (sizeBytes > maxBytes) {
        fs.unlinkSync(dest);
        updated.push({ ...item, downloadError: `Exceeds ${maxMb}MB limit` });
        continue;
      }

      updated.push({
        ...item,
        localPath: `${entryId}/${filename}`,
        sizeBytes,
        downloadedAt: Date.now(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      updated.push({ ...item, downloadError: msg });
    }
  }

  return updated;
}

export function deleteJournalMediaFiles(entryId: number): void {
  const dir = path.join(JOURNAL_MEDIA_DIR, String(entryId));
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function initJournalMediaStore(): void {
  if (!fs.existsSync(JOURNAL_MEDIA_DIR)) {
    fs.mkdirSync(JOURNAL_MEDIA_DIR, { recursive: true });
  }
}
