import type { StatementImporter } from "./types";
import type { StatementRow } from "../types";
import { normalizeHeader } from "./csvMoney";

function parseAmount(raw: string): { amount: number; kind: "debit" | "credit" } | null {
  const cleaned = raw.replace(/[$,]/g, "").trim();
  if (!cleaned) return null;
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return null;
  return {
    amount: Math.abs(value),
    kind: value < 0 ? "debit" : "credit",
  };
}

export const genericCsvImporter: StatementImporter = {
  id: "generic_csv",
  label: "Generic Bank CSV",
  canParse: (headers) => {
    const h = headers.map(normalizeHeader);
    return (
      (h.includes("date") || h.includes("posted_date")) &&
      (h.includes("amount") || h.includes("debit") || h.includes("credit")) &&
      (h.includes("description") || h.includes("merchant") || h.includes("payee"))
    );
  },
  parse: (headers, rows) => {
    const h = headers.map(normalizeHeader);
    const out: StatementRow[] = [];
    rows.forEach((cols, idx) => {
      const get = (name: string) => cols[h.indexOf(name)] ?? "";
      const date = get("date") || get("posted_date");
      const merchant = get("merchant") || get("payee") || get("description");
      const description = get("description") || merchant;
      const amountField =
        get("amount") ||
        (get("debit") ? `-${get("debit")}` : "") ||
        get("credit");
      const parsed = parseAmount(amountField);
      if (!date || !merchant || !parsed || parsed.amount <= 0) return;
      out.push({
        sourceType: "generic_csv",
        sourceLine: idx + 2,
        date,
        merchant: merchant.trim(),
        description: description.trim(),
        amountUsd: parsed.amount,
        kind: parsed.kind,
        categoryHint: "general",
      });
    });
    return out;
  },
};
