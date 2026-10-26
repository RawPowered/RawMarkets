import React from "react";
import { Asset, SpecialMetalRate } from "../types";
import type { DashboardLayoutV1, DashboardSkin, DashboardSortMode } from "../types";
import { Star } from "lucide-react";
import PreciousMetalsSpotPanel from "./PreciousMetalsSpotPanel";
import AssetChart from "./AssetChart";
import MarketSentimentPanel from "./MarketSentimentPanel";
import NewsBayWidget from "./news/NewsBayWidget";
import AssetValidationActions from "./AssetValidationActions";
import DashboardCustomizeBar from "./dashboard/DashboardCustomizeBar";
import DashboardWatchlist from "./dashboard/DashboardWatchlist";

interface DashboardOverviewProps {
  assets: Record<string, Asset>;
  pinnedSymbols: string[];
  selectedKey: string;
  metalRates: Record<string, SpecialMetalRate>;
  metalSource: string;
  metalsFromLive: boolean;
  metalsFeedNote?: string | null;
  metalLoading: boolean;
  capturingKeys: Set<string>;
  onSelectAsset: (key: string) => void;
  setActivePage: (
    page: "overview" | "terminal" | "insights" | "config" | "news-bay"
  ) => void;
  setHasSerpapiKey: (active: boolean) => void;
  layout: DashboardLayoutV1;
  editMode: boolean;
  onEditModeChange: (on: boolean) => void;
  onLayoutChange: (layout: DashboardLayoutV1) => void;
  onSkinChange: (skin: DashboardSkin) => void;
  onSortChange: (mode: DashboardSortMode) => void;
  onAddGroup: () => void;
  onResetLayout: () => void;
  onGroupColorChange: (groupId: string, color: string) => void;
  onSymbolAccentChange: (symbol: string, color: string | null) => void;
}

export default function DashboardOverview({
  assets,
  pinnedSymbols,
  selectedKey,
  metalRates,
  metalSource,
  metalsFromLive,
  metalsFeedNote,
  metalLoading,
  capturingKeys,
  onSelectAsset,
  setActivePage,
  setHasSerpapiKey,
  layout,
  editMode,
  onEditModeChange,
  onLayoutChange,
  onSkinChange,
  onSortChange,
  onAddGroup,
  onResetLayout,
  onGroupColorChange,
  onSymbolAccentChange,
}: DashboardOverviewProps) {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-6 border border-[#E5E8EB] rounded-[32px] shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#1D1D1F] tracking-tight flex items-center gap-2">
            <span>Economic Indices Health</span>
            <span className="text-[10px] font-mono px-2 py-0.5 bg-[#34C759]/10 text-[#34C759] rounded-md font-bold">
              Live Broadcast
            </span>
          </h2>
          <p className="text-xs text-[#86868B] mt-1">
            Consolidated signal weights from Pinned watches and commodities markets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2.5 bg-[#F5F5F7] rounded-2xl border border-[#E5E8EB] text-center min-w-[100px]">
            <span className="text-[9px] font-extrabold text-[#86868B] tracking-wider uppercase block font-mono">
              Pinned
            </span>
            <span className="text-base font-bold text-[#1D1D1F]">
              {pinnedSymbols.length} Instruments
            </span>
          </div>
          <div className="px-4 py-2.5 bg-[#F5F5F7] rounded-2xl border border-[#E5E8EB] text-center min-w-[100px]">
            <span className="text-[9px] font-extrabold text-[#86868B] tracking-wider uppercase block font-mono">
              Available
            </span>
            <span className="text-base font-bold text-[#1D1D1F]">
              {Object.keys(assets).length} Instruments
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-[#1D1D1F] tracking-tight uppercase tracking-wider text-[11px] font-mono flex items-center gap-1.5 text-[#86868B]">
          <Star size={12} className="text-amber-500 fill-amber-500" />
          Your Pinned Asset Watchlist
        </h3>

        <DashboardCustomizeBar
          layout={layout}
          editMode={editMode}
          onEditModeChange={onEditModeChange}
          onSkinChange={onSkinChange}
          onSortChange={onSortChange}
          onAddGroup={onAddGroup}
          onResetLayout={onResetLayout}
          onGroupColorChange={onGroupColorChange}
          onSymbolAccentChange={onSymbolAccentChange}
          selectedSymbol={selectedKey}
        />

        {pinnedSymbols.length === 0 ? (
          <div className="p-8 border border-dashed border-[#E5E8EB] bg-white text-center rounded-[28px]">
            <p className="text-xs font-bold text-[#1D1D1F]">
              No pinned instruments inside your terminal.
            </p>
            <p className="text-xs text-[#86868B] mt-1 font-mono">
              Navigate to the Track &amp; Search Terminal to manage priority anchors.
            </p>
            <button
              onClick={() => setActivePage("terminal")}
              className="mt-3 px-4 py-1.5 bg-[#007AFF] text-white text-[11px] font-bold rounded-full hover:bg-opacity-90 transition-all cursor-pointer"
            >
              Open Track Panel
            </button>
          </div>
        ) : (
          <DashboardWatchlist
            layout={layout}
            assets={assets}
            selectedKey={selectedKey}
            capturingKeys={capturingKeys}
            editMode={editMode}
            onSelectAsset={onSelectAsset}
            onLayoutChange={onLayoutChange}
          />
        )}
      </div>

      {Object.keys(metalRates).length > 0 && (
        <div className="animate-fade-in">
          <PreciousMetalsSpotPanel
            rates={metalRates}
            source={metalSource}
            fromLive={metalsFromLive}
            feedNote={metalsFeedNote}
            loading={metalLoading}
          />
        </div>
      )}

      {assets[selectedKey] ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-2">
            <span className="text-[11px] font-extrabold font-mono text-[#86868B] uppercase tracking-wider">
              Dynamic Index Analytics Chart
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#007AFF] font-medium font-mono">
                Active Target: {selectedKey}
              </span>
              <AssetValidationActions
                symbol={assets[selectedKey].symbol}
                category={assets[selectedKey].category}
                name={assets[selectedKey].name}
                variant="button"
              />
            </div>
          </div>
          <AssetChart
            asset={assets[selectedKey]}
            isCapturing={capturingKeys.has(selectedKey)}
            captureLabel={
              assets[selectedKey].category === "METALS"
                ? `Scraping Kitco for ${selectedKey}…`
                : `Scraping Yahoo for ${assets[selectedKey].symbol}…`
            }
          />
        </div>
      ) : null}

      {assets[selectedKey] && (
        <div className="space-y-4">
          <NewsBayWidget
            symbol={selectedKey}
            assetName={assets[selectedKey].name}
            onOpenNewsBay={() => setActivePage("news-bay")}
          />
          <MarketSentimentPanel
            selectedSymbol={selectedKey}
            selectedAssetName={assets[selectedKey].name}
            onSerpApiStatusFound={setHasSerpapiKey}
          />
        </div>
      )}

    </div>
  );
}
