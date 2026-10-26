import React from "react";
import { Asset, SymbolSearchHit, SymbolSearchSource, SymbolSearchResponse } from "../types";
import { apiFetch, apiFetchWithTimeout, apiUrl, readApiJson } from "../lib/api";
import {
  Search as SearchIcon,
  X,
  Plus,
  Coins,
  Activity,
  CheckCircle,
  HelpCircle,
  Globe,
  Database,
  Sparkles,
  Cpu,
  Check,
  PlusCircle,
  TrendingUp,
  Flame,
  Anchor,
  EyeOff
} from "lucide-react";
import AssetSelector from "./AssetSelector";
import AssetChart from "./AssetChart";
import AssetValidationActions from "./AssetValidationActions";
import MarketSentimentPanel from "./MarketSentimentPanel";
import NewsBayWidget from "./news/NewsBayWidget";

interface SearchTerminalProps {
  assets: Record<string, Asset>;
  filteredAssetsObj: Record<string, Asset>;
  selectedKey: string;
  setSelectedKey: (key: string) => void;
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  pinnedSymbols: string[];
  handleTogglePin: (key: string) => void;
  hasApiKeyOnBackend: boolean;
  setHasSerpapiKey: (active: boolean) => void;
  onRefreshMarketData: () => void;
  onAssetAdded: (symbol: string, item: Asset, meta?: { captured?: boolean }) => void;
  hiddenSymbols: Set<string>;
  customSymbols: Set<string>;
  showHiddenSymbols: boolean;
  onToggleShowHidden: () => void;
  onHideSymbol: (symbol: string, hidden: boolean) => void;
  onDeleteSymbol: (symbol: string) => void;
  onRestoreAllHidden: () => void;
  onOpenNewsBay?: () => void;
}

const SOURCE_LABELS: Record<SymbolSearchSource, string> = {
  yahoo: "Yahoo",
  google_finance: "Google",
  coinbase: "Coinbase",
  alpha_vantage: "AV",
  local: "Local",
};

