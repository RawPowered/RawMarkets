import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import {
  DEFAULT_ENABLED_WEALTH_BIBLE_RULE_IDS,
  getWealthBibleRuleById,
} from "../lib/wealthBibleRules";

function resolveDataDir(): string {
  const configured = process.env.RAWMARKETS_DATA_DIR?.trim();
  return configured || path.join(process.cwd(), "data");
}

let DATA_DIR = resolveDataDir();
export let DB_PATH = path.join(DATA_DIR, "rawmarkets.db");

function refreshDataPaths(): void {
  DATA_DIR = resolveDataDir();
  DB_PATH = path.join(DATA_DIR, "rawmarkets.db");
}

function cacheFile(): string {
  return path.join(DATA_DIR, ".av_cache.json");
}

function customAssetsFile(): string {
  return path.join(DATA_DIR, ".custom_assets.json");
}

export interface CachedData {
  timestamp: number;
  data: unknown;
}

export interface EngineSettings {
  simulationLatencyMs: number;
  volatilityMultiplier: number;
  forceOfflineFallback: boolean;
  verboseLogging: boolean;
  /** Kitco + Yahoo Playwright scrapers (default on). */
  usePlaywrightScrapers: boolean;
  /** Alpha Vantage stock quotes when scrapers off (metals use Kitco/Yahoo only). */
  useApiFeeds: boolean;
  journalAutoDownloadImages: boolean;
  journalAutoDownloadVideos: boolean;
  journalMaxImageMb: number;
  journalMaxVideoMb: number;
  /** When true, skip live market scrape if last feed is within freshness window. */
  skipAutoMarketRefresh: boolean;
  marketRefreshFreshnessValue: number;
  marketRefreshFreshnessUnit: "hours" | "days";
  /** When true, full refresh scrapes up to 8 symbols and all four Kitco metals. */
  fullCatalogScrapeRefresh: boolean;
  /** Days to keep News Bay articles that have not been clipped to the journal. */
  newsArticleRetentionDays: number;
  /** Minutes before News Bay refetches a saved feed instead of reading SQLite. */
  newsArticleRefreshMinutes: number;
  /** Inject Bible of Wealth principles into Local Copilot as first-priority rules. */
  aiWealthBibleEnabled: boolean;
  /** Enabled Wealth Bible rule IDs; empty while enabled means all catalog rules. */
  aiWealthBibleRuleIds: string[];
  /** Allow Local Copilot tool calls (platform news, page fetch, Reader tabs). */
  aiLocalToolsEnabled: boolean;
  /** Max tool rounds per chat turn (capped at 8). */
  aiLocalToolsMaxRounds: number;
  /** Allow Local Copilot to call SerpApi Google News when a key is configured. */
  aiLocalSerpEnabled: boolean;
}

export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
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

function normalizeWealthBibleRuleIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const id = String(item).trim();
    if (id && getWealthBibleRuleById(id) && !out.includes(id)) {
      out.push(id);
    }
  }
  return out;
}

