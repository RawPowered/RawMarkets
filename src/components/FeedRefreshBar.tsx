import { Loader2, Radio } from "lucide-react";
import { sanitizeFeedNoteForDisplay } from "../lib/feedDisplay";

export type FeedRefreshPhase =
  | "idle"
  | "metals"
  | "market"
  | "symbol"
  | "done"
  | "error";

export interface ScrapeActivityCurrent {
  provider: string;
  symbol: string;
  url: string;
  phase?: string;
}

export interface FeedRefreshBarProps {
  phase: FeedRefreshPhase;
  detail: string;
  isActive: boolean;
  lastFetchedAt: string | null;
  livePriceCount: number;
  simulatedPriceCount: number;
  captureKey?: string | null;
  scrapeLog?: string[];
  currentJob?: ScrapeActivityCurrent | null;
}

export default function FeedRefreshBar({
  phase,
  detail,
  isActive,
  lastFetchedAt,
  livePriceCount,
  simulatedPriceCount,
  captureKey,
  currentJob = null,
}: FeedRefreshBarProps) {
  const showBar = isActive || phase === "done";

  if (!showBar && !lastFetchedAt) return null;

  const phaseLabel =
    phase === "metals"
      ? "Metals update"
      : phase === "market"
        ? "Market update"
        : phase === "symbol"
          ? `Updating ${captureKey ?? "symbol"}`
          : phase === "done"
            ? "Feed updated"
            : phase === "error"
              ? "Update failed"
              : "Live feed";

  const currentLine = currentJob ? `Updating ${currentJob.symbol}…` : null;
  const staleCount = simulatedPriceCount;
  const detailText = sanitizeFeedNoteForDisplay(detail) ?? detail;

  return (
    <div
      className={`mx-4 md:mx-10 mt-2 rounded-2xl border text-xs overflow-hidden ${
        isActive
          ? "bg-violet-50 border-violet-200 text-violet-950"
          : phase === "error"
            ? "bg-amber-50 border-amber-200 text-amber-950"
            : "bg-white border-[#E5E8EB] text-[#424245]"
      }`}
      role="status"
      aria-live="polite"
    >
      {isActive ? (
        <div className="h-1 w-full bg-violet-200 overflow-hidden">
          <div className="h-full w-1/3 bg-violet-600 animate-pulse rounded-full" />
        </div>
      ) : null}

      <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isActive ? (
            <Loader2 size={16} className="shrink-0 animate-spin text-violet-700" />
          ) : (
            <Radio size={16} className="shrink-0 text-emerald-600" />
          )}
          <div className="min-w-0">
            <span className="font-bold block">{phaseLabel}</span>
            {currentLine ? (
              <span className="text-[11px] font-mono font-semibold text-violet-800 block truncate">
                {currentLine}
              </span>
            ) : null}
            <span className="text-[11px] opacity-90 block truncate">{detailText}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 font-mono text-[10px]">
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            {livePriceCount} live
          </span>
          {staleCount > 0 ? (
            <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
              {staleCount} pending
            </span>
          ) : null}
          {lastFetchedAt ? (
            <span className="text-[#86868B]">
              Updated{" "}
              {new Date(lastFetchedAt).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
