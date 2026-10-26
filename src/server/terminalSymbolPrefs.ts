import { getDb } from "./db";

export function listHiddenSymbols(): string[] {
  const rows = getDb()
    .prepare(
      "SELECT symbol FROM terminal_symbol_prefs WHERE hidden = 1 ORDER BY symbol"
    )
    .all() as { symbol: string }[];
  return rows.map((r) => r.symbol);
}

export function listPinnedSymbols(): string[] {
  const rows = getDb()
    .prepare(
      `SELECT symbol FROM terminal_symbol_prefs
       WHERE pinned = 1
       ORDER BY pin_order ASC, symbol ASC`
    )
    .all() as { symbol: string }[];
  return rows.map((r) => r.symbol);
}

export function setSymbolHidden(symbol: string, hidden: boolean): void {
  const key = symbol.trim().toUpperCase();
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO terminal_symbol_prefs (symbol, hidden, pinned, pin_order, updated_at)
       VALUES (?, ?, COALESCE((SELECT pinned FROM terminal_symbol_prefs WHERE symbol = ?), 0), COALESCE((SELECT pin_order FROM terminal_symbol_prefs WHERE symbol = ?), 0), ?)
       ON CONFLICT(symbol) DO UPDATE SET hidden = excluded.hidden, updated_at = excluded.updated_at`
    )
    .run(key, hidden ? 1 : 0, key, key, now);
}

export function setSymbolPinned(symbol: string, pinned: boolean, pinOrder?: number): void {
  const key = symbol.trim().toUpperCase();
  const now = Date.now();
  const order =
    pinOrder ??
    (getDb()
      .prepare("SELECT COALESCE(MAX(pin_order), -1) + 1 AS n FROM terminal_symbol_prefs WHERE pinned = 1")
      .get() as { n: number }).n;
  getDb()
    .prepare(
      `INSERT INTO terminal_symbol_prefs (symbol, hidden, pinned, pin_order, updated_at)
       VALUES (?, COALESCE((SELECT hidden FROM terminal_symbol_prefs WHERE symbol = ?), 0), ?, ?, ?)
       ON CONFLICT(symbol) DO UPDATE SET pinned = excluded.pinned, pin_order = excluded.pin_order, updated_at = excluded.updated_at`
    )
    .run(key, key, pinned ? 1 : 0, pinned ? order : 0, now);
}

export function syncPinnedSymbols(symbols: string[]): number {
  const db = getDb();
  db.prepare("UPDATE terminal_symbol_prefs SET pinned = 0, pin_order = 0").run();
  let n = 0;
  symbols.forEach((sym, index) => {
    setSymbolPinned(sym, true, index);
    n++;
  });
  return n;
}

export function restoreAllHidden(): number {
  const result = getDb()
    .prepare("UPDATE terminal_symbol_prefs SET hidden = 0, updated_at = ?")
    .run(Date.now());
  return result.changes;
}

export function removeSymbolPref(symbol: string): void {
  getDb()
    .prepare("DELETE FROM terminal_symbol_prefs WHERE symbol = ?")
    .run(symbol.trim().toUpperCase());
}

export function isSymbolHidden(symbol: string): boolean {
  const row = getDb()
    .prepare("SELECT hidden FROM terminal_symbol_prefs WHERE symbol = ?")
    .get(symbol.trim().toUpperCase()) as { hidden: number } | undefined;
  return row?.hidden === 1;
}

export function isSymbolPinned(symbol: string): boolean {
  const row = getDb()
    .prepare("SELECT pinned FROM terminal_symbol_prefs WHERE symbol = ?")
    .get(symbol.trim().toUpperCase()) as { pinned: number } | undefined;
  return row?.pinned === 1;
}