export function normalizeEngineSettings(
  partial?: Partial<EngineSettings> | null
): EngineSettings {
  const raw = partial ?? {};
  return {
    simulationLatencyMs:
      typeof raw.simulationLatencyMs === "number"
        ? Math.max(0, Math.min(10000, raw.simulationLatencyMs))
        : DEFAULT_ENGINE_SETTINGS.simulationLatencyMs,
    volatilityMultiplier:
      typeof raw.volatilityMultiplier === "number"
        ? Math.max(0.1, Math.min(10, raw.volatilityMultiplier))
        : DEFAULT_ENGINE_SETTINGS.volatilityMultiplier,
    forceOfflineFallback:
      typeof raw.forceOfflineFallback === "boolean"
        ? raw.forceOfflineFallback
        : DEFAULT_ENGINE_SETTINGS.forceOfflineFallback,
    verboseLogging:
      typeof raw.verboseLogging === "boolean"
        ? raw.verboseLogging
        : DEFAULT_ENGINE_SETTINGS.verboseLogging,
    usePlaywrightScrapers:
      typeof raw.usePlaywrightScrapers === "boolean"
        ? raw.usePlaywrightScrapers
        : DEFAULT_ENGINE_SETTINGS.usePlaywrightScrapers,
    useApiFeeds:
      typeof raw.useApiFeeds === "boolean"
        ? raw.useApiFeeds
        : DEFAULT_ENGINE_SETTINGS.useApiFeeds,
    journalAutoDownloadImages:
      typeof raw.journalAutoDownloadImages === "boolean"
        ? raw.journalAutoDownloadImages
        : DEFAULT_ENGINE_SETTINGS.journalAutoDownloadImages,
    journalAutoDownloadVideos:
      typeof raw.journalAutoDownloadVideos === "boolean"
        ? raw.journalAutoDownloadVideos
        : DEFAULT_ENGINE_SETTINGS.journalAutoDownloadVideos,
    journalMaxImageMb:
      typeof raw.journalMaxImageMb === "number"
        ? Math.max(1, Math.min(50, raw.journalMaxImageMb))
        : DEFAULT_ENGINE_SETTINGS.journalMaxImageMb,
    journalMaxVideoMb:
      typeof raw.journalMaxVideoMb === "number"
        ? Math.max(1, Math.min(200, raw.journalMaxVideoMb))
        : DEFAULT_ENGINE_SETTINGS.journalMaxVideoMb,
    skipAutoMarketRefresh:
      typeof raw.skipAutoMarketRefresh === "boolean"
        ? raw.skipAutoMarketRefresh
        : DEFAULT_ENGINE_SETTINGS.skipAutoMarketRefresh,
    marketRefreshFreshnessValue:
      typeof raw.marketRefreshFreshnessValue === "number"
        ? Math.max(1, Math.min(365, Math.round(raw.marketRefreshFreshnessValue)))
        : DEFAULT_ENGINE_SETTINGS.marketRefreshFreshnessValue,
    marketRefreshFreshnessUnit:
      raw.marketRefreshFreshnessUnit === "days" ||
      raw.marketRefreshFreshnessUnit === "hours"
        ? raw.marketRefreshFreshnessUnit
        : DEFAULT_ENGINE_SETTINGS.marketRefreshFreshnessUnit,
    fullCatalogScrapeRefresh:
      typeof raw.fullCatalogScrapeRefresh === "boolean"
        ? raw.fullCatalogScrapeRefresh
        : DEFAULT_ENGINE_SETTINGS.fullCatalogScrapeRefresh,
    newsArticleRetentionDays:
      typeof raw.newsArticleRetentionDays === "number"
        ? Math.max(1, Math.min(180, Math.round(raw.newsArticleRetentionDays)))
        : DEFAULT_ENGINE_SETTINGS.newsArticleRetentionDays,
    newsArticleRefreshMinutes:
      typeof raw.newsArticleRefreshMinutes === "number"
        ? Math.max(5, Math.min(720, Math.round(raw.newsArticleRefreshMinutes)))
        : DEFAULT_ENGINE_SETTINGS.newsArticleRefreshMinutes,
    aiWealthBibleEnabled:
      typeof raw.aiWealthBibleEnabled === "boolean"
        ? raw.aiWealthBibleEnabled
        : DEFAULT_ENGINE_SETTINGS.aiWealthBibleEnabled,
    aiWealthBibleRuleIds: normalizeWealthBibleRuleIds(raw.aiWealthBibleRuleIds),
    aiLocalToolsEnabled:
      typeof raw.aiLocalToolsEnabled === "boolean"
        ? raw.aiLocalToolsEnabled
        : DEFAULT_ENGINE_SETTINGS.aiLocalToolsEnabled,
    aiLocalToolsMaxRounds:
      typeof raw.aiLocalToolsMaxRounds === "number"
        ? Math.max(1, Math.min(8, Math.round(raw.aiLocalToolsMaxRounds)))
        : DEFAULT_ENGINE_SETTINGS.aiLocalToolsMaxRounds,
    aiLocalSerpEnabled:
      typeof raw.aiLocalSerpEnabled === "boolean"
        ? raw.aiLocalSerpEnabled
        : DEFAULT_ENGINE_SETTINGS.aiLocalSerpEnabled,
  };
}

