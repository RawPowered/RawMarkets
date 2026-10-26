import { apiFetch, readApiJson } from "../../../lib/api";
import type { PortfolioImportDraft } from "../types";
import type { InvestmentTransaction } from "../services/computePositionFromTransactions";

export interface PortfolioImportResult {
  imported: number;
  transactionsImported?: number;
  symbolsUpdated?: string[];
  consolidated?: number;
  failed: Array<{ draftId: string; reason: string }>;
}

export async function commitDraftsToPortfolio(
  drafts: PortfolioImportDraft[]
): Promise<PortfolioImportResult> {
  const accepted = drafts.filter((d) => d.status !== "rejected" && d.valid);
  if (accepted.length === 0) {
    return { imported: 0, failed: [] };
  }

  const transactions: InvestmentTransaction[] = accepted.map((d) => ({
    symbol: d.symbol.toUpperCase(),
    tx_date: d.entry_date,
    tx_type: d.tx_type ?? "buy",
    shares:
      d.shares ??
      d.dollars_invested / Math.max(d.entry_price, 0.0001),
    price: d.entry_price,
    amount_usd: d.dollars_invested,
    source_line: d.sourceLine,
  }));

  try {
    const resp = await apiFetch("/api/portfolio/import-statements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions }),
    });
    const json = await readApiJson<{
      success?: boolean;
      message?: string;
      transactionsImported?: number;
      symbolsUpdated?: string[];
      consolidated?: number;
    }>(resp);
    if (!resp.ok || !json.success) {
      return {
        imported: 0,
        failed: [
          {
            draftId: "batch",
            reason: json.message ?? "Failed to import statements",
          },
        ],
      };
    }
    return {
      imported: json.symbolsUpdated?.length ?? 0,
      transactionsImported: json.transactionsImported,
      symbolsUpdated: json.symbolsUpdated,
      consolidated: json.consolidated,
      failed: [],
    };
  } catch (err: unknown) {
    return {
      imported: 0,
      failed: [
        {
          draftId: "batch",
          reason: err instanceof Error ? err.message : "Import request failed",
        },
      ],
    };
  }
}
