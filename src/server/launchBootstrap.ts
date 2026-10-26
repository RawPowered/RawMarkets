import type { Express } from "express";
import { getDb } from "./db";
import { getLastMarketFeedAt } from "./marketRefreshPolicy";
import type { PortfolioRouteDeps } from "./portfolioRoutes";
import { buildPortfolioResponse } from "./portfolioRoutes";
import type { NewsBayRouteDeps } from "./newsBayFetch";
import { warmRssForLaunch } from "./newsBayFetch";
import {
  runMarketDataFreshLaunch,
  type MarketFreshLaunchCtx,
} from "./marketDataFreshLaunch";
import { listPortfolioHoldings } from "./portfolioDb";
import { syncPortfolioSnapshotsFromMarket } from "./portfolioLaunchSync";

export type LaunchPhase =
  | "idle"
  | "hydrate"
  | "news"
  | "market"
  | "portfolio"
  | "complete"
  | "error";

export interface HydrateSummary {
  articleCount: number;
  holdingCount: number;
  quoteCount: number;
  lastMarketFeedAt: string | null;
}

export interface LaunchBootstrapState {
  status: "idle" | "running" | "complete" | "error";
  phase: LaunchPhase;
  detail: string;
  progress: number;
  hydrateSummary: HydrateSummary | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  result: {
    marketOk?: boolean;
    portfolioHoldings?: number;
    newsFeedsFetched?: number;
    newsArticlesStored?: number;
  } | null;
}

export interface LaunchBootstrapDeps {
  portfolioDeps: PortfolioRouteDeps;
  newsBayDeps: NewsBayRouteDeps;
  marketFreshCtx: MarketFreshLaunchCtx;
}

let launchState: LaunchBootstrapState = freshLaunchState();
let bootstrapRunning = false;
let cachedHydrateSummary: HydrateSummary | null = null;
let phaseStartedAt = 0;
let pipelineStartedAt = 0;

function freshLaunchState(): LaunchBootstrapState {
  return {
    status: "idle",
    phase: "idle",
    detail: "",
    progress: 0,
    hydrateSummary: null,
    startedAt: null,
    completedAt: null,
    error: null,
    result: null,
  };
}

function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function elapsedSec(since: number): number {
  return Math.max(0, Math.round((Date.now() - since) / 1000));
}

function readHydrateSummary(): HydrateSummary {
  const db = getDb();
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let articleCount = 0;
  let holdingCount = 0;
  let quoteCount = 0;
  try {
    const articleRow = db
      .prepare(
        `SELECT COUNT(*) as c FROM news_bay_articles WHERE last_seen_at >= ?`
      )
      .get(thirtyDaysAgo) as { c: number };
    articleCount = articleRow?.c ?? 0;
  } catch {
    articleCount = 0;
  }
  try {
    const holdingRow = db
      .prepare("SELECT COUNT(*) as c FROM portfolio_holdings")
      .get() as { c: number };
    holdingCount = holdingRow?.c ?? 0;
  } catch {
    holdingCount = 0;
  }
  try {
    const quoteRow = db
      .prepare(
        `SELECT COUNT(DISTINCT asset_key) as c FROM market_price_history`
      )
      .get() as { c: number };
    quoteCount = quoteRow?.c ?? 0;
  } catch {
    quoteCount = 0;
  }
  const lastAt = getLastMarketFeedAt();
  return {
    articleCount,
    holdingCount,
    quoteCount,
    lastMarketFeedAt: lastAt ? new Date(lastAt).toISOString() : null,
  };
}

function setPhase(phase: LaunchPhase, detail: string, progress: number): void {
  phaseStartedAt = Date.now();
  launchState = {
    ...launchState,
    status: "running",
    phase,
    detail,
    progress,
    hydrateSummary: cachedHydrateSummary,
  };
}

function phaseDetail(base: string): string {
  const sec = elapsedSec(phaseStartedAt);
  return sec > 0 ? `${base} (${sec}s)` : base;
}

