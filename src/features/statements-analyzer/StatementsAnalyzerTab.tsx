import React, { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import ConsolidatedImportReview from "./components/ConsolidatedImportReview";
import { commitDraftsToPortfolio } from "./adapters/portfolioAdapter";
import { parseStatementCsv } from "./services/parseStatementCsv";
import {
  investmentTransactionsFromRows,
  classifyInvestmentTransactions,
} from "./services/classifyInvestmentTransactions";
import {
  consolidateDraftsBySymbol,
  mapRowsToImportDrafts,
} from "./services/consolidateDraftsBySymbol";
import { buildExpenseBreakdown } from "./services/buildExpenseBreakdown";
import { useImportReviewState } from "./hooks/useImportReviewState";
import type { ExpenseBreakdownResult } from "./types";

interface StatementsAnalyzerTabProps {
  onImportComplete?: () => void;
}

export default function StatementsAnalyzerTab({
  onImportComplete,
}: StatementsAnalyzerTabProps) {
  const [importerLabel, setImporterLabel] = useState<string>("None");
  const [expenseResult, setExpenseResult] = useState<ExpenseBreakdownResult | null>(null);
  const [commitMessage, setCommitMessage] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const { drafts, setDrafts, counts, setAllStatus } = useImportReviewState([]);

  const consolidatedGroups = useMemo(
    () => consolidateDraftsBySymbol(drafts),
    [drafts]
  );

  const acceptedCount = useMemo(
    () => drafts.filter((d) => d.status !== "rejected" && d.valid).length,
    [drafts]
  );

  const onCsvUpload = async (file: File) => {
    setParseError(null);
    setCommitMessage("");
    setParsing(true);
    try {
      const text = await file.text();
      const parsed = parseStatementCsv(text);
      const investmentRows = classifyInvestmentTransactions(parsed.rows);
      const txs = investmentTransactionsFromRows(investmentRows);
      const notesByLine = new Map(
        investmentRows.map((r) => [r.sourceLine, `${r.merchant} | ${r.description}`])
      );
      setImporterLabel(parsed.importerLabel);
      setDrafts(mapRowsToImportDrafts(txs, notesByLine));
      setExpenseResult(buildExpenseBreakdown(parsed.rows));
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : "Failed to parse CSV");
    } finally {
      setParsing(false);
    }
  };

  const onToggleGroup = (
    symbol: string,
    status: "pending" | "accepted" | "rejected"
  ) => {
    setDrafts((prev) =>
      prev.map((d) => (d.symbol === symbol ? { ...d, status } : d))
    );
  };

  const commitImports = async () => {
    setBusy(true);
    setCommitMessage("");
    try {
      const toCommit = drafts.map((d) =>
        d.status === "pending" ? { ...d, status: "accepted" as const } : d
      );
      const result = await commitDraftsToPortfolio(toCommit);
      if (result.failed.length > 0) {
        setCommitMessage(result.failed[0]?.reason ?? "Import failed.");
        return;
      }
      setCommitMessage(
        `Imported ${result.transactionsImported ?? 0} transactions across ${result.imported} symbol(s)` +
          (result.consolidated ? ` (merged ${result.consolidated} duplicate rows).` : ".")
      );
      if (result.imported > 0 || (result.transactionsImported ?? 0) > 0) {
        onImportComplete?.();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white border border-[#E5E8EB] rounded-[32px] p-6 space-y-3">
        <h2 className="text-lg font-bold text-[#1D1D1F] tracking-tight">Statements Analyzer</h2>
        <p className="text-xs text-[#86868B]">
          Upload Cash App Investing exports. Buys and sells are merged into one position per
          symbol with entry/exit history.
        </p>
        <label className="inline-flex items-center gap-2 rounded-xl bg-[#1D1D1F] px-4 py-2 text-xs font-bold text-white cursor-pointer">
          <Upload size={14} />
          Upload CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onCsvUpload(file);
              e.currentTarget.value = "";
            }}
          />
        </label>
        <p className="text-[11px] text-[#86868B]">Detected importer: {importerLabel}</p>
        {parsing ? (
          <p className="text-xs text-[#86868B] flex items-center gap-2">
            <span className="w-3 h-3 border-2 border-[#E5E8EB] border-t-[#007AFF] rounded-full animate-spin" />
            Parsing statement…
          </p>
        ) : null}
        {parseError ? <p className="text-xs text-rose-600">{parseError}</p> : null}
      </div>

      <div className="bg-white border border-[#E5E8EB] rounded-[32px] p-6 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-bold text-[#1D1D1F]">
            Consolidated Positions ({consolidatedGroups.length} symbols)
          </h3>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="rounded-full bg-[#F5F5F7] px-2 py-1">Pending {counts.pending}</span>
            <span className="rounded-full bg-[#F5F5F7] px-2 py-1">Accepted {counts.accepted}</span>
            <span className="rounded-full bg-[#F5F5F7] px-2 py-1">Rejected {counts.rejected}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAllStatus("accepted")}
            className="rounded-lg bg-[#F5F5F7] px-3 py-1.5 text-xs font-semibold cursor-pointer"
          >
            Accept all
          </button>
          <button
            type="button"
            onClick={() => setAllStatus("rejected")}
            className="rounded-lg bg-[#F5F5F7] px-3 py-1.5 text-xs font-semibold cursor-pointer"
          >
            Reject all
          </button>
        </div>
        <ConsolidatedImportReview
          groups={consolidatedGroups}
          onToggleGroup={onToggleGroup}
        />
        <button
          type="button"
          disabled={busy || acceptedCount === 0}
          onClick={() => void commitImports()}
          className="rounded-xl bg-[#007AFF] px-4 py-2 text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
        >
          {busy
            ? "Importing..."
            : `Import ${consolidatedGroups.filter((g) => g.status !== "rejected").length} positions`}
        </button>
        {commitMessage ? <p className="text-xs text-emerald-700">{commitMessage}</p> : null}
      </div>

      <div className="bg-white border border-[#E5E8EB] rounded-[32px] p-6 space-y-3">
        <h3 className="text-sm font-bold text-[#1D1D1F]">Expense Breakdown + Bible of Wealth</h3>
        {!expenseResult ? (
          <p className="text-xs text-[#86868B]">Upload a statement to calculate spending split.</p>
        ) : (
          <>
            <p className="text-xs text-[#424245]">
              Total debits analyzed: ${expenseResult.totalSpendUsd.toFixed(2)}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                {expenseResult.categories.map((cat) => (
                  <div key={cat.category} className="rounded-xl border border-[#E5E8EB] p-3">
                    <p className="text-xs font-bold text-[#1D1D1F]">{cat.category}</p>
                    <p className="text-[11px] text-[#86868B]">
                      ${cat.amountUsd.toFixed(2)} ({cat.sharePct.toFixed(2)}%)
                    </p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {expenseResult.wealthChecks.map((check) => (
                  <div key={check.id} className="rounded-xl border border-[#E5E8EB] p-3">
                    <p className="text-xs font-bold text-[#1D1D1F]">{check.title}</p>
                    <p className="text-[11px] text-[#86868B] uppercase">{check.status}</p>
                    <p className="text-[11px] text-[#424245]">{check.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
