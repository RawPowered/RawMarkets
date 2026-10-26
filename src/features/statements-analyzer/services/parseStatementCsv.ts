import { detectImporter } from "../importers/registry";
import type { StatementRow } from "../types";

export interface ParseStatementCsvResult {
  importerId: string;
  importerLabel: string;
  rows: StatementRow[];
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

export function parseStatementCsv(csvText: string): ParseStatementCsvResult {
  const lines = csvText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return { importerId: "generic_csv", importerLabel: "Generic Bank CSV", rows: [] };
  }
  const headers = parseCsvLine(lines[0]).map((h) =>
    h.replace(/^\uFEFF/, "").trim()
  );
  const rows = lines.slice(1).map(parseCsvLine);
  const importer = detectImporter(headers, rows.slice(0, 8));
  return {
    importerId: importer.id,
    importerLabel: importer.label,
    rows: importer.parse(headers, rows),
  };
}
