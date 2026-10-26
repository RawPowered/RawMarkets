import React from "react";
import { LayoutGrid, Plus, RotateCcw, SlidersHorizontal } from "lucide-react";
import type { DashboardLayoutV1, DashboardSkin, DashboardSortMode } from "../../types";
import { GROUP_COLOR_PRESETS } from "../../lib/dashboardLayout";

const SKIN_OPTIONS: { value: DashboardSkin; label: string }[] = [
  { value: "branded", label: "Branded (logos)" },
  { value: "classic", label: "Classic" },
  { value: "compact", label: "Compact" },
  { value: "terminal", label: "Terminal" },
  { value: "minimal", label: "Minimal" },
];

const SORT_OPTIONS: { value: DashboardSortMode; label: string }[] = [
  { value: "manual", label: "Manual (drag)" },
  { value: "gainers", label: "Gainers" },
  { value: "losers", label: "Losers" },
  { value: "name", label: "Name A–Z" },
  { value: "price_desc", label: "Price high → low" },
  { value: "price_asc", label: "Price low → high" },
];

interface DashboardCustomizeBarProps {
  layout: DashboardLayoutV1;
  editMode: boolean;
  onEditModeChange: (on: boolean) => void;
  onSkinChange: (skin: DashboardSkin) => void;
  onSortChange: (mode: DashboardSortMode) => void;
  onAddGroup: () => void;
  onResetLayout: () => void;
  onGroupColorChange: (groupId: string, color: string) => void;
  onSymbolAccentChange: (symbol: string, color: string | null) => void;
  selectedSymbol?: string;
}

export default function DashboardCustomizeBar({
  layout,
  editMode,
  onEditModeChange,
  onSkinChange,
  onSortChange,
  onAddGroup,
  onResetLayout,
  onGroupColorChange,
  onSymbolAccentChange,
  selectedSymbol,
}: DashboardCustomizeBarProps) {
  const selectedAccent = selectedSymbol
    ? layout.symbolAccents[selectedSymbol.toUpperCase()]
    : undefined;

  return (
    <div className="flex flex-col gap-3 p-4 bg-[#F5F5F7] border border-[#E5E8EB] rounded-2xl">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onEditModeChange(!editMode)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
            editMode
              ? "bg-[#007AFF] text-white"
              : "bg-white border border-[#E5E8EB] text-[#1D1D1F] hover:border-[#86868B]"
          }`}
        >
          <SlidersHorizontal size={12} />
          {editMode ? "Done editing" : "Edit layout"}
        </button>

        {editMode && (
          <button
            type="button"
            onClick={onAddGroup}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-white border border-[#E5E8EB] text-[#1D1D1F] hover:border-[#86868B] cursor-pointer"
          >
            <Plus size={12} />
            Add group
          </button>
        )}

        <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#86868B]">
          <LayoutGrid size={12} />
          Skin
          <select
            value={layout.skin}
            onChange={(e) => onSkinChange(e.target.value as DashboardSkin)}
            className="px-2 py-1 rounded-lg border border-[#E5E8EB] bg-white text-[#1D1D1F] text-[11px] font-mono cursor-pointer"
          >
            {SKIN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#86868B]">
          Sort
          <select
            value={layout.sortMode}
            onChange={(e) => onSortChange(e.target.value as DashboardSortMode)}
            className="px-2 py-1 rounded-lg border border-[#E5E8EB] bg-white text-[#1D1D1F] text-[11px] font-mono cursor-pointer"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                "Reset dashboard layout to default watchlist? Pin order will be preserved in one group."
              )
            ) {
              onResetLayout();
            }
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer ml-auto"
        >
          <RotateCcw size={12} />
          Reset layout
        </button>
      </div>

      {editMode && selectedSymbol && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E5E8EB]/80">
          <span className="text-[10px] font-mono text-[#86868B] uppercase">
            Accent: {selectedSymbol}
          </span>
          {GROUP_COLOR_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              title={color}
              onClick={() => onSymbolAccentChange(selectedSymbol, color)}
              className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                selectedAccent === color ? "border-[#1D1D1F]" : "border-white"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
          <button
            type="button"
            onClick={() => onSymbolAccentChange(selectedSymbol, null)}
            className="text-[10px] font-bold text-[#86868B] px-2 py-1 rounded-lg border border-[#E5E8EB] bg-white cursor-pointer"
          >
            Clear accent
          </button>
        </div>
      )}

      {editMode && layout.groups.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-2 border-t border-[#E5E8EB]/80">
          {layout.groups.map((g) => (
            <div key={g.id} className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-[#86868B] truncate max-w-[80px]">
                {g.name}
              </span>
              {GROUP_COLOR_PRESETS.map((color) => (
                <button
                  key={`${g.id}-${color}`}
                  type="button"
                  onClick={() => onGroupColorChange(g.id, color)}
                  className={`w-5 h-5 rounded-full border cursor-pointer ${
                    g.color === color ? "border-[#1D1D1F]" : "border-white"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
