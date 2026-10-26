import { getDb } from "./db";

export function getNewsFeedPrefs(): Record<string, boolean> {
  const rows = getDb()
    .prepare("SELECT feed_id, enabled FROM news_feed_prefs")
    .all() as { feed_id: string; enabled: number }[];
  const out: Record<string, boolean> = {};
  for (const r of rows) {
    out[r.feed_id] = r.enabled === 1;
  }
  return out;
}

export function setNewsFeedPrefs(prefs: Record<string, boolean>): void {
  const stmt = getDb().prepare(
    `INSERT INTO news_feed_prefs (feed_id, enabled, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(feed_id) DO UPDATE SET
       enabled = excluded.enabled,
       updated_at = excluded.updated_at`
  );
  const now = Date.now();
  const tx = getDb().transaction((entries: [string, boolean][]) => {
    for (const [feedId, enabled] of entries) {
      stmt.run(feedId, enabled ? 1 : 0, now);
    }
  });
  tx(Object.entries(prefs));
}

export function isFeedEnabled(
  feedId: string,
  enabledDefault: boolean,
  prefs: Record<string, boolean>
): boolean {
  if (feedId in prefs) return prefs[feedId];
  return enabledDefault;
}
