import React, { useCallback, useEffect, useState } from "react";
import { apiFetch, apiFetchWithTimeout, readApiJson } from "../../lib/api";
import type { PortfolioEnrichedHolding, PortfolioResponse } from "../../types";
import PortfolioSummaryBar from "./PortfolioSummaryBar";
import HoldingForm from "./HoldingForm";
import HoldingCard from "./HoldingCard";
import SignalsPanel from "./SignalsPanel";
import AllocationPanel from "./AllocationPanel";
import ResearchPanel from "./ResearchPanel";
interface PortfolioPageProps {
  /** Full live quote refresh (POST /api/portfolio/refresh) */
  refreshNonce?: number;
  /** Fast reload from DB/cache (GET /api/portfolio) — e.g. after statement import */
  reloadNonce?: number;
  onRefreshingChange?: (refreshing: boolean) => void;
  onOpenBible?: () => void;
  onRequestReload?: () => void;
}

const emptyAggregates = {
  totalValue: 0,
  totalCost: 0,
  dayPnlUsd: 0,
  safePct: 0,
  aggressivePct: 0,
  ponziPct: 0,
};

export default function PortfolioPage({
  refreshNonce = 0,
  reloadNonce = 0,
  onRefreshingChange,
  onOpenBible,
  onRequestReload,
}: PortfolioPageProps) {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [duplicateSymbols, setDuplicateSymbols] = useState<string[]>([]);
  const [consolidating, setConsolidating] = useState(false);
  const [consolidateMsg, setConsolidateMsg] = useState<string | null>(null);
  const [archivedHoldings, setArchivedHoldings] = useState<
    PortfolioEnrichedHolding[]
  >([]);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [archivingId, setArchivingId] = useState<number | null>(null);

  const load = useCallback(async (fresh = false, background = false) => {
    if (fresh || background) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const path = fresh ? "/api/portfolio/refresh" : "/api/portfolio";
      const resp = await apiFetchWithTimeout(
        path,
        fresh ? { method: "POST" } : undefined,
        fresh ? 15_000 : 30_000
      );
      const json = await readApiJson<PortfolioResponse & { message?: string }>(
        resp
      );
      if (!resp.ok || !json.success) {
        setError(json.message ?? "Failed to load portfolio.");
        return;
      }
      setData(json);
      setSelectedId((prev) =>
        prev != null && json.holdings.some((h) => h.id === prev)
          ? prev
          : json.holdings[0]?.id ?? null
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Load failed.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    if (refreshNonce > 0) void load(true);
  }, [refreshNonce, load]);

  useEffect(() => {
    if (reloadNonce > 0) void load(false, true);
  }, [reloadNonce, load]);

  useEffect(() => {
    onRefreshingChange?.(refreshing);
  }, [refreshing, onRefreshingChange]);

  useEffect(() => {
    void (async () => {
      try {
        const resp = await apiFetch("/api/portfolio/duplicate-symbols");
        const json = await readApiJson<{ symbols?: string[] }>(resp);
        if (resp.ok) setDuplicateSymbols(json.symbols ?? []);
      } catch {
        /* optional */
      }
    })();
  }, [data?.holdings.length, reloadNonce, refreshNonce]);

  const handleConsolidateDuplicates = async () => {
    setConsolidating(true);
    setConsolidateMsg(null);
    try {
      const resp = await apiFetch("/api/portfolio/consolidate-duplicates", {
        method: "POST",
      });
      const json = await readApiJson<{
        success?: boolean;
        symbolsConsolidated?: number;
        rowsRemoved?: number;
        message?: string;
      }>(resp);
      if (!resp.ok || !json.success) {
        setConsolidateMsg(json.message ?? "Consolidation failed.");
        return;
      }
      setConsolidateMsg(
        `Merged ${json.symbolsConsolidated ?? 0} symbol(s), removed ${json.rowsRemoved ?? 0} duplicate row(s).`
      );
      setDuplicateSymbols([]);
      onRequestReload?.();
      await load(false, true);
    } finally {
      setConsolidating(false);
    }
  };

  useEffect(() => {
    if (data?.research?.status !== "running") return;
    const poll = setInterval(async () => {
      try {
        const resp = await apiFetch("/api/portfolio/research/status");
        const json = await readApiJson<{
          status?: string;
        }>(resp);
        if (json.status === "running") return;
        void load(false);
      } catch {
        /* ignore transient poll errors */
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [data?.research?.status, load]);

  const loadArchived = useCallback(async () => {
    try {
      const resp = await apiFetch("/api/portfolio/archived");
      const json = await readApiJson<{
        success?: boolean;
        holdings?: PortfolioEnrichedHolding[];
      }>(resp);
      if (resp.ok && json.success) {
        setArchivedHoldings(json.holdings ?? []);
      }
    } catch {
      setArchivedHoldings([]);
    }
  }, []);

  useEffect(() => {
    if (archivedOpen) void loadArchived();
  }, [archivedOpen, loadArchived, reloadNonce]);

  const handleArchive = async (id: number) => {
    if (!confirm("Archive this position as closed out?")) return;
    setArchivingId(id);
    try {
      const resp = await apiFetch(`/api/portfolio/holdings/${id}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      const json = await readApiJson<{ success?: boolean }>(resp);
      if (json.success) {
        if (selectedId === id) setSelectedId(null);
        await load(false, true);
        if (archivedOpen) await loadArchived();
      }
    } finally {
      setArchivingId(null);
    }
  };

  const handleRestore = async (id: number) => {
    setArchivingId(id);
    try {
      const resp = await apiFetch(`/api/portfolio/holdings/${id}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });
      const json = await readApiJson<{ success?: boolean }>(resp);
      if (json.success) {
        await load(false, true);
        await loadArchived();
      }
    } finally {
      setArchivingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remove this holding from your portfolio?")) return;
    setDeletingId(id);
    try {
      const resp = await apiFetch(`/api/portfolio/holdings/${id}`, {
        method: "DELETE",
      });
      const json = await readApiJson<{ success?: boolean }>(resp);
      if (json.success) {
        if (selectedId === id) setSelectedId(null);
        await load(true);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const holdings = data?.holdings ?? [];
  const selected =
    holdings.find((h) => h.id === selectedId) ?? holdings[0] ?? null;

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white border border-[#E5E8EB] rounded-[32px]">
        <span className="w-8 h-8 border-2 border-[#E5E8EB] border-t-[#007AFF] rounded-full animate-spin" />
        <p className="text-xs font-bold text-[#86868B] mt-3">Loading portfolio…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {error ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800">
          {error}
          <button
            type="button"
            onClick={() => void load(true)}
            className="ml-3 font-bold underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : null}

      <PortfolioSummaryBar
        aggregates={data?.aggregates ?? emptyAggregates}
        holdingCount={holdings.length}
        refreshedAt={data?.refreshed_at ?? null}
        loading={refreshing}
        onRefresh={() => void load(true)}
      />

      {onOpenBible ? (
        <p className="text-[11px] text-[#86868B]">
          Signals follow your{" "}
          <button
            type="button"
            onClick={onOpenBible}
            className="text-[#007AFF] font-bold underline cursor-pointer"
          >
            Investor&apos;s Bible
          </button>{" "}
          principles (barbell, Kelly, disposition).
        </p>
      ) : null}

      {duplicateSymbols.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900">
          <span>
            Duplicate holdings detected for{" "}
            <strong>{duplicateSymbols.join(", ")}</strong>. Merge into one
            position per symbol?
          </span>
          <button
            type="button"
            disabled={consolidating}
            onClick={() => void handleConsolidateDuplicates()}
            className="px-3 py-1.5 bg-amber-600 text-white font-bold rounded-lg disabled:opacity-50 cursor-pointer"
          >
            {consolidating ? "Merging…" : "Consolidate duplicates"}
          </button>
        </div>
      ) : null}

      {consolidateMsg ? (
        <p className="text-xs text-emerald-700 font-medium">{consolidateMsg}</p>
      ) : null}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1 space-y-6">
          <HoldingForm onAdded={() => void load(true)} />
          {data ? (
            <AllocationPanel
              holdings={holdings}
              aggregates={data.aggregates}
              safeTarget={data.settings.safe_target_pct}
              aggressiveTarget={data.settings.aggressive_target_pct}
            />
          ) : null}
        </div>

        <div className="xl:col-span-2 space-y-6">
          <SignalsPanel signals={data?.signals ?? []} />
          <ResearchPanel selected={selected} meta={data?.research} />

          {holdings.length === 0 ? (
            <div className="bg-white border border-dashed border-[#E5E8EB] rounded-[28px] p-10 text-center">
              <p className="text-sm font-bold text-[#1D1D1F]">No holdings yet</p>
              <p className="text-xs text-[#86868B] mt-2 max-w-sm mx-auto">
                Add a position with ticker, entry date, and price, or import from
                Statements Analyzer.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {holdings.map((h: PortfolioEnrichedHolding) => (
                <div key={h.id}>
                  <HoldingCard
                    holding={h}
                    selected={selected?.id === h.id}
                    onSelect={() => setSelectedId(h.id)}
                    onDelete={handleDelete}
                    onArchive={handleArchive}
                    onHoldingUpdated={() => void load(false, true)}
                    deleting={deletingId === h.id}
                    archiving={archivingId === h.id}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="border border-[#E5E8EB] rounded-[24px] overflow-hidden">
            <button
              type="button"
              onClick={() => setArchivedOpen(!archivedOpen)}
              className="w-full px-4 py-3 text-left text-xs font-bold text-[#424245] hover:bg-[#FAFAFC] cursor-pointer"
            >
              Archived positions
              {archivedHoldings.length > 0
                ? ` (${archivedHoldings.length})`
                : ""}
            </button>
            {archivedOpen ? (
              <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {archivedHoldings.length === 0 ? (
                  <p className="text-[10px] text-[#86868B] col-span-2 py-2">
                    No archived positions.
                  </p>
                ) : (
                  archivedHoldings.map((h) => (
                    <div key={h.id}>
                    <HoldingCard
                      holding={h}
                      selected={false}
                      onSelect={() => {}}
                      onDelete={handleDelete}
                      onRestore={handleRestore}
                      archived
                      deleting={deletingId === h.id}
                      archiving={archivingId === h.id}
                    />
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
