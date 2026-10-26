import { getDb } from "./db";

export function recordCatalogRemoval(symbol: string): void {
  const key = symbol.trim().toUpperCase();
  if (!key) return;
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO catalog_symbol_removals (symbol, removed_at) VALUES (?, ?)`
    )
    .run(key, Date.now());
}

export function isCatalogSymbolRemoved(symbol: string): boolean {
  const key = symbol.trim().toUpperCase();
  if (!key) return false;
  const row = getDb()
    .prepare("SELECT symbol FROM catalog_symbol_removals WHERE symbol = ?")
    .get(key) as { symbol: string } | undefined;
  return !!row;
}

export function getRemovedCatalogSymbols(): Set<string> {
  const rows = getDb()
    .prepare("SELECT symbol FROM catalog_symbol_removals")
    .all() as { symbol: string }[];
  return new Set(rows.map((r) => r.symbol.toUpperCase()));
}

export function clearCatalogRemovals(): number {
  const result = getDb().prepare("DELETE FROM catalog_symbol_removals").run();
  return result.changes;
}

export function unrecordCatalogRemoval(symbol: string): boolean {
  const key = symbol.trim().toUpperCase();
  if (!key) return false;
  const result = getDb()
    .prepare("DELETE FROM catalog_symbol_removals WHERE symbol = ?")
    .run(key);
  return result.changes > 0;
}
