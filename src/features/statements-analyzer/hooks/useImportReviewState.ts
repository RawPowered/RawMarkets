import { useMemo, useState } from "react";
import type { PortfolioImportDraft } from "../types";

export function useImportReviewState(initialDrafts: PortfolioImportDraft[]) {
  const [drafts, setDrafts] = useState<PortfolioImportDraft[]>(initialDrafts);

  const counts = useMemo(() => {
    const pending = drafts.filter((d) => d.status === "pending").length;
    const accepted = drafts.filter((d) => d.status === "accepted").length;
    const rejected = drafts.filter((d) => d.status === "rejected").length;
    return { pending, accepted, rejected };
  }, [drafts]);

  const updateDraft = (draftId: string, patch: Partial<PortfolioImportDraft>) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.draftId === draftId
          ? {
              ...d,
              ...patch,
              valid: Boolean((patch.symbol ?? d.symbol).trim()),
              validationMessage: Boolean((patch.symbol ?? d.symbol).trim())
                ? undefined
                : "Symbol is required.",
            }
          : d
      )
    );
  };

  const setAllStatus = (status: PortfolioImportDraft["status"]) => {
    setDrafts((prev) => prev.map((d) => ({ ...d, status })));
  };

  return { drafts, setDrafts, counts, updateDraft, setAllStatus };
}
