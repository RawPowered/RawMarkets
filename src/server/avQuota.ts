import { getDb } from "./db";

const META_KEY = "__av_quota__";

export type AvQuotaState = {
  pausedUntil: number;
  note: string;
  detectedAt: number;
};

export function parseAvLimitMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const msg = String(d.Note || d.Information || d["Error Message"] || "");
  if (!msg) return null;
  const lower = msg.toLowerCase();
  if (
    lower.includes("25 requests") ||
    lower.includes("rate limit") ||
    lower.includes("frequency limit") ||
    (lower.includes("thank you for using alpha vantage") &&
      (lower.includes("limit") || lower.includes("premium")))
  ) {
    return msg;
  }
  return null;
}

/** Alpha Vantage free tier resets at midnight UTC. */
export function nextUtcMidnightMs(from = Date.now()): number {
  const d = new Date(from);
  d.setUTCHours(24, 0, 0, 0);
  return d.getTime();
}

export function loadAvQuotaState(): AvQuotaState | null {
  const row = getDb()
    .prepare("SELECT payload FROM api_cache WHERE cache_key = ?")
    .get(META_KEY) as { payload: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.payload) as AvQuotaState;
  } catch {
    return null;
  }
}

export function saveAvQuotaState(state: AvQuotaState): void {
  getDb()
    .prepare(
      "INSERT OR REPLACE INTO api_cache (cache_key, timestamp, payload) VALUES (?, ?, ?)"
    )
    .run(META_KEY, Date.now(), JSON.stringify(state));
}

export function markAvDailyLimitExhausted(note: string): AvQuotaState {
  const state: AvQuotaState = {
    pausedUntil: nextUtcMidnightMs(),
    note,
    detectedAt: Date.now(),
  };
  saveAvQuotaState(state);
  return state;
}

export function isAvQuotaPaused(now = Date.now()): boolean {
  const state = loadAvQuotaState();
  if (!state) return false;
  if (now >= state.pausedUntil) {
    getDb().prepare("DELETE FROM api_cache WHERE cache_key = ?").run(META_KEY);
    return false;
  }
  return true;
}

export function getAvQuotaStatus(now = Date.now()): {
  paused: boolean;
  resetsAt: string | null;
  note: string | null;
} {
  const state = loadAvQuotaState();
  if (!state || now >= state.pausedUntil) {
    return { paused: false, resetsAt: null, note: null };
  }
  return {
    paused: true,
    resetsAt: new Date(state.pausedUntil).toISOString(),
    note: state.note,
  };
}

export function clearAvQuotaPause(): void {
  getDb().prepare("DELETE FROM api_cache WHERE cache_key = ?").run(META_KEY);
}
