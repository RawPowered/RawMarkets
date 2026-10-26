import { getDb } from "./db";
import type {
  JournalEntry,
  JournalEntryType,
  JournalMediaItem,
  JournalSnapshot,
} from "../types";

export interface JournalEntryRow {
  id: number;
  url: string;
  title: string;
  snippet: string | null;
  source: string | null;
  entry_type: JournalEntryType;
  snapshot_json: string | null;
  media_json: string | null;
  tags: string | null;
  notes: string | null;
  linked_asset_key: string | null;
  sentiment: string | null;
  score: number | null;
  created_at: number;
  updated_at: number;
  last_unfurled_at: number | null;
}

export interface CreateJournalEntryInput {
  url: string;
  title: string;
  snippet?: string | null;
  source?: string | null;
  entry_type?: JournalEntryType;
  snapshot?: JournalSnapshot | null;
  media?: JournalMediaItem[] | null;
  tags?: string | null;
  notes?: string | null;
  linked_asset_key?: string | null;
  sentiment?: string | null;
  score?: number | null;
}

export interface UpdateJournalEntryInput {
  title?: string;
  snippet?: string | null;
  tags?: string | null;
  notes?: string | null;
  snapshot?: JournalSnapshot | null;
  media?: JournalMediaItem[] | null;
  entry_type?: JournalEntryType;
  last_unfurled_at?: number | null;
}

function parseSnapshot(raw: string | null): JournalSnapshot | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as JournalSnapshot;
  } catch {
    return null;
  }
}

function parseMedia(raw: string | null): JournalMediaItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as JournalMediaItem[]) : [];
  } catch {
    return [];
  }
}

export function rowToJournalEntry(row: JournalEntryRow): JournalEntry {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    snippet: row.snippet,
    source: row.source,
    entry_type: row.entry_type,
    snapshot: parseSnapshot(row.snapshot_json),
    media: parseMedia(row.media_json),
    tags: row.tags,
    notes: row.notes,
    linked_asset_key: row.linked_asset_key,
    sentiment: row.sentiment as JournalEntry["sentiment"],
    score: row.score,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_unfurled_at: row.last_unfurled_at,
  };
}

export function listJournalEntries(filters?: {
  type?: string;
  q?: string;
}): JournalEntry[] {
  let sql = "SELECT * FROM investor_journal_entries";
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters?.type) {
    clauses.push("entry_type = ?");
    params.push(filters.type);
  }
  if (filters?.q) {
    clauses.push(
      "(title LIKE ? OR snippet LIKE ? OR url LIKE ? OR tags LIKE ? OR notes LIKE ?)"
    );
    const like = `%${filters.q}%`;
    params.push(like, like, like, like, like);
  }

  if (clauses.length) {
    sql += ` WHERE ${clauses.join(" AND ")}`;
  }
  sql += " ORDER BY created_at DESC";

  const rows = getDb().prepare(sql).all(...params) as JournalEntryRow[];
  return rows.map(rowToJournalEntry);
}

export function getJournalEntry(id: number): JournalEntry | null {
  const row = getDb()
    .prepare("SELECT * FROM investor_journal_entries WHERE id = ?")
    .get(id) as JournalEntryRow | undefined;
  return row ? rowToJournalEntry(row) : null;
}

export function findJournalEntryByUrl(url: string): JournalEntry | null {
  const row = getDb()
    .prepare("SELECT * FROM investor_journal_entries WHERE url = ? LIMIT 1")
    .get(url) as JournalEntryRow | undefined;
  return row ? rowToJournalEntry(row) : null;
}

export function createJournalEntry(
  input: CreateJournalEntryInput
): JournalEntry {
  const now = Date.now();
  const result = getDb()
    .prepare(
      `INSERT INTO investor_journal_entries (
        url, title, snippet, source, entry_type, snapshot_json, media_json,
        tags, notes, linked_asset_key, sentiment, score,
        created_at, updated_at, last_unfurled_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.url,
      input.title,
      input.snippet ?? null,
      input.source ?? null,
      input.entry_type ?? "manual",
      input.snapshot ? JSON.stringify(input.snapshot) : null,
      input.media?.length ? JSON.stringify(input.media) : null,
      input.tags ?? null,
      input.notes ?? null,
      input.linked_asset_key ?? null,
      input.sentiment ?? null,
      input.score ?? null,
      now,
      now,
      input.snapshot ? now : null
    );

  const created = getJournalEntry(Number(result.lastInsertRowid));
  if (!created) throw new Error("Failed to create journal entry");
  return created;
}

export function updateJournalEntry(
  id: number,
  input: UpdateJournalEntryInput
): JournalEntry | null {
  const existing = getJournalEntry(id);
  if (!existing) return null;

  const now = Date.now();
  getDb()
    .prepare(
      `UPDATE investor_journal_entries SET
        title = ?, snippet = ?, tags = ?, notes = ?,
        snapshot_json = ?, media_json = ?, entry_type = ?,
        last_unfurled_at = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      input.title ?? existing.title,
      input.snippet !== undefined ? input.snippet : existing.snippet,
      input.tags !== undefined ? input.tags : existing.tags,
      input.notes !== undefined ? input.notes : existing.notes,
      input.snapshot !== undefined
        ? input.snapshot
          ? JSON.stringify(input.snapshot)
          : null
        : existing.snapshot
          ? JSON.stringify(existing.snapshot)
          : null,
      input.media !== undefined
        ? input.media?.length
          ? JSON.stringify(input.media)
          : null
        : existing.media.length
          ? JSON.stringify(existing.media)
          : null,
      input.entry_type ?? existing.entry_type,
      input.last_unfurled_at !== undefined
        ? input.last_unfurled_at
        : existing.last_unfurled_at,
      now,
      id
    );

  return getJournalEntry(id);
}

export function deleteJournalEntry(id: number): boolean {
  const result = getDb()
    .prepare("DELETE FROM investor_journal_entries WHERE id = ?")
    .run(id);
  return result.changes > 0;
}