async function runBootstrapPipeline(deps: LaunchBootstrapDeps): Promise<void> {
  pipelineStartedAt = Date.now();
  cachedHydrateSummary = readHydrateSummary();
  launchState = {
    ...freshLaunchState(),
    status: "running",
    phase: "hydrate",
    detail: `${cachedHydrateSummary.quoteCount} quotes, ${cachedHydrateSummary.articleCount} articles, ${cachedHydrateSummary.holdingCount} holdings cached`,
    progress: 8,
    startedAt: new Date().toISOString(),
    hydrateSummary: cachedHydrateSummary,
  };
  phaseStartedAt = pipelineStartedAt;
  await yieldEventLoop();

  const warnings: string[] = [];
  let marketOk = false;
  let portfolioHoldings = 0;
  let newsFeedsFetched = 0;
  let newsArticlesStored = 0;

  try {
    setPhase("news", "RSS preload (polite, cache-first)…", 20);
    try {
      const news = await warmRssForLaunch(deps.newsBayDeps);
      newsFeedsFetched = news.feedsFetched;
      newsArticlesStored = news.articlesStored;
      launchState.detail = phaseDetail(
        `RSS done — ${newsArticlesStored} articles from ${newsFeedsFetched} feeds`
      );
    } catch (newsErr: unknown) {
      const msg = newsErr instanceof Error ? newsErr.message : String(newsErr);
      warnings.push(`News RSS: ${msg}`);
    }
    await yieldEventLoop();

    setPhase(
      "market",
      "Market capture (metals + focus symbols, ~1–3 min)…",
      50
    );
    try {
      const market = await runMarketDataFreshLaunch(deps.marketFreshCtx);
      marketOk = market.ok;
      if (!market.ok) {
        warnings.push(`Market: ${market.message ?? "capture incomplete"}`);
      }
      const skipNote =
        market.skippedToday != null && market.skippedToday > 0
          ? ` — ${market.skippedToday} already captured today`
          : "";
      launchState.detail = phaseDetail(
        marketOk
          ? `Market capture complete${skipNote}`
          : `Market capture finished with gaps${skipNote}`
      );
    } catch (marketErr: unknown) {
      const msg = marketErr instanceof Error ? marketErr.message : String(marketErr);
      warnings.push(`Market: ${msg}`);
    }
    await yieldEventLoop();

    setPhase("portfolio", "Syncing portfolio from market…", 82);
    try {
      const holdings = listPortfolioHoldings();
      const sync = await syncPortfolioSnapshotsFromMarket(holdings, {
        apiCache: deps.portfolioDeps.apiCache,
        saveCache: deps.portfolioDeps.saveCache,
        getCatalogItems: deps.marketFreshCtx.getCatalogItems,
      });
      const portfolio = await buildPortfolioResponse(deps.portfolioDeps, false, {
        skipResearchEnqueue: true,
      });
      portfolioHoldings = portfolio.holdings?.length ?? 0;
      launchState.detail = phaseDetail(
        `Portfolio synced — ${sync.synced} snapshot(s), ${portfolioHoldings} holding(s)`
      );
    } catch (portErr: unknown) {
      const msg = portErr instanceof Error ? portErr.message : String(portErr);
      warnings.push(`Portfolio: ${msg}`);
    }

    const totalSec = elapsedSec(pipelineStartedAt);
    const detail =
      warnings.length > 0
        ? `Preload finished in ${totalSec}s with warnings: ${warnings.join("; ")}`
        : `Launch preload complete in ${totalSec}s — terminal ready.`;

    launchState = {
      ...launchState,
      status: "complete",
      phase: "complete",
      detail,
      progress: 100,
      completedAt: new Date().toISOString(),
      error: warnings.length > 0 ? warnings.join("; ") : null,
      hydrateSummary: cachedHydrateSummary,
      result: {
        marketOk,
        portfolioHoldings,
        newsFeedsFetched,
        newsArticlesStored,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    launchState = {
      ...launchState,
      status: "error",
      phase: "error",
      detail: msg,
      progress: launchState.progress,
      error: msg,
      completedAt: new Date().toISOString(),
      hydrateSummary: cachedHydrateSummary,
    };
  } finally {
    bootstrapRunning = false;
  }
}

export function getLaunchBootstrapState(): LaunchBootstrapState {
  return {
    ...launchState,
    hydrateSummary: cachedHydrateSummary ?? launchState.hydrateSummary,
  };
}

export function registerLaunchRoutes(
  app: Express,
  deps: LaunchBootstrapDeps
): void {
  app.get("/api/launch/status", (_req, res) => {
    res.json({ success: true, ...getLaunchBootstrapState() });
  });

  app.get("/api/launch/summary", (_req, res) => {
    res.json({
      success: true,
      hydrateSummary: cachedHydrateSummary ?? readHydrateSummary(),
      lastBootstrap: launchState.status === "complete" ? launchState.result : null,
      completedAt: launchState.completedAt,
    });
  });

  app.post("/api/launch/bootstrap", (_req, res) => {
    if (bootstrapRunning) {
      res.status(202).json({
        success: true,
        message: "Bootstrap already running",
        ...getLaunchBootstrapState(),
      });
      return;
    }
    if (launchState.status === "complete" || launchState.status === "error") {
      launchState = freshLaunchState();
    }
    bootstrapRunning = true;
    void runBootstrapPipeline(deps).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      bootstrapRunning = false;
      launchState = {
        ...launchState,
        status: "error",
        phase: "error",
        detail: msg,
        error: msg,
        completedAt: new Date().toISOString(),
        hydrateSummary: cachedHydrateSummary,
      };
    });
    res.status(202).json({
      success: true,
      message: "Bootstrap started",
      ...getLaunchBootstrapState(),
    });
  });
}
