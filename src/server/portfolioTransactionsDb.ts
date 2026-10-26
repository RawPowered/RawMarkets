import { getDb } from "./db";

export type PortfolioTxType = "buy" | "sell";

export interface PortfolioTransactionRow {
  id: number;
  symbol: string;
  tx_date: string;
  tx_type: PortfolioTxType;
  shares: number;
  price: number;
  amount_usd: number;
  source: string;
  source_line: number | null;
  external_id: string | null;
  created_at: number;
}

export interface InsertPortfolioTransactionInput {
  symbol: string;
  tx_date: string;
  tx_type: PortfolioTxType;
  shares: number;
  price: number;
  amount_usd: number;
  source?: string;
  source_line?: number | null;
  external_id?: string | null;
}

function rowToTx(row: Record<string, unknown>): PortfolioTransactionRow {
  return {
    id: row.id as number,
    symbol: String(row.symbol).toUpperCase(),
    tx_date: String(row.tx_date),
    tx_type: row.tx_type as PortfolioTxType,
    shares: row.shares as number,
    price: row.price as number,
    amount_usd: row.amount_usd as number,
    source: String(row.source),
    source_line: row.source_line == null ? null : (row.source_line as number),
    external_id: row.external_id == null ? null : String(row.external_id),
    created_at: row.created_at as number,
  };
}

export function insertPortfolioTransactions(
  inputs: InsertPortfolioTransactionInput[]
): number {
  const stmt = getDb().prepare(
    `INSERT OR IGNORE INTO portfolio_transactions (
      symbol, tx_date, tx_type, shares, price, amount_usd,
      source, source_line, external_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const now = Date.now();
  let inserted = 0;
  for (const input of inputs) {
    const r = stmt.run(
      input.symbol.trim().toUpperCase(),
      input.tx_date,
      input.tx_type,
      input.shares,
      input.price,
      input.amount_usd,
      input.source ?? "statement_import",
      input.source_line ?? null,
      input.external_id ?? null,
      now
    );
    if (r.changes > 0) inserted += 1;
  }
  return inserted;
}

export function listTransactionsBySymbol(
  symbol: string
): PortfolioTransactionRow[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM portfolio_transactions
       WHERE symbol = ? ORDER BY tx_date ASC, id ASC`
    )
    .all(symbol.trim().toUpperCase()) as Record<string, unknown>[];
  return rows.map(rowToTx);
}

export function listAllPortfolioTransactions(): PortfolioTransactionRow[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM portfolio_transactions ORDER BY symbol ASC, tx_date ASC, id ASC`
    )
    .all() as Record<string, unknown>[];
  return rows.map(rowToTx);
}

export function deleteTransactionsForSymbol(symbol: string): number {
  const r = getDb()
    .prepare("DELETE FROM portfolio_transactions WHERE symbol = ?")
    .run(symbol.trim().toUpperCase());
  return r.changes;
}

export function getPortfolioTransaction(
  id: number
): PortfolioTransactionRow | null {
  const row = getDb()
    .prepare("SELECT * FROM portfolio_transactions WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToTx(row) : null;
}

export interface UpdatePortfolioTransactionInput {
  tx_type?: PortfolioTxType;
  shares?: number;
  price?: number;
  amount_usd?: number;
}

export function updatePortfolioTransaction(
  id: number,
  input: UpdatePortfolioTransactionInput
): PortfolioTransactionRow | null {
  const existing = getPortfolioTransaction(id);
  if (!existing) return null;

  const tx_type = input.tx_type ?? existing.tx_type;
  const shares = input.shares ?? existing.shares;
  const price = input.price ?? existing.price;
  const amount_usd = input.amount_usd ?? existing.amount_usd;

  getDb()
    .prepare(
      `UPDATE portfolio_transactions SET
        tx_type = ?, shares = ?, price = ?, amount_usd = ?
      WHERE id = ?`
    )
    .run(tx_type, shares, price, amount_usd, id);

  return getPortfolioTransaction(id);
}

export function deletePortfolioTransaction(id: number): boolean {
  const r = getDb()
    .prepare("DELETE FROM portfolio_transactions WHERE id = ?")
    .run(id);
  return r.changes > 0;
}
