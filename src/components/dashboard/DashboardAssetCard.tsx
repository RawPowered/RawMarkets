import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Asset, DashboardSkin } from "../../types";
import SymbolLogo from "../SymbolLogo";
import { categoryBrandTint } from "../../lib/categoryBrand";
import AssetValidationActions from "../AssetValidationActions";
import FeedSourceBadge from "../FeedSourceBadge";
import FeedUnavailableHint from "../FeedUnavailableHint";
import {
  formatDisplayChangePercent,
  formatDisplayPrice,
  formatLastPriceCheck,
  isDisplayChangePositive,
} from "../../lib/feedDisplay";

interface DashboardAssetCardProps {
  symbol: string;
  asset: Asset;
  skin: DashboardSkin;
  accentColor?: string;
  isSelected: boolean;
  isCapturing: boolean;
  editMode: boolean;
  onSelect: () => void;
}

export default function DashboardAssetCard({
  symbol,
  asset,
  skin,
  accentColor,
  isSelected,
  isCapturing,
  editMode,
  onSelect,
}: DashboardAssetCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: symbol,
    disabled: !editMode,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderLeftWidth: accentColor ? 4 : undefined,
    borderLeftColor: accentColor,
  };

  const changePct = formatDisplayChangePercent(
    asset.changePercent,
    asset.priceSource
  );
  const isPositive = isDisplayChangePositive(
    asset.changePercent,
    asset.priceSource
  );

  const skinBase =
    skin === "terminal"
      ? "bg-zinc-900 border-zinc-700 text-zinc-100"
      : skin === "minimal"
        ? "bg-transparent border-transparent shadow-none"
        : "bg-white border-[#E5E8EB]";

  const selectedRing =
    skin === "terminal"
      ? "border-emerald-500 ring-2 ring-emerald-500/20"
      : skin === "branded"
        ? "border-[#007AFF] ring-2 ring-[#007AFF]/15 shadow-lg"
        : "border-[#007AFF] ring-2 ring-[#007AFF]/10 shadow-md";

  const brandTint = accentColor ?? categoryBrandTint(asset.category);

  if (skin === "branded") {
    return (
      <div
        ref={setNodeRef}
        style={{
          ...style,
          boxShadow: isSelected
            ? `0 12px 40px -12px ${brandTint}66`
            : `0 4px 20px -6px ${brandTint}33`,
        }}
        className={`relative w-full rounded-[28px] border overflow-hidden transition-all duration-300 ${
          isDragging ? "opacity-50 z-50 scale-[0.98]" : "hover:-translate-y-1"
        } bg-white ${
          isSelected ? selectedRing : "border-[#E5E8EB]/90 hover:border-[#86868B]/40"
        }`}
      >
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{
            background: `linear-gradient(90deg, ${brandTint}, ${brandTint}88, transparent)`,
          }}
        />
        {editMode && (
          <button
            type="button"
            className="absolute top-3 left-3 z-20 touch-none cursor-grab text-[#86868B] bg-white/90 rounded-full p-1 shadow-sm"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} />
          </button>
        )}
        {isCapturing ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/85 backdrop-blur-sm">
            <span className="text-[10px] font-bold text-violet-800 font-mono animate-pulse">
              Capturing…
            </span>
          </div>
        ) : null}
        <button
          type="button"
          onClick={onSelect}
          className="w-full p-5 pt-6 flex flex-col items-center text-center gap-3 cursor-pointer"
        >
          <div className="absolute top-3 right-3 z-10">
            <AssetValidationActions
              symbol={symbol}
              category={asset.category}
              name={asset.name}
              variant="icon"
            />
          </div>

          <SymbolLogo
            symbol={symbol}
            size="xl"
            brandTint={brandTint}
            resolveRemote
          />

          <div className="w-full min-w-0 space-y-1">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className="text-base font-black tracking-tight text-[#1D1D1F]">
                {asset.symbol}
              </span>
              <span
                className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${brandTint}18`,
                  color: brandTint,
                }}
              >
                {asset.category}
              </span>
            </div>
            <p className="text-[11px] text-[#86868B] leading-snug line-clamp-2 px-1">
              {asset.name}
            </p>
          </div>

          <div className="w-full pt-3 border-t border-[#E5E8EB]/70 space-y-1.5">
            <span className="text-2xl font-black tabular-nums text-[#1D1D1F] tracking-tight block">
              {formatDisplayPrice(asset.current, asset.priceSource)}
            </span>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {changePct ? (
                <span
                  className="text-[11px] font-bold font-mono px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor: isPositive ? "#34C75914" : "#FF3B3014",
                    color: isPositive ? "#248A3D" : "#C93400",
                  }}
                >
                  {changePct}
                </span>
              ) : (
                <span className="text-[10px] text-[#86868B] font-mono">—</span>
              )}
              <FeedSourceBadge
                priceSource={asset.priceSource}
                historySource={asset.historySource}
                compact
              />
            </div>
            {formatLastPriceCheck(asset.lastPriceCheckAt) ? (
              <span className="text-[9px] text-[#86868B] font-mono block">
                {formatLastPriceCheck(asset.lastPriceCheckAt)}
              </span>
            ) : null}
            <FeedUnavailableHint
              note={asset.feedNote}
              className="text-[9px] max-w-full text-center"
            />
          </div>
        </button>
      </div>
    );
  }

  if (skin === "compact") {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`relative flex items-center gap-3 w-full p-2.5 rounded-xl border transition-all ${
          isDragging ? "opacity-50 z-50" : ""
        } ${skinBase} ${isSelected ? selectedRing : "hover:border-[#86868B]"}`}
      >
        {editMode && (
          <button
            type="button"
            className="touch-none cursor-grab text-[#86868B] shrink-0"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={onSelect}
          className="flex flex-1 items-center gap-3 min-w-0 text-left cursor-pointer"
        >
          <SymbolLogo symbol={symbol} size="sm" resolveRemote />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold block truncate">{asset.symbol}</span>
            <span className="text-[10px] text-[#86868B] truncate block">{asset.name}</span>
          </div>
          <div className="text-right shrink-0">
            <span className="text-sm font-extrabold tabular-nums">
              {formatDisplayPrice(asset.current, asset.priceSource)}
            </span>
            {changePct ? (
              <span
                className={`text-[10px] font-mono block ${
                  isPositive ? "text-[#34C759]" : "text-[#FF3B30]"
                }`}
              >
                {changePct}
              </span>
            ) : null}
          </div>
        </button>
        {isCapturing ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 rounded-xl">
            <span className="text-[10px] font-bold text-violet-800 font-mono animate-pulse">
              Capturing…
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  if (skin === "minimal") {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`relative p-4 rounded-2xl transition-all ${isDragging ? "opacity-50" : ""}`}
      >
        {editMode && (
          <button
            type="button"
            className="absolute top-2 left-2 touch-none cursor-grab text-[#86868B]"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} />
          </button>
        )}
        <button type="button" onClick={onSelect} className="w-full text-left cursor-pointer">
          <span className="text-[10px] font-mono text-[#86868B] uppercase">{asset.category}</span>
          <div className="text-2xl font-black tabular-nums text-[#1D1D1F] mt-1">
            {formatDisplayPrice(asset.current, asset.priceSource)}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-bold">{asset.symbol}</span>
            {changePct ? (
              <span
                className={`text-xs font-mono ${
                  isPositive ? "text-[#34C759]" : "text-[#FF3B30]"
                }`}
              >
                {changePct}
              </span>
            ) : null}
          </div>
        </button>
      </div>
    );
  }

  if (skin === "terminal") {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`relative p-4 rounded-lg border font-mono transition-all ${
          isDragging ? "opacity-50" : ""
        } ${skinBase} ${isSelected ? selectedRing : "hover:border-zinc-500"}`}
      >
        {editMode && (
          <button
            type="button"
            className="absolute top-2 left-2 touch-none cursor-grab text-zinc-500"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} />
          </button>
        )}
        <button type="button" onClick={onSelect} className="w-full text-left cursor-pointer pl-4">
          <div className="flex justify-between items-start gap-2">
            <span className="text-emerald-400 font-bold">{asset.symbol}</span>
            {changePct ? (
              <span
                className={`text-xs ${isPositive ? "text-emerald-400" : "text-rose-400"}`}
              >
                {changePct}
              </span>
            ) : null}
          </div>
          <div className="text-xl font-bold tabular-nums mt-2 text-zinc-100">
            {formatDisplayPrice(asset.current, asset.priceSource)}
          </div>
          <span className="text-[10px] text-zinc-500 block mt-1 truncate">{asset.name}</span>
        </button>
        {isCapturing ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-900/90 rounded-lg">
            <span className="text-[10px] text-emerald-400 animate-pulse">Capturing…</span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative text-left w-full p-4 rounded-[24px] border transition-all duration-200 flex flex-col items-start gap-4 hover:-translate-y-1 group overflow-hidden ${
        isDragging ? "opacity-50 z-50" : ""
      } ${skinBase} ${
        isSelected
          ? selectedRing
          : "hover:border-[#86868B] shadow-xs"
      }`}
    >
      {editMode && (
        <button
          type="button"
          className="absolute top-3 left-3 z-10 touch-none cursor-grab text-[#86868B]"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>
      )}
      {isCapturing ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 rounded-[24px]">
          <span className="text-[10px] font-bold text-violet-800 font-mono animate-pulse">
            Capturing…
          </span>
        </div>
      ) : null}
      <button
        type="button"
        onClick={onSelect}
        className="w-full flex flex-col items-start gap-4 cursor-pointer text-left"
      >
        <div className="absolute top-3 right-3 z-10 flex items-center gap-0.5">
          <AssetValidationActions
            symbol={symbol}
            category={asset.category}
            name={asset.name}
            variant="icon"
          />
        </div>

        <div className="w-full flex items-center justify-between pr-8 pl-6">
          <SymbolLogo symbol={symbol} size="sm" resolveRemote />
          <div className="text-right flex flex-col items-end">
            <span className="text-[8px] uppercase font-mono font-extrabold text-[#86868B] tracking-wider block">
              {asset.category}
            </span>
            {changePct ? (
              <span
                className={`text-[10px] font-semibold font-mono block ${
                  isPositive ? "text-[#34C759]" : "text-[#FF3B30]"
                }`}
              >
                {changePct}
              </span>
            ) : (
              <span className="text-[10px] text-[#86868B] font-mono block">—</span>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold text-[#1D1D1F] tracking-tight leading-none">
              {asset.symbol}
            </span>
            <FeedSourceBadge
              priceSource={asset.priceSource}
              historySource={asset.historySource}
              compact
            />
          </div>
          <span className="text-[11px] text-[#86868B] block truncate mt-0.5 max-w-[150px]">
            {asset.name}
          </span>
        </div>

        <div className="w-full flex items-center justify-between pt-2 border-t border-[#E5E8EB]/75 gap-2">
          <div className="min-w-0">
            <span className="text-base font-extrabold text-[#1D1D1F] tabular-nums">
              {formatDisplayPrice(asset.current, asset.priceSource)}
            </span>
            {formatLastPriceCheck(asset.lastPriceCheckAt) ? (
              <span className="text-[9px] text-amber-700 font-mono block mt-0.5">
                Checked {formatLastPriceCheck(asset.lastPriceCheckAt)}
              </span>
            ) : null}
          </div>
          <FeedUnavailableHint
            note={asset.feedNote}
            className="text-[9px] max-w-[140px] text-right"
          />
          <span className="text-[10px] text-[#86868B] font-mono">
            {isSelected ? "Active View" : "Details"}
          </span>
        </div>
      </button>
    </div>
  );
}
