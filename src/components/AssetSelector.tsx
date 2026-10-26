import React, { useState, useEffect } from "react";
import { Asset } from "../types";
import { LogoThumbnail } from "./LogoThumbnail";
import AssetValidationActions from "./AssetValidationActions";
import FeedSourceBadge from "./FeedSourceBadge";
import {
  formatDisplayChangePercent,
  formatDisplayPrice,
  isDisplayChangePositive,
} from "../lib/feedDisplay";
import FeedUnavailableHint from "./FeedUnavailableHint";
import { ChevronLeft, ChevronRight, Layers, EyeOff, Trash2 } from "lucide-react";

interface AssetSelectorProps {
  assets: Record<string, Asset>;
  selectedKey: string;
  onSelectKey: (key: string) => void;
  activeCategory: string;
  pinnedSymbols: string[];
  onTogglePin: (key: string) => void;
  hiddenSymbols?: Set<string>;
  customSymbols?: Set<string>;
  onHideSymbol?: (key: string) => void;
  onDeleteSymbol?: (key: string) => void;
}

export default function AssetSelector({
  assets,
  selectedKey,
  onSelectKey,
  activeCategory,
  pinnedSymbols,
  onTogglePin,
  hiddenSymbols,
  customSymbols,
  onHideSymbol,
  onDeleteSymbol,
}: AssetSelectorProps) {
  const assetEntries = Object.entries(assets);
  const filteredEntries =
    activeCategory === "ALL"
      ? assetEntries
      : assetEntries.filter(([_, asset]) => asset.category === activeCategory);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | "All">(8);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, assets]);

  const totalItems = filteredEntries.length;
  const resolvedPageSize = pageSize === "All" ? totalItems || 1 : pageSize;
  const totalPages = Math.ceil(totalItems / resolvedPageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * resolvedPageSize;
  const endIndex = startIndex + resolvedPageSize;
  const paginatedEntries = filteredEntries.slice(startIndex, endIndex);

  return (
    <div className="w-full flex flex-col gap-6 bg-white border border-[#E5E8EB] rounded-[32px] p-6 lg:p-8 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E8EB] pb-4">
        <div>
          <h2 className="text-sm font-extrabold text-[#1D1D1F] tracking-tight flex items-center gap-2">
            <span className="p-1 bg-[#F5F5F7] rounded-lg">
              <Layers size={14} className="text-[#007AFF]" />
            </span>
            {activeCategory === "ALL" ? "All Tracked Instruments" : `${activeCategory} Assets`}
          </h2>
          <p className="text-xs text-[#86868B] mt-0.5 leading-normal">
            Physical spot metrics, key energy giants, and commodity pricing.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider font-mono">
            Show Limit:
          </span>
          <div className="flex items-center bg-[#F5F5F7] p-0.5 rounded-lg border border-[#E5E8EB]">
            {[4, 8, 12, "All"].map((size) => (
              <button
                key={size.toString()}
                onClick={() => {
                  setPageSize(size as number | "All");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                  pageSize === size
                    ? "bg-white text-[#1D1D1F] shadow-xs border border-[#E5E8EB]"
                    : "text-[#86868B] hover:text-[#1D1D1F]"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 min-h-[140px]">
        {paginatedEntries.map(([key, asset]) => {
          const isSelected = selectedKey === key;
          const changePct = formatDisplayChangePercent(
            asset.changePercent,
            asset.priceSource
          );
          const isPositive = isDisplayChangePositive(
            asset.changePercent,
            asset.priceSource
          );
          const isPinned = pinnedSymbols.includes(key);
          const isHidden = hiddenSymbols?.has(key.toUpperCase());

          return (
            <div
              key={key}
              className={`group relative rounded-[28px] transition-all duration-250 border flex flex-col items-start p-5 gap-4 hover:-translate-y-1 ${
                isSelected
                  ? "bg-white border-[#007AFF] shadow-lg shadow-blue-50/50 ring-2 ring-[#007AFF]/10"
                  : "bg-white border-[#E5E8EB] hover:border-[#86868B] shadow-sm"
              } ${isHidden ? "opacity-60" : ""}`}
            >
              <div className="absolute top-4 right-4 z-10 flex items-center gap-0.5">
                <AssetValidationActions
                  symbol={key}
                  category={asset.category}
                  name={asset.name}
                  variant="icon"
                />
                {onHideSymbol && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onHideSymbol(key);
                    }}
                    className="p-1.5 rounded-full border bg-[#F5F5F7] hover:bg-[#E5E8EB] border-[#E5E8EB] text-[#86868B] opacity-60 hover:opacity-100 transition-all cursor-pointer"
                    title="Remove from terminal view"
                  >
                    <EyeOff size={12} />
                  </button>
                )}
                {onDeleteSymbol && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSymbol(key);
                    }}
                    className="p-1.5 rounded-full border bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-600 opacity-70 hover:opacity-100 transition-all cursor-pointer"
                    title="Delete permanently"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin(key);
                  }}
                  className={`p-1.5 rounded-full border transition-all duration-150 cursor-pointer ${
                    isPinned
                      ? "bg-amber-500 border-amber-400 text-white shadow-xs"
                      : "bg-[#F5F5F7] hover:bg-[#E5E8EB] border-[#E5E8EB] text-[#86868B] opacity-60 hover:opacity-100"
                  }`}
                  title={isPinned ? "Unpin alternative asset" : "Pin alternative asset"}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill={isPinned ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="w-3.5 h-3.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17.593 3.322c1.1-1.1 2.9-1.1 4 0 .438.438.438 1.146 0 1.584L12 14.5V21h-6.5L14.5 12l1.093-1.093m1-7.585l-10.322 10.32a.45.45 0 00-.067.544l2.26 3.38m1.2-13.623L3.323 17.593c-1.1 1.1-1.1 2.9 0 4 .438.438 1.146.438 1.584 0l9.593-9.593"
                    />
                  </svg>
                </button>
              </div>

              <button
                type="button"
                onClick={() => onSelectKey(key)}
                className="w-full h-full text-left flex flex-col items-start gap-4 cursor-pointer"
              >
                <div className="w-full flex items-center justify-between pr-8">
                  <LogoThumbnail symbol={key} size="md" />
                  <div className="flex flex-col items-end text-right">
                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#86868B] font-mono">
                      {asset.category}
                    </span>
                    <span className="text-[10px] text-[#424245]">
                      {asset.unit.split(" per ")[0]}
                    </span>
                  </div>
                </div>

                <div className="mt-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-bold text-[#1D1D1F] tracking-tight">
                      {asset.symbol}
                    </span>
                    <FeedSourceBadge
                      priceSource={asset.priceSource}
                      historySource={asset.historySource}
                      compact
                    />
                    {isPinned && (
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-amber-100 text-amber-700 font-mono rounded-[5px] uppercase">
                        Pinned
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[#86868B] line-clamp-1 block leading-tight mt-0.5">
                    {asset.name}
                  </span>
                </div>

                <div className="w-full flex flex-col gap-1 mt-auto pt-2.5 border-t border-dashed border-[#E5E8EB]">
                  <div className="w-full flex items-baseline justify-between">
                    <span className="text-lg font-extrabold text-[#86868B] leading-none tabular-nums">
                      {formatDisplayPrice(asset.current, asset.priceSource)}
                    </span>
                    {changePct != null && isPositive != null ? (
                      <span
                        className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded-lg select-none ${
                          isPositive
                            ? "text-[#34C759] bg-[#34C759]/10"
                            : "text-[#FF3B30] bg-[#FF3B30]/10"
                        }`}
                      >
                        {changePct}
                      </span>
                    ) : null}
                  </div>
                  <FeedUnavailableHint note={asset.feedNote} />
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-[#E5E8EB] mt-2">
          <div className="text-xs font-medium text-[#86868B]">
            Showing <span className="font-mono font-bold text-[#1D1D1F]">{startIndex + 1}</span> to{" "}
            <span className="font-mono font-bold text-[#1D1D1F]">
              {Math.min(endIndex, totalItems)}
            </span>{" "}
            of <span className="font-mono font-bold text-[#1D1D1F]">{totalItems}</span> matching options
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage === 1}
              className="p-2 bg-[#F5F5F7] hover:bg-[#E5E8EB] rounded-xl border border-[#E5E8EB]/70 text-[#1D1D1F] disabled:opacity-40 disabled:hover:bg-[#F5F5F7] shadow-2xs transition-all cursor-pointer"
            >
              <ChevronLeft size={14} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
              const isCurrent = safeCurrentPage === p;
              return (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all border cursor-pointer ${
                    isCurrent
                      ? "bg-[#007AFF] text-white border-[#007AFF] shadow-xs"
                      : "bg-[#F5F5F7] hover:bg-[#E5E8EB] text-[#424245] border-[#E5E8EB]/70"
                  }`}
                >
                  {p}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage === totalPages}
              className="p-2 bg-[#F5F5F7] hover:bg-[#E5E8EB] rounded-xl border border-[#E5E8EB]/70 text-[#1D1D1F] disabled:opacity-40 disabled:hover:bg-[#F5F5F7] shadow-2xs transition-all cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