export function resolvedWealthBibleRuleIds(settings: EngineSettings): string[] {
  if (!settings.aiWealthBibleEnabled) return [];
  if (settings.aiWealthBibleRuleIds.length > 0) {
    return settings.aiWealthBibleRuleIds;
  }
  return [...DEFAULT_ENABLED_WEALTH_BIBLE_RULE_IDS];
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}

export function initDatabase(): void {
  refreshDataPaths();
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (db) {
    db.close();
  }
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS api_cache (
      cache_key TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS custom_assets (
      symbol TEXT PRIMARY KEY,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS engine_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      settings TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS engine_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS portfolio_holdings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      entry_date TEXT NOT NULL,
      entry_mode TEXT NOT NULL CHECK (entry_mode IN ('shares', 'dollars')),
      shares REAL NOT NULL,
      entry_price REAL NOT NULL,
      dollars_invested REAL,
      barbell_side TEXT NOT NULL DEFAULT 'aggressive',
      wealth_bucket TEXT NOT NULL DEFAULT 'public_equities',
      fragility TEXT NOT NULL DEFAULT 'speculative',
      target_pct REAL,
      take_profit_pct REAL,
      stop_loss_pct REAL,
      kelly_p REAL,
      kelly_b REAL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS portfolio_price_snapshots (
      holding_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      close REAL NOT NULL,
      source TEXT NOT NULL DEFAULT 'yahoo_chart',
      PRIMARY KEY (holding_id, date),
      FOREIGN KEY (holding_id) REFERENCES portfolio_holdings(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS portfolio_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      safe_target_pct REAL NOT NULL DEFAULT 80,
      aggressive_target_pct REAL NOT NULL DEFAULT 20,
      rebalance_drift_pct REAL NOT NULL DEFAULT 5,
      last_rebalance_date TEXT,
      cash_buffer_usd REAL NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS market_price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_key TEXT NOT NULL,
      symbol TEXT NOT NULL,
      price REAL NOT NULL,
      change_amount REAL,
      change_percent TEXT,
      source TEXT NOT NULL,
      checked_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_market_price_history_key_time
      ON market_price_history(asset_key, checked_at DESC);
    CREATE TABLE IF NOT EXISTS investor_journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      snippet TEXT,
      source TEXT,
      entry_type TEXT NOT NULL DEFAULT 'manual',
      snapshot_json TEXT,
      media_json TEXT,
      tags TEXT,
      notes TEXT,
      linked_asset_key TEXT,
      sentiment TEXT,
      score REAL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_unfurled_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_journal_entries_created
      ON investor_journal_entries(created_at DESC);
    CREATE TABLE IF NOT EXISTS terminal_symbol_prefs (
      symbol TEXT PRIMARY KEY,
      hidden INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS engine_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS catalog_symbol_removals (
      symbol TEXT PRIMARY KEY,
      removed_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dashboard_layout (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      layout_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  const portfolioSettingsRow = db
    .prepare("SELECT id FROM portfolio_settings WHERE id = 1")
    .get();
  if (!portfolioSettingsRow) {
    db.prepare(
      `INSERT INTO portfolio_settings (id, safe_target_pct, aggressive_target_pct, rebalance_drift_pct, last_rebalance_date, cash_buffer_usd, updated_at)
       VALUES (1, 80, 20, 5, NULL, 0, ?)`
    ).run(Date.now());
  }

  const settingsRow = db
    .prepare("SELECT settings FROM engine_settings WHERE id = 1")
    .get() as { settings: string } | undefined;
  if (!settingsRow) {
    db.prepare(
      "INSERT INTO engine_settings (id, settings) VALUES (1, ?)"
    ).run(JSON.stringify(DEFAULT_ENGINE_SETTINGS));
  }

  runPortfolioResearchMigration();
  runSqlMigrations([
    "20260524_catalog_baseline",
    "20260524_purge_simulation_cache",
    "20260524_catalog_symbol_removals",
    "20260525_dashboard_layout",
    "20260525_news_bay",
    "20260527_news_article_store",
    "20260525_symbol_sec_meta",
    "20260525_symbol_ir_feeds",
    "20260602_portfolio_transactions",
    "20260603_portfolio_holding_archive",
  ]);
  runPortfolioHoldingArchiveMigration();
  runTerminalPrefsMigration();
  migrateJsonFiles();
}

const PORTFOLIO_RESEARCH_MIGRATION = "20260523_portfolio_research";

function resolveMigrationPath(name: string): string | null {
  const candidates = [
    path.join(process.cwd(), "migrations", `${name}.sql`),
    path.join(process.cwd(), "dist", "migrations", `${name}.sql`),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function runSqlMigrations(names: string[]): void {
  const database = getDb();
  for (const name of names) {
    const migrationPath = resolveMigrationPath(name);
    if (!migrationPath) continue;
    const sql = fs.readFileSync(migrationPath, "utf-8");
    database.exec(sql);
    database
      .prepare("INSERT OR IGNORE INTO engine_meta (key, value) VALUES (?, ?)")
      .run(`migration:${name}`, String(Date.now()));
  }
}

function runPortfolioHoldingArchiveMigration(): void {
  const database = getDb();
  const cols = database
    .prepare("PRAGMA table_info(portfolio_holdings)")
    .all() as { name: string }[];
  if (!cols.some((c) => c.name === "archived_at")) {
    database.exec(
      "ALTER TABLE portfolio_holdings ADD COLUMN archived_at INTEGER"
    );
  }
}

function runTerminalPrefsMigration(): void {
  const database = getDb();
  const cols = database
    .prepare("PRAGMA table_info(terminal_symbol_prefs)")
    .all() as { name: string }[];
  if (!cols.some((c) => c.name === "pinned")) {
    database.exec(
      "ALTER TABLE terminal_symbol_prefs ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0"
    );
  }
  if (!cols.some((c) => c.name === "pin_order")) {
    database.exec(
      "ALTER TABLE terminal_symbol_prefs ADD COLUMN pin_order INTEGER NOT NULL DEFAULT 0"
    );
  }
}

function runPortfolioResearchMigration(): void {
  const database = getDb();
  const applied = database
    .prepare("SELECT value FROM engine_meta WHERE key = ?")
    .get(`migration:${PORTFOLIO_RESEARCH_MIGRATION}`) as
    | { value: string }
    | undefined;

  const migrationPath = resolveMigrationPath(PORTFOLIO_RESEARCH_MIGRATION);
  if (migrationPath) {
    const sql = fs.readFileSync(migrationPath, "utf-8");
    database.exec(sql);
  }

  const settingsCols = database
    .prepare("PRAGMA table_info(portfolio_settings)")
    .all() as { name: string }[];
  const colNames = new Set(settingsCols.map((c) => c.name));
  const addCol = (name: string, ddl: string) => {
    if (!colNames.has(name)) {
      database.exec(`ALTER TABLE portfolio_settings ADD COLUMN ${ddl}`);
    }
  };
  addCol("research_enabled", "research_enabled INTEGER NOT NULL DEFAULT 1");
  addCol(
    "research_min_history_days",
    "research_min_history_days INTEGER NOT NULL DEFAULT 25"
  );
  addCol(
    "ollama_news_enabled",
    "ollama_news_enabled INTEGER NOT NULL DEFAULT 1"
  );
  addCol("last_research_at", "last_research_at INTEGER");

  if (!applied) {
    database
      .prepare(
        "INSERT OR REPLACE INTO engine_meta (key, value) VALUES (?, ?)"
      )
      .run(`migration:${PORTFOLIO_RESEARCH_MIGRATION}`, String(Date.now()));
    console.log(`[DB] Applied migration ${PORTFOLIO_RESEARCH_MIGRATION}.`);
  }
}

/** Run research migration on an open database (for tests). */
export function applyPortfolioResearchMigration(dbInstance: Database.Database): void {
  const prev = db;
  db = dbInstance;
  try {
    runPortfolioResearchMigration();
  } finally {
    db = prev;
  }
}

function migrateJsonFiles(): void {
  const database = getDb();

  const CACHE_FILE = cacheFile();
  const CUSTOM_ASSETS_FILE = customAssetsFile();

  if (fs.existsSync(CACHE_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8")) as Record<
        string,
        CachedData
      >;
      const insert = database.prepare(
        "INSERT OR REPLACE INTO api_cache (cache_key, timestamp, payload) VALUES (?, ?, ?)"
      );
      const tx = database.transaction(() => {
        for (const [key, entry] of Object.entries(raw)) {
          insert.run(key, entry.timestamp, JSON.stringify(entry.data));
        }
      });
      tx();
      console.log(
        `[DB] Migrated ${Object.keys(raw).length} cache entries from .av_cache.json`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[DB] Cache migration skipped: ${msg}`);
    }
  }

  if (fs.existsSync(CUSTOM_ASSETS_FILE)) {
    try {
      const raw = JSON.parse(
        fs.readFileSync(CUSTOM_ASSETS_FILE, "utf-8")
      ) as Record<string, unknown>;
      const insert = database.prepare(
        "INSERT OR REPLACE INTO custom_assets (symbol, payload) VALUES (?, ?)"
      );
      const tx = database.transaction(() => {
        for (const [symbol, payload] of Object.entries(raw)) {
          insert.run(symbol, JSON.stringify(payload));
        }
      });
      tx();
      console.log(
        `[DB] Migrated ${Object.keys(raw).length} custom assets from .custom_assets.json`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[DB] Custom assets migration skipped: ${msg}`);
    }
  }
}

export function loadApiCache(): Record<string, CachedData> {
  const rows = getDb()
    .prepare("SELECT cache_key, timestamp, payload FROM api_cache")
    .all() as { cache_key: string; timestamp: number; payload: string }[];

  const result: Record<string, CachedData> = {};
  for (const row of rows) {
    result[row.cache_key] = {
      timestamp: row.timestamp,
      data: JSON.parse(row.payload),
    };
  }
  return result;
}

export function setApiCacheEntry(cacheKey: string, entry: CachedData): void {
  getDb()
    .prepare(
      "INSERT OR REPLACE INTO api_cache (cache_key, timestamp, payload) VALUES (?, ?, ?)"
    )
    .run(cacheKey, entry.timestamp, JSON.stringify(entry.data));
}

/** Drop cached API payloads so a new key is not masked by old SIM snapshots. */
export function clearApiCacheForProvider(providerId: string): number {
  const patterns: Record<string, string[]> = {
    alpha_vantage: ["quote_%", "commodities_%", "daily_%"],
    metalprice: ["metalprice_%"],
    serpapi: ["news_%"],
  };
  const likeList = patterns[providerId];
  if (!likeList?.length) return 0;
  const db = getDb();
  let removed = 0;
  for (const like of likeList) {
    const r = db
      .prepare("DELETE FROM api_cache WHERE cache_key LIKE ?")
      .run(like);
    removed += r.changes;
  }
  return removed;
}

export function clearAllApiCache(): number {
  const r = getDb().prepare("DELETE FROM api_cache").run();
  return r.changes;
}

export function loadCustomAssets(): Record<string, unknown> {
  const rows = getDb()
    .prepare("SELECT symbol, payload FROM custom_assets")
    .all() as { symbol: string; payload: string }[];

  const result: Record<string, unknown> = {};
  for (const row of rows) {
    result[row.symbol] = JSON.parse(row.payload);
  }
  return result;
}

export function setCustomAsset(symbol: string, payload: unknown): void {
  getDb()
    .prepare(
      "INSERT OR REPLACE INTO custom_assets (symbol, payload) VALUES (?, ?)"
    )
    .run(symbol, JSON.stringify(payload));
}

export function deleteCustomAsset(symbol: string): boolean {
  const result = getDb()
    .prepare("DELETE FROM custom_assets WHERE symbol = ?")
    .run(symbol.toUpperCase());
  return result.changes > 0;
}

export function hasCustomAsset(symbol: string): boolean {
  const row = getDb()
    .prepare("SELECT symbol FROM custom_assets WHERE symbol = ?")
    .get(symbol.toUpperCase()) as { symbol: string } | undefined;
  return !!row;
}

export function clearCustomAssets(): void {
  getDb().prepare("DELETE FROM custom_assets").run();
}

export function getEngineSettings(): EngineSettings {
  const row = getDb()
    .prepare("SELECT settings FROM engine_settings WHERE id = 1")
    .get() as { settings: string } | undefined;
  if (!row) {
    return { ...DEFAULT_ENGINE_SETTINGS };
  }
  try {
    const parsed = JSON.parse(row.settings) as Partial<EngineSettings>;
    return normalizeEngineSettings({
      ...DEFAULT_ENGINE_SETTINGS,
      ...parsed,
    });
  } catch {
    return { ...DEFAULT_ENGINE_SETTINGS };
  }
}

export function saveEngineSettings(settings: EngineSettings): void {
  const normalized = normalizeEngineSettings(settings);
  getDb()
    .prepare(
      "INSERT OR REPLACE INTO engine_settings (id, settings) VALUES (1, ?)"
    )
    .run(JSON.stringify(normalized));
}

export function loadEngineLogs(): string[] {
  const rows = getDb()
    .prepare(
      "SELECT message FROM engine_logs ORDER BY id ASC LIMIT 50"
    )
    .all() as { message: string }[];
  return rows.map((r) => r.message);
}

export function appendEngineLog(message: string): void {
  const database = getDb();
  database
    .prepare("INSERT INTO engine_logs (message, created_at) VALUES (?, ?)")
    .run(message, Date.now());

  const count = (
    database.prepare("SELECT COUNT(*) as c FROM engine_logs").get() as {
      c: number;
    }
  ).c;
  if (count > 50) {
    database
      .prepare(
        `DELETE FROM engine_logs WHERE id IN (
          SELECT id FROM engine_logs ORDER BY id ASC LIMIT ?
        )`
      )
      .run(count - 50);
  }
}

export function seedInitialLogs(): void {
  const existing = (
    getDb().prepare("SELECT COUNT(*) as c FROM engine_logs").get() as {
      c: number;
    }
  ).c;
  if (existing === 0) {
    const ts = new Date().toISOString().substring(11, 19);
    appendEngineLog(
      `[${ts}] Raw Investor terminal core engine initialized.`
    );
    appendEngineLog(`[${ts}] Secure storage loaded. SQLite is the system of record.`);
  }
}

export const KEY_ENV_MAP: Record<string, string> = {
  gemini: "GEMINI_API_KEY",
  alpha_vantage: "ALPHA_VANTAGE_API_KEY",
  serpapi: "SERPAPI_API_KEY",
  metalprice: "METALPRICE_API_KEY",
  app_url: "APP_URL",
};

export function getApiKeyFromDb(id: string): string | undefined {
  const row = getDb()
    .prepare("SELECT value FROM api_keys WHERE id = ?")
    .get(id) as { value: string } | undefined;
  const v = row?.value?.trim();
  return v || undefined;
}

export function getApiKey(id: string): string | undefined {
  const fromDb = getApiKeyFromDb(id);
  if (fromDb) return fromDb;
  const envName = KEY_ENV_MAP[id];
  if (!envName) return undefined;
  const fromEnv = process.env[envName]?.trim();
  return fromEnv || undefined;
}

export function listApiKeysMeta(): {
  id: string;
  hasValue: boolean;
  updatedAt: number | null;
  hint: string | null;
  source: "db" | "env" | "none";
}[] {
  return Object.keys(KEY_ENV_MAP).map((id) => {
    const dbVal = getApiKeyFromDb(id);
    const envName = KEY_ENV_MAP[id];
    const envVal = process.env[envName]?.trim();
    const value = dbVal || envVal;
    let source: "db" | "env" | "none" = "none";
    if (dbVal) source = "db";
    else if (envVal) source = "env";

    const row = getDb()
      .prepare("SELECT updated_at FROM api_keys WHERE id = ?")
      .get(id) as { updated_at: number } | undefined;

    return {
      id,
      hasValue: !!value,
      updatedAt: row?.updated_at ?? null,
      hint: value && value.length >= 4 ? `••••${value.slice(-4)}` : null,
      source,
    };
  });
}

export function upsertApiKey(id: string, value: string): void {
  if (!KEY_ENV_MAP[id]) {
    throw new Error(`Unknown key id: ${id}`);
  }
  getDb()
    .prepare(
      "INSERT OR REPLACE INTO api_keys (id, value, updated_at) VALUES (?, ?, ?)"
    )
    .run(id, value.trim(), Date.now());
}

export function deleteApiKey(id: string): boolean {
  const result = getDb()
    .prepare("DELETE FROM api_keys WHERE id = ?")
    .run(id);
  return result.changes > 0;
}

export function getDbTelemetry(): {
  dbPath: string;
  dbSize: number;
  customCount: number;
  cacheCount: number;
  keysCount: number;
  newsArticleCount: number;
} {
  const database = getDb();
  const customCount = (
    database.prepare("SELECT COUNT(*) as c FROM custom_assets").get() as {
      c: number;
    }
  ).c;
  const cacheCount = (
    database.prepare("SELECT COUNT(*) as c FROM api_cache").get() as {
      c: number;
    }
  ).c;
  const keysCount = (
    database.prepare("SELECT COUNT(*) as c FROM api_keys").get() as {
      c: number;
    }
  ).c;
  const newsArticleCount = (
    database.prepare("SELECT COUNT(*) as c FROM news_bay_articles").get() as {
      c: number;
    }
  ).c;

  return {
    dbPath: DB_PATH,
    dbSize: fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0,
    customCount,
    cacheCount,
    keysCount,
    newsArticleCount,
  };
}

export function wipeAppData(): void {
  const database = getDb();
  database.prepare("DELETE FROM custom_assets").run();
  database.prepare("DELETE FROM api_cache").run();
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function reopenDatabase(): void {
  closeDatabase();
  initDatabase();
}

export function backupDatabase(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(DATA_DIR, `rawmarkets-backup-${stamp}.db`);
  fs.copyFileSync(DB_PATH, backupPath);
  return backupPath;
}

export function replaceDatabaseFile(newDbBuffer: Buffer): void {
  closeDatabase();
  backupDatabase();
  fs.writeFileSync(DB_PATH, newDbBuffer);
  initDatabase();
}

export function isValidSqliteFile(buffer: Buffer): boolean {
  return (
    buffer.length >= 16 &&
    buffer.subarray(0, 16).toString("utf-8") === "SQLite format 3\u0000"
  );
}