function SearchSourceBadge({ source }: { source: SymbolSearchSource }) {
  const colors: Record<SymbolSearchSource, string> = {
    yahoo: "bg-violet-100 text-violet-700 border-violet-200",
    google_finance: "bg-emerald-100 text-emerald-700 border-emerald-200",
    coinbase: "bg-blue-100 text-blue-700 border-blue-200",
    alpha_vantage: "bg-amber-100 text-amber-700 border-amber-200",
    local: "bg-zinc-100 text-zinc-600 border-zinc-200",
  };
  return (
    <span
      className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded font-mono uppercase border ${colors[source]}`}
    >
      {SOURCE_LABELS[source]}
    </span>
  );
}

export default function SearchTerminal({
  assets,
  filteredAssetsObj,
  selectedKey,
  setSelectedKey,
  activeCategory,
  setActiveCategory,
  searchQuery,
  setSearchQuery,
  pinnedSymbols,
  handleTogglePin,
  hasApiKeyOnBackend,
  setHasSerpapiKey,
  onRefreshMarketData,
  onAssetAdded,
  hiddenSymbols,
  customSymbols,
  showHiddenSymbols,
  onToggleShowHidden,
  onHideSymbol,
  onDeleteSymbol,
  onRestoreAllHidden,
  onOpenNewsBay,
}: SearchTerminalProps) {
  const [showSearchEngine, setShowSearchEngine] = React.useState(false);
  const [searchQueryApi, setSearchQueryApi] = React.useState("");
  const [searchMode, setSearchMode] = React.useState<"symbol" | "name" | "keyword">("keyword");
  const [searchSector, setSearchSector] = React.useState<"ALL" | "METALS" | "ENERGY" | "TECH" | "MARKETS" | "FINANCE">("ALL");
  const [searchResults, setSearchResults] = React.useState<SymbolSearchHit[]>([]);
  const [searchSources, setSearchSources] = React.useState<SymbolSearchSource[]>([]);
  const [searchCached, setSearchCached] = React.useState(false);
  const [loadingSearch, setLoadingSearch] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [addedSymbols, setAddedSymbols] = React.useState<Record<string, boolean>>({});
  const [typeaheadHits, setTypeaheadHits] = React.useState<SymbolSearchHit[]>([]);
  const [typeaheadLoading, setTypeaheadLoading] = React.useState(false);
  const [typeaheadOpen, setTypeaheadOpen] = React.useState(false);

  // Debounced live typeahead on filter bar query
  React.useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setTypeaheadHits([]);
      setTypeaheadOpen(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      setTypeaheadLoading(true);
      try {
        const url = apiUrl(
          `/api/search-symbol?q=${encodeURIComponent(q)}&mode=keyword&category=${activeCategory}`
        );
        const resp = await fetch(url);
        const data = (await resp.json()) as SymbolSearchResponse;
        if (resp.ok && data.success) {
          setTypeaheadHits(data.matches ?? []);
          setTypeaheadOpen(true);
        }
      } catch {
        setTypeaheadHits([]);
      } finally {
        setTypeaheadLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery, activeCategory]);

  const applySearchResponse = (data: SymbolSearchResponse) => {
    setSearchResults(data.matches || []);
    setSearchSources(data.sources || []);
    setSearchCached(!!data.cached);
    if ((data.matches || []).length === 0) {
      setSearchError(data.note || `No tracking indices found for your query.`);
    }
  };

  // Trigger search on component query setting or button action
  const handleEngineSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQueryApi.trim()) {
      setSearchError("Please specify a keyword or ticker symbol coordinate before exploring.");
      return;
    }

    setLoadingSearch(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const url = apiUrl(`/api/search-symbol?q=${encodeURIComponent(searchQueryApi)}&mode=${searchMode}&category=${searchSector}`);
      const resp = await fetch(url);
      const data = (await resp.json()) as SymbolSearchResponse;
      if (resp.ok && data.success) {
        applySearchResponse(data);
      } else {
        setSearchError(data.message || "Failed to query index database gateway.");
      }
    } catch (err: any) {
      setSearchError(err.message || "Network timeout connecting to global search servers.");
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleTrackAsset = async (item: SymbolSearchHit, selectAfter = true) => {
    const symbol = item.symbol.toUpperCase();
    if (assets[symbol]) {
      if (selectAfter) setSelectedKey(symbol);
      return;
    }

    setAddedSymbols((prev) => ({ ...prev, [symbol]: true }));

    try {
      const resp = await apiFetchWithTimeout(
        "/api/add-asset",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: item.symbol,
            name: item.name,
            category: item.category,
            current: item.defaultPrice || 100,
            changePercent: "+1.25%",
            unit: item.currency ? `${item.currency} per ${item.type || "Unit"}` : "USD per Share",
            desc: item.desc,
            exchange: item.exchange,
            googleFinanceId: item.googleFinanceId,
            capture: true,
          }),
        },
        90_000
      );

      const data = await readApiJson<{
        success?: boolean;
        message?: string;
        item?: Asset;
        asset?: Asset;
        captured?: boolean;
      }>(resp);
      if (resp.ok && data.success) {
        const addedItem = (data.item ?? data.asset) as Asset;
        onAssetAdded(symbol, addedItem, { captured: data.captured });
      } else {
        setAddedSymbols((prev) => ({ ...prev, [symbol]: false }));
        alert(
          "Failed to track asset inside workspace: " +
            (data.message || "Internal server register error.")
        );
      }
    } catch (err: unknown) {
      setAddedSymbols((prev) => ({ ...prev, [symbol]: false }));
      alert("Registration failed: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleOpenQuote = async (item: SymbolSearchHit) => {
    const symbol = item.symbol.toUpperCase();
    if (!assets[symbol]) {
      await handleTrackAsset(item, false);
    }
    setSelectedKey(symbol);
    setTypeaheadOpen(false);
  };

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Search and control filter hub */}
      <div className="bg-white p-6 border border-[#E5E8EB] rounded-[32px] space-y-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[#1D1D1F]">
              Alternative Assets Tracking Terminal
            </h2>
            <p className="text-xs text-[#86868B] mt-1 leading-normal">
              Filter the local catalog, search live via Yahoo/Google/AV, hide symbols from view, or open the Market Search Engine.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
            {hiddenSymbols.size > 0 && (
              <>
                <button
                  type="button"
                  onClick={onToggleShowHidden}
                  className={`px-3 py-1 text-[11px] font-semibold rounded-full flex items-center gap-1 border cursor-pointer ${
                    showHiddenSymbols
                      ? "bg-zinc-900 text-white border-zinc-800"
                      : "bg-zinc-100 text-zinc-600 border-zinc-200"
                  }`}
                >
                  <EyeOff size={12} />
                  {showHiddenSymbols ? "Showing hidden" : `${hiddenSymbols.size} hidden`}
                </button>
                {showHiddenSymbols && (
                  <button
                    type="button"
                    onClick={() => void onRestoreAllHidden()}
                    className="px-3 py-1 text-[11px] font-semibold rounded-full border bg-white text-[#007AFF] border-[#007AFF]/30 cursor-pointer"
                  >
                    Restore all
                  </button>
                )}
              </>
            )}
            {/* Live search health flag */}
            <span className={`px-3 py-1 text-[11px] font-semibold rounded-full flex items-center gap-1 border ${
              hasApiKeyOnBackend
                ? "bg-[#34C759]/5 border-[#34C759]/20 text-[#34C759]"
                : "bg-amber-500/5 border-amber-500/20 text-amber-600"
            }`}>
              <span className="w-1.5 h-1.5 bg-current rounded-full" />
              {hasApiKeyOnBackend ? "Live search enabled" : "Local catalog + Yahoo"}
            </span>

            <button
              onClick={() => {
                setShowSearchEngine(!showSearchEngine);
                setSearchError(null);
                setSearchResults([]);
              }}
              className={`px-4 py-1.5 text-[11px] font-bold rounded-full transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                showSearchEngine
                  ? "bg-[#FF3B30] text-white hover:bg-[#E03026]"
                  : "bg-[#007AFF] text-white hover:bg-[#0066D6]"
              }`}
            >
              <Globe size={13} className={showSearchEngine ? "rotate-90 transition-transform" : "transition-transform"} />
              {showSearchEngine ? "Close Search Engine" : "Open Market Search Engine"}
            </button>
          </div>
        </div>

        {/* HIGH-FIDELITY DYNAMIC INTERACTIVE API SEARCH ENGINE PANEL */}
        {showSearchEngine && (
          <div className="border-t border-[#E5E8EB] pt-5 mt-3 space-y-4 animate-fade-in">
            <div className="bg-[#F5F5F7] p-5 rounded-2xl border border-[#E5E8EB] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E8EB] pb-3">
                <div className="flex items-center gap-2">
                  <Database size={15} className="text-[#007AFF]" />
                  <span className="text-[12px] font-bold text-[#1D1D1F] uppercase tracking-wider font-sans">
                    Universal Index Search Engine
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-[#86868B] font-mono flex-wrap">
                  <span>Sources:</span>
                  {(searchSources.length ? searchSources : ["yahoo", "local"] as SymbolSearchSource[]).map((s) => (
                    <span key={s}>
                      <SearchSourceBadge source={s} />
                    </span>
                  ))}
                  {searchCached && (
                    <span className="text-[9px] text-zinc-400">cached</span>
                  )}
                </div>
              </div>

              {/* Toggles Panel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Search Parameter Mode Toggle */}
                <div className="space-y-1.5">
                  <span className="block text-[10px] font-extrabold text-[#424245] uppercase tracking-wider font-mono">
                    Search Criteria Filter
                  </span>
                  <div className="flex flex-wrap gap-1 bg-white p-1 rounded-lg border border-[#E5E8EB] self-start">
                    {(["keyword", "symbol", "name"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setSearchMode(mode)}
                        className={`px-3 py-1 text-[10px] font-bold rounded capitalize cursor-pointer transition-colors ${
                          searchMode === mode
                            ? "bg-[#1D1D1F] text-white"
                            : "text-[#86868B] hover:text-[#1D1D1F]"
                        }`}
                      >
                        {mode === "keyword" ? "💡 Keyword / Theme" : mode === "symbol" ? "📌 Symbol / Ticker" : "🏢 Company Name"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search Sector Toggle */}
                <div className="space-y-1.5">
                  <span className="block text-[10px] font-extrabold text-[#424245] uppercase tracking-wider font-mono">
                    Restrict to Sector
                  </span>
                  <div className="flex flex-wrap gap-1 bg-white p-1 rounded-lg border border-[#E5E8EB]">
                    {(["ALL", "METALS", "ENERGY", "TECH", "MARKETS", "FINANCE"] as const).map((sector) => (
                      <button
                        key={sector}
                        type="button"
                        onClick={() => setSearchSector(sector)}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer transition-colors ${
                          searchSector === sector
                            ? "bg-[#007AFF] text-white"
                            : "text-[#86868B] hover:text-[#1D1D1F]"
                        }`}
                      >
                        {sector}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Input & Call to Action */}
              <form onSubmit={handleEngineSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#86868B]">
                    <SearchIcon size={14} />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder={
                      searchMode === "symbol"
                        ? "Enter symbol ticker (e.g. BTC, ETH, AAPL, GLD)..."
                        : searchMode === "name"
                        ? "Enter exact company name (e.g. Apple, Micro, Coal)..."
                        : "Enter keyword search (e.g. Semiconductor, Tech, Metal, Uranium)..."
                    }
                    value={searchQueryApi}
                    onChange={(e) => setSearchQueryApi(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#E5E8EB] focus:border-[#80BFFF] focus:ring-2 focus:ring-[#007AFF]/10 rounded-xl text-xs font-semibold outline-none transition-all placeholder:text-[#86868B]"
                  />
                  {searchQueryApi && (
                    <button
                      type="button"
                      onClick={() => setSearchQueryApi("")}
                      className="absolute inset-y-0 right-3 flex items-center text-[#86868B] hover:text-[#1D1D1F]"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loadingSearch}
                  className="px-6 py-2.5 bg-[#1D1D1F] hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {loadingSearch ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} />
                      Scour Database
                    </>
                  )}
                </button>
              </form>

              {/* Search Result Dashboard */}
              <div className="space-y-2 pt-2">
                {searchError && (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-center text-amber-700 text-xs font-medium">
                    {searchError}
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="bg-white rounded-xl border border-[#E5E8EB] overflow-hidden">
                    <div className="bg-zinc-50 border-b border-[#E5E8EB] px-4 py-2 flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-[#86868B] font-mono tracking-wider uppercase">
                        Matched Index Records ({searchResults.length})
                      </span>
                      <span className="text-[9px] text-[#A1A1A6] font-mono">
                        Select item to integrate with dashboards
                      </span>
                    </div>

                    <div className="divide-y divide-zinc-100 max-h-[320px] overflow-y-auto">
                      {searchResults.map((item) => {
                        const symKey = item.symbol.toUpperCase();
                        const isPinnedOrLive = !!assets[symKey];
                        const isRegisteringByClient = !!addedSymbols[symKey];

                        return (
                          <div
                            key={`${item.symbol}-${item.source}`}
                            className="p-4 flex items-center justify-between gap-4 hover:bg-zinc-50/50 transition-colors"
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="bg-zinc-900 border border-zinc-700 text-white font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded leading-tight tracking-wider uppercase">
                                  {item.symbol}
                                </span>
                                <SearchSourceBadge source={item.source} />
                                {item.inCatalog && (
                                  <span className="text-[9px] font-mono text-zinc-400">in catalog</span>
                                )}
                                <span className="text-xs font-bold text-[#1D1D1F] truncate">
                                  {item.name}
                                </span>
                                <span className="text-[10px] text-zinc-400 font-mono">
                                  ({item.market || "US"})
                                </span>
                              </div>
                              <p className="text-[11px] text-[#86868B] leading-relaxed line-clamp-1">
                                {item.desc || `Dynamic financial tracker indices matching keyword coordinates.`}
                              </p>

                              <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono text-zinc-500 pt-0.5">
                                <span className="flex items-center gap-1">
                                  <Cpu size={10} className="text-zinc-400" />
                                  Sector: <strong className="text-[#007AFF]">{item.category}</strong>
                                </span>
                                <span>Unit: {item.currency ? `USD per ${item.type || "Unit"}` : "USD per Share"}</span>
                                <span>Estimates: <strong className="text-[#1D1D1F]">${item.defaultPrice}</strong></span>
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={isPinnedOrLive || isRegisteringByClient}
                              onClick={() => handleTrackAsset(item)}
                              className={`px-4 py-2 text-[11px] font-extrabold rounded-lg transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                                isPinnedOrLive
                                  ? "bg-zinc-100 border border-zinc-200 text-[#86868B] cursor-default"
                                  : isRegisteringByClient
                                  ? "bg-blue-50 text-blue-500 border border-blue-100"
                                  : "bg-[#007AFF] hover:bg-[#0066D6] text-white shadow-xs"
                              }`}
                            >
                              {isPinnedOrLive ? (
                                <>
                                  <Check size={11} className="stroke-[3px]" />
                                  Live Tracker
                                </>
                              ) : isRegisteringByClient ? (
                                <>
                                  <span className="w-2.5 h-2.5 border-2 border-blue-500/25 border-t-blue-500 rounded-full animate-spin" />
                                  Loading...
                                </>
                              ) : (
                                <>
                                  <PlusCircle size={11} />
                                  Add Asset
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!searchQueryApi.trim() && searchResults.length === 0 && (
                  <div className="flex flex-col items-center justify-center p-8 bg-white rounded-xl border border-[#E5E8EB]/75 text-center">
                    <Database size={24} className="text-[#D2D2D7] mb-2" />
                    <p className="text-xs font-semibold text-[#86868B] leading-none mb-1">
                      Lookup Terminal Primed
                    </p>
                    <p className="text-[10px] text-[#A1A1A6] font-mono leading-tight">
                      Input your queried keywords above and press Enter, or click Scour Database.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Highly aesthetic search bar with visual filters */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#86868B]">
              <SearchIcon size={15} />
            </span>
            <input
              type="text"
              placeholder="Search instrument symbol, company name or asset classification..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.trim().length >= 2 && setTypeaheadOpen(true)}
              onBlur={() => window.setTimeout(() => setTypeaheadOpen(false), 150)}
              className="w-full pl-10 pr-10 py-2.5 bg-[#F5F5F7] border border-[#E5E8EB] focus:border-[#86868B] rounded-full text-xs text-[#1D1D1F] outline-none transition-all placeholder:text-[#86868B] font-medium focus:bg-white focus:ring-2 focus:ring-[#007AFF]/10 focus:shadow-xs"
            />
            {typeaheadOpen && searchQuery.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-full mt-2 z-30 bg-white border border-[#E5E8EB] rounded-2xl shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                {typeaheadLoading ? (
                  <div className="p-4 text-xs text-[#86868B] text-center">Searching live providers…</div>
                ) : typeaheadHits.length === 0 ? (
                  <div className="p-4 text-xs text-[#86868B] text-center">No live matches</div>
                ) : (
                  typeaheadHits.map((hit) => (
                    <div
                      key={`${hit.symbol}-${hit.source}`}
                      className="px-4 py-3 border-b border-zinc-100 last:border-0 hover:bg-zinc-50 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[11px] font-bold">{hit.symbol}</span>
                          <SearchSourceBadge source={hit.source} />
                          <span className="text-xs text-[#86868B] truncate">{hit.name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => void handleTrackAsset(hit)}
                          className="px-2 py-1 text-[10px] font-bold rounded-lg bg-[#007AFF] text-white cursor-pointer"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => void handleOpenQuote(hit)}
                          className="px-2 py-1 text-[10px] font-bold rounded-lg bg-zinc-100 text-zinc-700 cursor-pointer"
                        >
                          Quote
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-3 flex items-center text-[#86868B] hover:text-[#1D1D1F]"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Filter category tabs inline */}
          <div className="flex items-center bg-[#F5F5F7] p-1 rounded-full border border-[#E5E8EB] overflow-x-auto shrink-0 self-start sm:self-auto sm:max-w-md">
            {["ALL", "METALS", "ENERGY", "TECH", "MARKETS", "FINANCE"].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-tight cursor-pointer transition-colors shrink-0 ${
                  activeCategory === cat
                    ? "bg-white text-[#1D1D1F] shadow-xs"
                    : "text-[#86868B] hover:text-[#1D1D1F]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Primary Display of available matching assets with elegant Pagination limits inside */}
      {Object.keys(filteredAssetsObj).length === 0 ? (
        <div className="p-12 bg-white rounded-[32px] border border-[#E5E8EB] text-center max-w-lg mx-auto shadow-xs">
          <p className="text-sm font-bold text-[#1D1D1F]">Empty Selection Feed</p>
          <p className="text-xs text-[#86868B] mt-1.5 font-mono">
            No asset matched your input filter query: <span className="text-[#FF3B30] italic">"{searchQuery}"</span>
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setActiveCategory("ALL");
            }}
            className="mt-4 px-4 py-1.5 bg-[#007AFF] text-white text-[11px] font-bold rounded-full hover:bg-opacity-90 transition-all cursor-pointer"
          >
            Reset System Filters
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <AssetSelector
            assets={filteredAssetsObj}
            selectedKey={selectedKey}
            onSelectKey={setSelectedKey}
            activeCategory={activeCategory}
            pinnedSymbols={pinnedSymbols}
            onTogglePin={handleTogglePin}
            hiddenSymbols={hiddenSymbols}
            customSymbols={customSymbols}
            onHideSymbol={(key) => void onHideSymbol(key, true)}
            onDeleteSymbol={onDeleteSymbol}
          />

          {/* Detail chart rendering directly under the terminal switcher */}
          {assets[selectedKey] && (
            <div className="space-y-4 pt-4 border-t border-[#E5E8EB]">
              <div className="flex flex-wrap items-center justify-between gap-2 px-2">
                <span className="text-[10px] font-extrabold font-mono text-[#86868B] uppercase tracking-wider">
                  Real-Time historical visualization
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-[#1D1D1F]">
                    Selected Target: {assets[selectedKey].name} ({selectedKey})
                  </span>
                  <AssetValidationActions
                    symbol={assets[selectedKey].symbol}
                    category={assets[selectedKey].category}
                    name={assets[selectedKey].name}
                    variant="button"
                  />
                </div>
              </div>
              <AssetChart asset={assets[selectedKey]} />

              <div className="mt-4 pt-4 border-t border-[#E5E8EB]/75 space-y-4">
                <NewsBayWidget
                  symbol={selectedKey}
                  assetName={assets[selectedKey].name}
                  onOpenNewsBay={onOpenNewsBay}
                />
                <MarketSentimentPanel
                  selectedSymbol={selectedKey}
                  selectedAssetName={assets[selectedKey].name}
                  onSerpApiStatusFound={setHasSerpapiKey}
                />
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
