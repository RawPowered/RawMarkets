import type { StatementImporter } from "./types";
import { cashAppInvestingCsvImporter } from "./cashAppInvestingCsvImporter";
import { cashAppCsvImporter } from "./cashAppCsvImporter";
import { genericCsvImporter } from "./genericCsvImporter";

const importers: StatementImporter[] = [
  cashAppInvestingCsvImporter,
  cashAppCsvImporter,
  genericCsvImporter,
];

export function listStatementImporters(): StatementImporter[] {
  return importers;
}

export function detectImporter(
  headers: string[],
  sampleRows: string[][]
): StatementImporter {
  return (
    importers.find((imp) => imp.canParse(headers, sampleRows)) ?? genericCsvImporter
  );
}
