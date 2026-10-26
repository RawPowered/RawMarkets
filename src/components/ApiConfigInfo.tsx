import React, { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import {
  mergeEngineSettings,
  type EngineSettingsShape,
} from "../lib/engineSettings";
import WealthBibleRuleSpaceSettings from "./engine/WealthBibleRuleSpaceSettings";
import LocalCopilotToolsSettings from "./engine/LocalCopilotToolsSettings";
import {
  Info,
  ExternalLink,
  Settings,
  ShieldCheck,
  HelpCircle,
  Key,
  Newspaper,
  Coins,
  Cpu,
  RotateCw,
  Trash2,
  Zap,
  Hourglass,
  Sliders,
  Terminal,
  Activity,
  CheckCircle,
  Database,
  SlidersHorizontal,
  FileCode,
  Gauge,
  Clock
} from "lucide-react";

interface ApiConfigInfoProps {
  hasKey: boolean;
  hasSerpapiKey?: boolean;
  hasMetalPriceKey?: boolean;
  onRefreshMarketData?: () => void;
}

type EngineSettings = EngineSettingsShape;

interface EngineTelemetry {
  customCount: number;
  cacheCount: number;
  newsArticleCount?: number;
  keysCount?: number;
  dbPath?: string;
  dbSize?: number;
  hasAlphaVantageKey: boolean;
  hasMetalPriceKey: boolean;
  hasSerpApiKey: boolean;
  hasGeminiKey: boolean;
  lastMarketFeedAt?: number | null;
  marketNeedsBootstrap?: boolean;
}

export default function ApiConfigInfo({
  hasKey,
  hasSerpapiKey = false,
  hasMetalPriceKey = false,
  onRefreshMarketData
}: ApiConfigInfoProps) {
  // Config state from Express server backend settings
  const [engineSettings, setEngineSettings] = useState<EngineSettings>(() =>
    mergeEngineSettings()
  );

  const [telemetry, setTelemetry] = useState<EngineTelemetry | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [purging, setPurging] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch engine settings, telemetry stats, and logs from backend endpoints
  const fetchEngineTelemetry = async () => {
    try {
      const resp = await apiFetch("/api/engine/settings");
      if (resp.ok) {
        const data = await resp.json();
        if (data.success) {
          setEngineSettings(mergeEngineSettings(data.settings));
          setTelemetry(data.telemetry);
        }
      }
    } catch (err) {
      console.error("Failed to load backend engine parameters:", err);
    } finally {
      setLoadingConfig(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const resp = await apiFetch("/api/engine/logs");
      if (resp.ok) {
        const data = await resp.json();
        if (data.success) {
          setLogs(data.logs || []);
        }
      }
    } catch (e) {
      console.warn("Could not retrieve engine telemetry stream logs.", e);
    }
  };

  // Poll logs and telemetry stats periodically to create a live active feeling look
  useEffect(() => {
    fetchEngineTelemetry();
    fetchLogs();

    const interval = setInterval(() => {
      fetchLogs();
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleUpdateSettings = (updatedFields: Partial<EngineSettings>) => {
    setEngineSettings((prev) => mergeEngineSettings({ ...prev, ...updatedFields }));
  };

  const commitSettings = async (patch?: Partial<EngineSettings>) => {
    const payload = mergeEngineSettings({ ...engineSettings, ...patch });
    setEngineSettings(payload);
    setSavingConfig(true);
    setSaveSuccess(false);
    try {
      const resp = await apiFetch("/api/engine/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        alert(data.message || `Failed to save settings (${resp.status})`);
        return;
      }
      setEngineSettings(mergeEngineSettings(data.settings));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      fetchLogs();
      if (onRefreshMarketData) {
        onRefreshMarketData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert("Failed to commit settings: " + msg);
    } finally {
      setSavingConfig(false);
    }
  };

  const triggerRestoreCatalog = async () => {
    setSeeding(true);
    try {
      const resp = await apiFetch("/api/engine/restore-catalog", { method: "POST" });
      const data = await resp.json();
      if (resp.ok && data.success) {
        fetchEngineTelemetry();
        fetchLogs();
        if (onRefreshMarketData) {
          onRefreshMarketData();
        }
      } else {
        alert("Restore failed: " + (data.message || "Unknown error."));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert("Restore catalog error: " + msg);
    } finally {
      setSeeding(false);
    }
  };

  const triggerPurgeDb = async () => {
    if (!window.confirm("This action will purge all manually added assets from the index files. Default standard assets (Gold, Silver, Bitcoin) will remain intact. Proceed?")) {
      return;
    }
    setPurging(true);
    try {
      const resp = await apiFetch("/api/engine/reset", { method: "POST" });
      const data = await resp.json();
      if (resp.ok && data.success) {
        fetchEngineTelemetry();
        fetchLogs();
        if (onRefreshMarketData) {
          onRefreshMarketData();
        }
      }
    } catch (err: any) {
      alert("Purge operation failed: " + err.message);
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Real-time System Controllers Interface */}
      <div id="raw-control-room" className="bg-white border border-[#E5E8EB] shadow-sm rounded-[32px] p-6 md:p-8">
        <div className="flex items-center justify-between border-b border-[#E5E8EB] pb-5 mb-6">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-zinc-900 text-white rounded-2xl flex items-center justify-center shadow-xs">
              <Sliders size={18} />
            </span>
            <div>
              <h3 className="text-base font-bold text-[#1D1D1F] tracking-tight">Engine tuning</h3>
              <p className="text-xs text-[#86868B] font-medium leading-normal mt-0.5">
                Regulate pipeline characteristics, latency injection, and systemic volatility scales dynamically.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={loadingConfig}
            onClick={() => {
              setLoadingConfig(true);
              fetchEngineTelemetry();
              fetchLogs();
            }}
            className="p-2 text-[#86868B] hover:text-[#1D1D1F] border border-[#E5E8EB] rounded-xl hover:bg-zinc-50 transition-all cursor-pointer"
            title="Refresh State Parameters"
          >
            <RotateCw size={14} className={loadingConfig ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Configurations Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Simulation variables */}
          <div className="lg:col-span-2 space-y-6">

            {/* Input Slider: Latency */}
            <div className="bg-[#F5F5F7] p-5 rounded-2xl border border-[#E5E8EB] space-y-3.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-mono font-bold text-[#1D1D1F] uppercase tracking-wider flex items-center gap-2">
                  <Hourglass size={14} className="text-[#007AFF]" />
                  Latency Feed Injector (ms)
                </label>
                <span className="text-xs font-mono font-black text-[#007AFF] bg-white px-2.5 py-0.5 rounded border border-[#E5E8EB]">
                  {engineSettings.simulationLatencyMs} ms
                </span>
              </div>
              <p className="text-[11px] text-[#86868B] leading-relaxed">
                Artificially delay server responses to visually test active indicator loads, shimmering skeletal screens, and button pending spinners.
              </p>
              <input
                type="range"
                min="0"
                max="3000"
                step="100"
                value={engineSettings.simulationLatencyMs}
                onChange={(e) => handleUpdateSettings({ simulationLatencyMs: parseInt(e.target.value) })}
                className="w-full accent-[#007AFF] bg-zinc-200 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-[#A1A1A6] font-mono">
                <span>0ms (No Delay)</span>
                <span>1500ms (Average Mobile)</span>
                <span>3000ms (Ultra Slow Connection)</span>
              </div>
            </div>

            {/* Input Slider: Volatility Modifier */}
            <div className="bg-[#F5F5F7] p-5 rounded-2xl border border-[#E5E8EB] space-y-3.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-mono font-bold text-[#1D1D1F] uppercase tracking-wider flex items-center gap-2">
                  <Gauge size={14} className="text-[#34C759]" />
                  Volatility Variance scale
                </label>
                <span className="text-xs font-mono font-black text-[#34C759] bg-white px-2.5 py-0.5 rounded border border-[#E5E8EB]">
                  {engineSettings.volatilityMultiplier.toFixed(1)}x
                </span>
              </div>
              <p className="text-[11px] text-[#86868B] leading-relaxed">
                Expands the simulated pricing fluctuation boundaries, mimicking periods of extreme macroeconomic stress, asset runs, or stable stagnation.
              </p>
              <input
                type="range"
                min="0.2"
                max="5.0"
                step="0.2"
                value={engineSettings.volatilityMultiplier}
                onChange={(e) => handleUpdateSettings({ volatilityMultiplier: parseFloat(e.target.value) })}
                className="w-full accent-[#34C759] bg-zinc-200 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-[#A1A1A6] font-mono">
                <span>0.2x (Stagnant)</span>
                <span>1.0x (Standard Trends)</span>
                <span>3.0x (Crises Run)</span>
                <span>5.0x (Wild Hyper-swing)</span>
              </div>
            </div>

            <div className="bg-[#F5F5F7] p-5 rounded-2xl border border-[#E5E8EB] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <label className="text-xs font-mono font-bold text-[#1D1D1F] uppercase tracking-wider flex items-center gap-2">
                    <Clock size={14} className="text-[#007AFF]" />
                    Market auto-refresh policy
                  </label>
                  <p className="text-[11px] text-[#86868B] leading-relaxed mt-1.5 max-w-xl">
                    Skip live market capture on app load when the last full refresh is still fresh.
                    First run with no price history always populates everything, then this rule applies.
                    Use Refresh Spot Feed to force a manual update anytime.
                  </p>
                </div>
                {telemetry?.lastMarketFeedAt ? (
                  <span className="text-[10px] font-mono text-[#86868B] bg-white px-2.5 py-1 rounded border border-[#E5E8EB] shrink-0">
                    Last live feed:{" "}
                    {new Date(telemetry.lastMarketFeedAt).toLocaleString()}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-amber-700 bg-amber-50 px-2.5 py-1 rounded border border-amber-200 shrink-0">
                    {telemetry?.marketNeedsBootstrap
                      ? "No feed history — will populate on next load"
                      : "No timestamp recorded yet"}
                  </span>
                )}
              </div>

              <button
                type="button"
                disabled={savingConfig}
                onClick={() =>
                  void commitSettings({
                    skipAutoMarketRefresh: !engineSettings.skipAutoMarketRefresh,
                  })
                }
                className={`w-full p-4 rounded-2xl border text-left flex flex-col gap-1 cursor-pointer transition-all ${
                  engineSettings.skipAutoMarketRefresh
                    ? "bg-blue-50 border-blue-200"
                    : "bg-white border-[#E5E8EB] hover:bg-zinc-50"
                }`}
              >
                <span className="text-[9px] font-bold uppercase tracking-wider font-mono text-zinc-500">
                  Skip auto-refresh when fresh
                </span>
                <span className="text-xs font-bold">
                  {engineSettings.skipAutoMarketRefresh
                    ? "On — loads cached data inside freshness window"
                    : "Off — always quick-load without live capture on startup"}
                </span>
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="block text-[10px] font-extrabold text-[#424245] uppercase tracking-wider font-mono">
                    Freshness window
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={
                      engineSettings.marketRefreshFreshnessUnit === "days"
                        ? 30
                        : 168
                    }
                    value={engineSettings.marketRefreshFreshnessValue}
                    onChange={(e) =>
                      handleUpdateSettings({
                        marketRefreshFreshnessValue:
                          parseInt(e.target.value, 10) || 1,
                      })
                    }
                    onBlur={(e) =>
                      void commitSettings({
                        marketRefreshFreshnessValue:
                          parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-[#E5E8EB] rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-[#007AFF]/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="block text-[10px] font-extrabold text-[#424245] uppercase tracking-wider font-mono">
                    Unit
                  </span>
                  <div className="flex gap-1 bg-white p-1 rounded-lg border border-[#E5E8EB]">
                    {(["hours", "days"] as const).map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        onClick={() => {
                          handleUpdateSettings({ marketRefreshFreshnessUnit: unit });
                          void commitSettings({ marketRefreshFreshnessUnit: unit });
                        }}
                        className={`flex-1 px-3 py-1.5 text-[10px] font-bold rounded capitalize cursor-pointer ${
                          engineSettings.marketRefreshFreshnessUnit === unit
                            ? "bg-[#1a1a1a] text-white"
                            : "text-[#86868B] hover:text-[#1D1D1F]"
                        }`}
                      >
                        {unit}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-[#A1A1A6] font-mono">
                Current rule: skip live market refresh if last update was within{" "}
                {engineSettings.marketRefreshFreshnessValue}{" "}
                {engineSettings.marketRefreshFreshnessUnit === "days"
                  ? "day(s)"
                  : "hour(s)"}
                .
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <button
                type="button"
                disabled={savingConfig}
                onClick={() =>
                  void commitSettings({
                    usePlaywrightScrapers: !engineSettings.usePlaywrightScrapers,
                  })
                }
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between min-h-28 cursor-pointer transition-all ${
                  engineSettings.usePlaywrightScrapers
                    ? "bg-violet-50 border-violet-200 text-[#1D1D1F]"
                    : "bg-[#F5F5F7] hover:bg-zinc-100 border-[#E5E8EB]"
                }`}
              >
                <span className="text-[9px] font-bold uppercase tracking-wider font-mono text-zinc-500">
                  KITCO + YAHOO
                </span>
                <span className="block text-xs font-bold font-mono mt-2">
                  Market capture (Kitco + Yahoo)
                </span>
                <span className="block text-[10px] text-[#86868B] leading-tight mt-0.5">
                  {engineSettings.usePlaywrightScrapers
                    ? "Live prices from Kitco metals and Yahoo quotes"
                    : "Off — enable legacy API feeds or turn this on"}
                </span>
              </button>

              <button
                type="button"
                disabled={savingConfig}
                onClick={() =>
                  void commitSettings({
                    fullCatalogScrapeRefresh:
                      !engineSettings.fullCatalogScrapeRefresh,
                  })
                }
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between min-h-28 cursor-pointer transition-all ${
                  engineSettings.fullCatalogScrapeRefresh
                    ? "bg-amber-50 border-amber-200 text-[#1D1D1F]"
                    : "bg-[#F5F5F7] hover:bg-zinc-100 border-[#E5E8EB]"
                }`}
              >
                <span className="text-[9px] font-bold uppercase tracking-wider font-mono text-zinc-500">
                  FULL REFRESH
                </span>
                <span className="block text-xs font-bold font-mono mt-2">
                  Refresh full catalog
                </span>
                <span className="block text-[10px] text-[#86868B] leading-tight mt-0.5">
                  {engineSettings.fullCatalogScrapeRefresh
                    ? "Up to 8 symbols + all 4 Kitco metals per refresh"
                    : "Default: focus + pinned only (4 symbols, gold/silver)"}
                </span>
              </button>

              <button
                type="button"
                disabled={savingConfig}
                onClick={() =>
                  void commitSettings({ useApiFeeds: !engineSettings.useApiFeeds })
                }
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between min-h-28 cursor-pointer transition-all ${
                  engineSettings.useApiFeeds
                    ? "bg-emerald-50 border-emerald-200 text-[#1D1D1F]"
                    : "bg-[#F5F5F7] hover:bg-zinc-100 border-[#E5E8EB]"
                }`}
              >
                <span className="text-[9px] font-bold uppercase tracking-wider font-mono text-zinc-500">
                  LEGACY APIS
                </span>
                <span className="block text-xs font-bold font-mono mt-2">
                  Alpha Vantage (stocks)
                </span>
                <span className="block text-[10px] text-[#86868B] leading-tight mt-0.5">
                  {engineSettings.useApiFeeds
                    ? "AV quotes only — metals use Kitco/Yahoo scrapers"
                    : "Disabled when market capture handles prices"}
                </span>
              </button>
            </div>

            {/* Simulation fallback logic and verbose log toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {engineSettings.forceOfflineFallback && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900">
                  <strong className="font-bold">Force offline fallback is ON.</strong> Live Alpha
                  Vantage prices are disabled until you turn this off and click Commit.
                </div>
              )}

              {/* Checkbox Force simulation offline */}
              <button
                type="button"
                onClick={() => handleUpdateSettings({ forceOfflineFallback: !engineSettings.forceOfflineFallback })}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-28 cursor-pointer transition-all ${
                  engineSettings.forceOfflineFallback
                    ? "bg-amber-500/15 border-amber-400 text-[#1D1D1F]"
                    : "bg-[#F5F5F7] hover:bg-zinc-100 border-[#E5E8EB]"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`p-1.5 rounded-xl ${engineSettings.forceOfflineFallback ? "bg-amber-500 text-white" : "bg-zinc-200 text-[#424245]"}`}>
                    <Zap size={14} />
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider font-mono text-zinc-500">
                    FAIL-SAFE SIM
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-bold font-mono">Force Offline Cache</span>
                  <span className="block text-[10px] text-[#86868B] leading-tight mt-0.5">
                    {engineSettings.forceOfflineFallback ? "Live rates blocked, fallback active" : "Use live API when a key is set"}
                  </span>
                </div>
              </button>

              {/* Checkbox Verbose logging */}
              <button
                type="button"
                onClick={() => handleUpdateSettings({ verboseLogging: !engineSettings.verboseLogging })}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-28 cursor-pointer transition-all ${
                  engineSettings.verboseLogging
                    ? "bg-blue-50 border-blue-200 text-[#1D1D1F]"
                    : "bg-[#F5F5F7] hover:bg-zinc-100 border-[#E5E8EB]"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`p-1.5 rounded-xl ${engineSettings.verboseLogging ? "bg-[#007AFF] text-white" : "bg-zinc-200 text-[#424245]"}`}>
                    <Terminal size={14} />
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider font-mono text-zinc-500">
                    CONSOLE STREAM
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-bold font-mono">Verbosity Logging</span>
                  <span className="block text-[10px] text-[#86868B] leading-tight mt-0.5">
                    {engineSettings.verboseLogging ? "Verbose server tracking is LIVE" : "Logs quiet/minimalistic feed"}
                  </span>
                </div>
              </button>
            </div>

            {/* Investors Journal media download controls */}
            <div className="space-y-4 pt-2 border-t border-[#E5E8EB]">
              <div className="flex items-center gap-2">
                <Newspaper size={15} className="text-[#1D1D1F]" />
                <span className="text-[11px] font-extrabold uppercase tracking-widest font-mono text-zinc-600">
                  Investors Journal
                </span>
              </div>
              <p className="text-[10px] text-[#86868B] leading-relaxed">
                Control automatic local storage when clipping bookmarks or social posts.
                Per-entry download is always available from the Journal page.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateSettings({
                      journalAutoDownloadImages:
                        !engineSettings.journalAutoDownloadImages,
                    })
                  }
                  className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-28 cursor-pointer transition-all ${
                    engineSettings.journalAutoDownloadImages
                      ? "bg-[#F0F7FF] border-[#007AFF]/30 text-[#1D1D1F]"
                      : "bg-[#F5F5F7] hover:bg-zinc-100 border-[#E5E8EB]"
                  }`}
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider font-mono text-zinc-500">
                    AUTO IMAGES
                  </span>
                  <span className="block text-xs font-bold font-mono mt-2">
                    Download photos on clip
                  </span>
                  <span className="block text-[10px] text-[#86868B] leading-tight mt-0.5">
                    {engineSettings.journalAutoDownloadImages
                      ? "Enabled"
                      : "Remote preview only"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleUpdateSettings({
                      journalAutoDownloadVideos:
                        !engineSettings.journalAutoDownloadVideos,
                    })
                  }
                  className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-28 cursor-pointer transition-all ${
                    engineSettings.journalAutoDownloadVideos
                      ? "bg-[#F0F7FF] border-[#007AFF]/30 text-[#1D1D1F]"
                      : "bg-[#F5F5F7] hover:bg-zinc-100 border-[#E5E8EB]"
                  }`}
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider font-mono text-zinc-500">
                    AUTO VIDEOS
                  </span>
                  <span className="block text-xs font-bold font-mono mt-2">
                    Download videos on clip
                  </span>
                  <span className="block text-[10px] text-[#86868B] leading-tight mt-0.5">
                    {engineSettings.journalAutoDownloadVideos
                      ? "Enabled (X videos may fail)"
                      : "Live link fallback"}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="p-4 bg-[#F5F5F7] border border-[#E5E8EB] rounded-2xl space-y-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider font-mono text-zinc-500 block">
                    Max image size (MB)
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={engineSettings.journalMaxImageMb}
                    onChange={(e) =>
                      handleUpdateSettings({
                        journalMaxImageMb: Number(e.target.value),
                      })
                    }
                    className="w-full accent-[#007AFF]"
                  />
                  <span className="text-xs font-bold font-mono text-[#1D1D1F]">
                    {engineSettings.journalMaxImageMb} MB
                  </span>
                </label>
                <label className="p-4 bg-[#F5F5F7] border border-[#E5E8EB] rounded-2xl space-y-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider font-mono text-zinc-500 block">
                    Max video size (MB)
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={200}
                    value={engineSettings.journalMaxVideoMb}
                    onChange={(e) =>
                      handleUpdateSettings({
                        journalMaxVideoMb: Number(e.target.value),
                      })
                    }
                    className="w-full accent-[#007AFF]"
                  />
                  <span className="text-xs font-bold font-mono text-[#1D1D1F]">
                    {engineSettings.journalMaxVideoMb} MB
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-[#E5E8EB]">
              <div className="flex items-center gap-2">
                <Newspaper size={15} className="text-[#1D1D1F]" />
                <span className="text-[11px] font-extrabold uppercase tracking-widest font-mono text-zinc-600">
                  News Bay Storage
                </span>
              </div>
              <p className="text-[10px] text-[#86868B] leading-relaxed">
                Save fetched headlines locally, read fresh feeds from SQLite, and purge
                un-clipped articles after the retention window.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="p-4 bg-[#F5F5F7] border border-[#E5E8EB] rounded-2xl space-y-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider font-mono text-zinc-500 block">
                    Keep un-clipped articles
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={engineSettings.newsArticleRetentionDays}
                    onChange={(e) =>
                      handleUpdateSettings({
                        newsArticleRetentionDays:
                          parseInt(e.target.value, 10) || 1,
                      })
                    }
                    onBlur={(e) =>
                      void commitSettings({
                        newsArticleRetentionDays:
                          parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-[#E5E8EB] rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-[#007AFF]/10"
                  />
                  <span className="text-[10px] text-[#86868B] font-mono">
                    days
                  </span>
                </label>

                <label className="p-4 bg-[#F5F5F7] border border-[#E5E8EB] rounded-2xl space-y-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider font-mono text-zinc-500 block">
                    Refetch feeds after
                  </span>
                  <input
                    type="number"
                    min={5}
                    max={720}
                    value={engineSettings.newsArticleRefreshMinutes}
                    onChange={(e) =>
                      handleUpdateSettings({
                        newsArticleRefreshMinutes:
                          parseInt(e.target.value, 10) || 5,
                      })
                    }
                    onBlur={(e) =>
                      void commitSettings({
                        newsArticleRefreshMinutes:
                          parseInt(e.target.value, 10) || 5,
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-[#E5E8EB] rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-[#007AFF]/10"
                  />
                  <span className="text-[10px] text-[#86868B] font-mono">
                    minutes
                  </span>
                </label>
              </div>
            </div>

            {/* Commit controls */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => void commitSettings()}
                disabled={savingConfig}
                className="px-6 py-3 bg-[#1D1D1F] hover:bg-zinc-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-2 select-none shadow-xs cursor-pointer transition-all"
              >
                {savingConfig ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Syncing Params...
                  </>
                ) : (
                  <>
                    <CheckCircle size={14} />
                    Commit Core Configurations
                  </>
                )}
              </button>

              {saveSuccess && (
                <span className="text-xs font-mono font-bold text-[#34C759] flex items-center gap-1.5 animate-pulse">
                  <CheckCircle size={13} />
                  Engine synchronized safely.
                </span>
              )}
            </div>

          </div>

          {/* Quick Stats Panel / DB Administration */}
          <div className="space-y-6">
            <div className="bg-[#F5F5F7] p-5 rounded-3xl border border-[#E5E8EB] space-y-4">
              <div className="flex items-center gap-2">
                <Database size={15} className="text-[#1D1D1F]" />
                <span className="text-[11px] font-extrabold uppercase tracking-widest font-mono text-zinc-600">
                  Engine Registry Telemetry
                </span>
              </div>

              {telemetry ? (
                <div className="space-y-4 pt-1 font-mono text-xs">
                  <div className="flex justify-between items-center py-2 border-b border-zinc-200">
                    <span className="text-[#86868B]">Custom Stock Registry:</span>
                    <strong className="text-zinc-950 font-bold bg-white border px-2 py-0.5 rounded">
                      {telemetry.customCount} Assets
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-zinc-200">
                    <span className="text-[#86868B]">API cache rows:</span>
                    <strong className="text-zinc-950 font-bold">
                      {telemetry.cacheCount} Cached Hits
                    </strong>
                  </div>
                  {telemetry.keysCount != null && (
                    <div className="flex justify-between items-center py-2 border-b border-zinc-200">
                      <span className="text-[#86868B]">Stored API keys:</span>
                      <strong className="text-zinc-950">{telemetry.keysCount}</strong>
                    </div>
                  )}
                  {telemetry.newsArticleCount != null && (
                    <div className="flex justify-between items-center py-2 border-b border-zinc-200">
                      <span className="text-[#86868B]">Saved News Bay articles:</span>
                      <strong className="text-zinc-950">
                        {telemetry.newsArticleCount}
                      </strong>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-1">
                    <span className="text-[#86868B] text-[11px]">SQLite path:</span>
                    <span
                      className="text-[10px] text-zinc-500 font-mono truncate max-w-[140px]"
                      title={telemetry.dbPath || "data/rawmarkets.db"}
                    >
                      {telemetry.dbPath
                        ? telemetry.dbPath.split(/[/\\]/).pop()
                        : "rawmarkets.db"}
                    </span>
                  </div>
                  {telemetry.dbSize != null && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-[#86868B] text-[11px]">DB size:</span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {(telemetry.dbSize / 1024).toFixed(2)} KB
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center font-mono text-xs text-[#86868B]">
                  Loading core telemetry values...
                </div>
              )}
            </div>

            {/* Quick Admin Actions Box */}
            <div className="bg-white border border-[#E5E8EB] p-5 rounded-3xl space-y-4">
              <span className="text-[11px] font-extrabold uppercase tracking-widest font-mono text-zinc-600 block">
                Administrative Utilities
              </span>

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  disabled={seeding}
                  onClick={triggerRestoreCatalog}
                  className="w-full py-2.5 bg-[#F5F5F7] hover:bg-[#E5E8EB] disabled:opacity-50 text-[#1D1D1F] font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors border border-[#E5E8EB]"
                >
                  <Database size={13} className={seeding ? "animate-bounce" : ""} />
                  {seeding ? "Restoring…" : "Restore Factory Catalog (40+)"}
                </button>

                {/* Clear custom assets database */}
                <button
                  type="button"
                  disabled={purging}
                  onClick={triggerPurgeDb}
                  className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-600 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors border border-rose-200"
                >
                  <Trash2 size={13} className={purging ? "animate-pulse" : ""} />
                  {purging ? "Purging Files..." : "Purge Custom Registries"}
                </button>
              </div>

              <p className="text-[10px] text-[#86868B] leading-normal italic text-center font-serif">
                Restore reloads baseline catalog presets from SQLite migrations. Purge clears user-added symbols only.
              </p>
            </div>

          </div>

        </div>
      </div>

      <WealthBibleRuleSpaceSettings
        settings={engineSettings}
        onUpdate={handleUpdateSettings}
      />

      <LocalCopilotToolsSettings
        settings={engineSettings}
        hasSerpApiKey={hasSerpapiKey}
        onUpdate={handleUpdateSettings}
        onCommit={(patch) => void commitSettings(patch)}
      />

      {/* Visual active logger console output terminal */}
      <div className="bg-zinc-950 rounded-[32px] border border-zinc-800 p-6 md:p-8 flex flex-col gap-4 font-mono shadow-xl relative overflow-hidden">
        {/* Glow point effect */}
        <div className="absolute top-0 right-1/4 w-96 h-28 bg-[#007AFF]/10 blur-3xl rounded-full pointer-events-none" />

        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#34C759] animate-pulse" />
            <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#E5E8EB]">
              Core Engine Telemetry Stream Log
            </h4>
          </div>
          <span className="text-[9px] bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded font-bold text-zinc-500">
            POLLING CURRENT TIME: {new Date().toISOString().substring(11, 19)} UTC
          </span>
        </div>

        <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800/80 p-4 max-h-[180px] overflow-y-auto space-y-2 select-text custom-log-console">
          {logs.length === 0 ? (
            <p className="text-[11px] text-zinc-600 italic">No signals recorded recently. Triggering actions above feeds server console telemetry...</p>
          ) : (
            logs.slice().reverse().map((logRow, idx) => {
              // Highlight certain log keywords for higher sci-fi visual appeal
              let styleCls = "text-zinc-400";
              if (logRow.includes("Incoming API")) styleCls = "text-[#007AFF]";
              if (logRow.includes("Seeding") || logRow.includes("loaded")) styleCls = "text-[#34C759]";
              if (logRow.includes("Purged") || logRow.includes("Error")) styleCls = "text-[#FF3B30]";
              if (logRow.includes("Characteristics updated")) styleCls = "text-amber-500";

              return (
                <div key={idx} className="text-[11px] leading-relaxed flex items-start gap-1.5">
                  <span className="text-zinc-600 shrink-0 select-none">❯</span>
                  <span className={styleCls}>{logRow}</span>
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-center justify-between text-[10px] text-zinc-600">
          <span>Active Log Frame size limit: 50 lines auto-rollover.</span>
          <span>Security status: LOCAL_ENCRYPTED</span>
        </div>
      </div>

      <div className="bg-white border border-[#E5E8EB] shadow-sm rounded-[32px] p-6 text-xs text-[#86868B]">
        Live channel status: Alpha Vantage{" "}
        <span className={hasKey ? "text-[#34C759] font-bold" : "text-amber-500"}>
          {hasKey ? "active" : "simulated"}
        </span>
        {" · "}Metals spot{" "}
        <span className="text-[#34C759] font-bold">Kitco + Yahoo</span>
        {hasMetalPriceKey ? (
          <span className="text-[#86868B]">
            {" "}
            (MetalPriceAPI key on file — not used for display)
          </span>
        ) : null}
        {" · "}News Bay RSS{" "}
        <span className="text-[#34C759] font-bold">always free</span>
        {" · "}SerpApi search{" "}
        <span className={hasSerpapiKey ? "text-[#34C759] font-bold" : "text-amber-500"}>
          {hasSerpapiKey ? "active (paid API)" : "optional — add key for live search"}
        </span>
        . Manage keys in the panel above.
      </div>
    </div>
  );
}
