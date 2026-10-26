/** Client-safe engine settings defaults (keep in sync with src/server/db.ts). */
export interface EngineSettingsShape {
  simulationLatencyMs: number;
  volatilityMultiplier: number;
  forceOfflineFallback: boolean;
  verboseLogging: boolean;
  usePlaywrightScrapers: boolean;
  useApiFeeds: boolean;
  journalAutoDownloadImages: boolean;
  journalAutoDownloadVideos: boolean;
  journalMaxImageMb: number;
  journalMaxVideoMb: number;
  skipAutoMarketRefresh: boolean;
  marketRefreshFreshnessValue: number;
  marketRefreshFreshnessUnit: "hours" | "days";
  fullCatalogScrapeRefresh: boolean;
  newsArticleRetentionDays: number;
  newsArticleRefreshMinutes: number;
  aiWealthBibleEnabled: boolean;
  aiWealthBibleRuleIds: string[];
  aiLocalToolsEnabled: boolean;
  aiLocalToolsMaxRounds: number;
  aiLocalSerpEnabled: boolean;
}

export const ENGINE_SETTINGS_DEFAULTS: EngineSettingsShape = {
  simulationLatencyMs: 0,
  volatilityMultiplier: 1.0,
  forceOfflineFallback: false,
  verboseLogging: true,
  usePlaywrightScrapers: true,
  useApiFeeds: false,
  journalAutoDownloadImages: false,
  journalAutoDownloadVideos: false,
  journalMaxImageMb: 5,
  journalMaxVideoMb: 25,
  skipAutoMarketRefresh: true,
  marketRefreshFreshnessValue: 24,
  marketRefreshFreshnessUnit: "hours",
  fullCatalogScrapeRefresh: false,
  newsArticleRetentionDays: 14,
  newsArticleRefreshMinutes: 60,
  aiWealthBibleEnabled: true,
  aiWealthBibleRuleIds: [],
  aiLocalToolsEnabled: false,
  aiLocalToolsMaxRounds: 4,
  aiLocalSerpEnabled: false,
};

export function mergeEngineSettings(
  partial?: Partial<EngineSettingsShape> | null
): EngineSettingsShape {
  const raw = partial ?? {};
  return {
    simulationLatencyMs:
      typeof raw.simulationLatencyMs === "number"
        ? Math.max(0, Math.min(10000, raw.simulationLatencyMs))
        : ENGINE_SETTINGS_DEFAULTS.simulationLatencyMs,
    volatilityMultiplier:
      typeof raw.volatilityMultiplier === "number"
        ? Math.max(0.1, Math.min(10, raw.volatilityMultiplier))
        : ENGINE_SETTINGS_DEFAULTS.volatilityMultiplier,
    forceOfflineFallback:
      typeof raw.forceOfflineFallback === "boolean"
        ? raw.forceOfflineFallback
        : ENGINE_SETTINGS_DEFAULTS.forceOfflineFallback,
    verboseLogging:
      typeof raw.verboseLogging === "boolean"
        ? raw.verboseLogging
        : ENGINE_SETTINGS_DEFAULTS.verboseLogging,
    usePlaywrightScrapers:
      typeof raw.usePlaywrightScrapers === "boolean"
        ? raw.usePlaywrightScrapers
        : ENGINE_SETTINGS_DEFAULTS.usePlaywrightScrapers,
    useApiFeeds:
      typeof raw.useApiFeeds === "boolean"
        ? raw.useApiFeeds
        : ENGINE_SETTINGS_DEFAULTS.useApiFeeds,
    journalAutoDownloadImages:
      typeof raw.journalAutoDownloadImages === "boolean"
        ? raw.journalAutoDownloadImages
        : ENGINE_SETTINGS_DEFAULTS.journalAutoDownloadImages,
    journalAutoDownloadVideos:
      typeof raw.journalAutoDownloadVideos === "boolean"
        ? raw.journalAutoDownloadVideos
        : ENGINE_SETTINGS_DEFAULTS.journalAutoDownloadVideos,
    journalMaxImageMb:
      typeof raw.journalMaxImageMb === "number"
        ? Math.max(1, Math.min(50, raw.journalMaxImageMb))
        : ENGINE_SETTINGS_DEFAULTS.journalMaxImageMb,
    journalMaxVideoMb:
      typeof raw.journalMaxVideoMb === "number"
        ? Math.max(1, Math.min(200, raw.journalMaxVideoMb))
        : ENGINE_SETTINGS_DEFAULTS.journalMaxVideoMb,
    skipAutoMarketRefresh:
      typeof raw.skipAutoMarketRefresh === "boolean"
        ? raw.skipAutoMarketRefresh
        : ENGINE_SETTINGS_DEFAULTS.skipAutoMarketRefresh,
    marketRefreshFreshnessValue:
      typeof raw.marketRefreshFreshnessValue === "number"
        ? Math.max(1, Math.min(365, Math.round(raw.marketRefreshFreshnessValue)))
        : ENGINE_SETTINGS_DEFAULTS.marketRefreshFreshnessValue,
    marketRefreshFreshnessUnit:
      raw.marketRefreshFreshnessUnit === "days" ||
      raw.marketRefreshFreshnessUnit === "hours"
        ? raw.marketRefreshFreshnessUnit
        : ENGINE_SETTINGS_DEFAULTS.marketRefreshFreshnessUnit,
    fullCatalogScrapeRefresh:
      typeof raw.fullCatalogScrapeRefresh === "boolean"
        ? raw.fullCatalogScrapeRefresh
        : ENGINE_SETTINGS_DEFAULTS.fullCatalogScrapeRefresh,
    newsArticleRetentionDays:
      typeof raw.newsArticleRetentionDays === "number"
        ? Math.max(1, Math.min(180, Math.round(raw.newsArticleRetentionDays)))
        : ENGINE_SETTINGS_DEFAULTS.newsArticleRetentionDays,
    newsArticleRefreshMinutes:
      typeof raw.newsArticleRefreshMinutes === "number"
        ? Math.max(5, Math.min(720, Math.round(raw.newsArticleRefreshMinutes)))
        : ENGINE_SETTINGS_DEFAULTS.newsArticleRefreshMinutes,
    aiWealthBibleEnabled:
      typeof raw.aiWealthBibleEnabled === "boolean"
        ? raw.aiWealthBibleEnabled
        : ENGINE_SETTINGS_DEFAULTS.aiWealthBibleEnabled,
    aiWealthBibleRuleIds: Array.isArray(raw.aiWealthBibleRuleIds)
      ? raw.aiWealthBibleRuleIds.map(String)
      : ENGINE_SETTINGS_DEFAULTS.aiWealthBibleRuleIds,
    aiLocalToolsEnabled:
      typeof raw.aiLocalToolsEnabled === "boolean"
        ? raw.aiLocalToolsEnabled
        : ENGINE_SETTINGS_DEFAULTS.aiLocalToolsEnabled,
    aiLocalToolsMaxRounds:
      typeof raw.aiLocalToolsMaxRounds === "number"
        ? Math.max(1, Math.min(8, Math.round(raw.aiLocalToolsMaxRounds)))
        : ENGINE_SETTINGS_DEFAULTS.aiLocalToolsMaxRounds,
    aiLocalSerpEnabled:
      typeof raw.aiLocalSerpEnabled === "boolean"
        ? raw.aiLocalSerpEnabled
        : ENGINE_SETTINGS_DEFAULTS.aiLocalSerpEnabled,
  };
}
