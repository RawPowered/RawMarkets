import type { StatementExportType, StatementRow } from "../types";

export interface StatementImporter {
  id: StatementExportType;
  label: string;
  canParse: (headers: string[], sampleRows: string[][]) => boolean;
  parse: (headers: string[], rows: string[][]) => StatementRow[];
}
