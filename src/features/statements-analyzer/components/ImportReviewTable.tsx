import React from "react";
import type { PortfolioImportDraft } from "../types";

interface ImportReviewTableProps {
  drafts: PortfolioImportDraft[];
  onChangeDraft: (draftId: string, patch: Partial<PortfolioImportDraft>) => void;
}

export default function ImportReviewTable({
  drafts,
  onChangeDraft,
}: ImportReviewTableProps) {
  if (drafts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E5E8EB] bg-white p-6 text-xs text-[#86868B]">
        No investment rows detected yet.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-[#E5E8EB] bg-white">
      <table className="min-w-full text-xs">
        <thead className="bg-[#F5F5F7] text-[#424245]">
          <tr>
            <th className="px-3 py-2 text-left">Line</th>
            <th className="px-3 py-2 text-left">Symbol</th>
            <th className="px-3 py-2 text-left">Date</th>
            <th className="px-3 py-2 text-left">Dollars</th>
            <th className="px-3 py-2 text-left">Entry price</th>
            <th className="px-3 py-2 text-left">Shares</th>
            <th className="px-3 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {drafts.map((draft) => (
            <tr key={draft.draftId} className="border-t border-[#E5E8EB]">
              <td className="px-3 py-2 font-mono">{draft.sourceLine}</td>
              <td className="px-3 py-2">
                <input
                  value={draft.symbol}
                  onChange={(e) =>
                    onChangeDraft(draft.draftId, { symbol: e.target.value.toUpperCase() })
                  }
                  className="w-24 rounded-md border border-[#E5E8EB] px-2 py-1 font-mono"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="date"
                  value={draft.entry_date}
                  onChange={(e) => onChangeDraft(draft.draftId, { entry_date: e.target.value })}
                  className="rounded-md border border-[#E5E8EB] px-2 py-1"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="number"
                  step="0.01"
                  value={draft.dollars_invested}
                  onChange={(e) =>
                    onChangeDraft(draft.draftId, {
                      dollars_invested: Number.parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-24 rounded-md border border-[#E5E8EB] px-2 py-1 font-mono"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={draft.entry_price}
                  onChange={(e) =>
                    onChangeDraft(draft.draftId, {
                      entry_price: Number.parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-24 rounded-md border border-[#E5E8EB] px-2 py-1 font-mono"
                />
              </td>
              <td className="px-3 py-2 font-mono text-[#86868B]">
                {draft.shares != null && draft.shares > 0
                  ? draft.shares.toFixed(6)
                  : "—"}
              </td>
              <td className="px-3 py-2">
                <select
                  value={draft.status}
                  onChange={(e) =>
                    onChangeDraft(draft.draftId, {
                      status: e.target.value as PortfolioImportDraft["status"],
                    })
                  }
                  className="rounded-md border border-[#E5E8EB] px-2 py-1"
                >
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                </select>
                {!draft.valid ? (
                  <p className="mt-1 text-[10px] text-rose-600">{draft.validationMessage}</p>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
