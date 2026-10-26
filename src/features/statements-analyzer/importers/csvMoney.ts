export function normalizeHeader(input: string): string {
  return input
    .trim()
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/\s+/g, "_");
}

/** Parse ($12.34), -12.34, $12.34 into positive USD magnitude. */
export function parseAccountingUsd(input: string): number {
  const t = (input ?? "").trim();
  if (!t) return 0;
  const cleaned = t.replace(/[()$,]/g, "").replace(/^-/, "").trim();
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

export function isDebitAmount(raw: string): boolean {
  const t = raw.trim();
  return t.startsWith("-") || /^\(.*\)$/.test(t);
}

/** Cash App exports: `2026-06-02 12:59:10 CDT` → `2026-06-02` */
export function parseCashAppDate(input: string): string {
  const t = (input ?? "").trim();
  const isoPrefix = t.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoPrefix) return isoPrefix[1];
  const slash = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slash) {
    const [, mm, dd, yyyy] = slash;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return t.slice(0, 10);
}

export function normalizeTickerSymbol(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!s) return "";
  if (s === "BITCOIN") return "BTC";
  return s.replace(/\./g, "-");
}
