import type { Express } from "express";
import type { CachedData } from "./db";
import { setCustomAsset } from "./db";
import {
  createPortfolioHolding,
  deletePortfolioHolding,
  getLatestSnapshot,
  getPortfolioHolding,
  getPortfolioSettings,
  listArchivedPortfolioHoldings,
  listPortfolioHoldings,
  listSnapshotsForHolding,
  normalizeHoldingEntry,
  savePortfolioSettings,
  setPortfolioHoldingArchived,
  updatePortfolioHolding,
  upsertPriceSnapshot,
  type CreateHoldingInput,
  type PortfolioHoldingRow,
  type UpdateHoldingInput,
} from "./portfolioDb";
import { classifySymbol } from "../lib/portfolioTaxonomy";
import {
  computeAggregates,
  computePortfolioSignals,
  mergeHistoryPoints,
  type EnrichedHoldingInput,
} from "../lib/portfolioSignals";
import { fetchYahooMultiRange, fetchYahooChart } from "./yahooChart";
import {
  scrapeMarketQuote,
  readCachedMarketQuote,
} from "./scrapers/marketQuote";
import { scrapeCoinbaseQuote } from "./scrapers/coinbaseSpot";
import { isCryptoSymbol } from "./scrapers/types";
import type { HistoryPoint, PortfolioEnrichedHolding, PortfolioResponse, PortfolioResearchMeta } from "../types";
import {
  loadLatestResearchForHoldings,
} from "./portfolioResearchJob";
import {
  enqueueResearch,
  getResearchStatus,
  shouldAutoEnqueueResearch,
} from "./researchQueue";
import { deleteAsset } from "./assetLifecycle";
import {
  purgeNewsBayCacheDb,
  purgeNewsBayCacheForSymbol,
} from "./newsBayCache";
import {
  consolidateDuplicateHoldings,
  findDuplicatePortfolioSymbols,
  importStatementTransactions,
  insertManualBuyTransaction,
  recomputeHoldingForSymbol,
} from "./portfolioImportService";
import {
  deletePortfolioTransaction,
  getPortfolioTransaction,
  listTransactionsBySymbol,
  updatePortfolioTransaction,
} from "./portfolioTransactionsDb";
import type { SymbolSearchDeps } from "./symbolSearch";
import { resolveCompanyNames } from "./symbolCompanyNames";

export interface PortfolioRouteDeps {
  apiCache: Record<string, CachedData>;
  saveCache: () => void;
  getEngineSettings: () => {
    usePlaywrightScrapers: boolean;
    forceOfflineFallback: boolean;
    useApiFeeds: boolean;
  };
  getApiKey: (id: string) => string | undefined;
  symbolSearchDeps?: SymbolSearchDeps;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function registerCustomAssetForSymbol(
  symbol: string,
  entryPrice: number,
  taxonomy: ReturnType<typeof classifySymbol>
): void {
  const key = symbol.toUpperCase();
  const category =
    taxonomy.wealth_bucket === "precious_metals"
      ? "METALS"
      : taxonomy.wealth_bucket === "energy"
        ? "ENERGY"
        : "MARKETS";
  setCustomAsset(key, {
    name: key,
    symbol: key,
    unit: "USD per Share",
    current: entryPrice,
    open: entryPrice,
    high: entryPrice,
    low: entryPrice,
    volume: 0,
    change: 0,
    changePercent: "+0.00%",
    history: [],
    category,
    desc: `Portfolio holding — ${taxonomy.barbell_side} / ${taxonomy.fragility}`,
  });
}

async function resolveLivePrice(
  holding: PortfolioHoldingRow,
  deps: PortfolioRouteDeps,
  fresh: boolean
): Promise<{
  price: number | null;
  dayChangePct: number | null;
  priceSource: string;
  feedNote?: string;
  history7d: HistoryPoint[];
  history30d: HistoryPoint[];
}> {
  const sym = holding.symbol.toUpperCase();
  if (isCryptoSymbol(sym, sym)) {
    const cached = await readCachedMarketQuote({
      apiCache: deps.apiCache,
      assetKey: sym,
      symbol: sym,
      fresh,
      persist: deps.saveCache,
      usePlaywright: false,
    });
    if (cached?.ok && cached.price != null) {
      return {
        price: cached.price,
        dayChangePct: cached.changePercent
          ? parseFloat(cached.changePercent.replace("%", ""))
          : null,
        priceSource: "coinbase",
        feedNote: cached.provider,
        history7d: [],
        history30d: [],
      };
    }
    const coinbase = await scrapeCoinbaseQuote(
      deps.apiCache,
      sym,
      sym,
      fresh,
      deps.saveCache
    );
    if (coinbase.ok && coinbase.price != null) {
      return {
        price: coinbase.price,
        dayChangePct: coinbase.changePercent
          ? parseFloat(coinbase.changePercent.replace("%", ""))
          : null,
        priceSource: "coinbase",
        feedNote: coinbase.provider,
        history7d: [],
        history30d: [],
      };
    }
  }

  const yahoo = await fetchYahooMultiRange(holding.symbol, {
    fresh,
    apiCache: deps.apiCache,
    persistCache: deps.saveCache,
  });

  if (yahoo.quote.ok && yahoo.quote.price != null) {
    return {
      price: yahoo.quote.price,
      dayChangePct: yahoo.quote.changePercent,
      priceSource: yahoo.quote.source,
      history7d: yahoo.history7d,
      history30d: yahoo.history30d,
    };
  }

  const settings = deps.getEngineSettings();
  if (
    settings.usePlaywrightScrapers &&
    !settings.forceOfflineFallback
  ) {
    const scraped = await scrapeMarketQuote({
      apiCache: deps.apiCache,
      assetKey: holding.symbol,
      symbol: holding.symbol,
      fresh,
      persist: deps.saveCache,
      usePlaywright: true,
    });
    if (scraped.ok && scraped.price != null) {
      const chart = await fetchYahooChart(holding.symbol, "1mo", {
        fresh,
        apiCache: deps.apiCache,
        persistCache: deps.saveCache,
      });
      const history30d = chart.history.length ? chart.history : [];
      return {
        price: scraped.price,
        dayChangePct: scraped.changePercent
          ? parseFloat(scraped.changePercent.replace("%", ""))
          : null,
        priceSource: "scrape",
        feedNote: scraped.provider,
        history7d: history30d.slice(-7),
        history30d,
      };
    }
  }

  const snap = getLatestSnapshot(holding.id);
  if (snap) {
    return {
      price: snap.close,
      dayChangePct: null,
      priceSource: snap.source,
      feedNote: yahoo.quote.error ?? "Using last saved snapshot.",
      history7d: [],
      history30d: [],
    };
  }

  return {
    price: null,
    dayChangePct: null,
    priceSource: "manual",
    feedNote: yahoo.quote.error ?? "Live price unavailable.",
    history7d: [],
    history30d: [],
  };
}

function enrichHolding(
  holding: PortfolioHoldingRow,
  live: Awaited<ReturnType<typeof resolveLivePrice>>,
  companyName?: string
): PortfolioEnrichedHolding {
  const costBasis =
    holding.dollars_invested ?? holding.shares * holding.entry_price;
  const currentPrice = live.price;
  const marketValue =
    currentPrice != null ? holding.shares * currentPrice : costBasis;
  const pnlUsd = currentPrice != null ? marketValue - costBasis : 0;
  const pnlPct =
    costBasis > 0 && currentPrice != null
      ? ((marketValue - costBasis) / costBasis) * 100
      : null;

  const snapshots = listSnapshotsForHolding(holding.id, 60);
  const history7d = mergeHistoryPoints(
    snapshots,
    live.history7d
  ).slice(-7);
  const history30d = mergeHistoryPoints(
    snapshots,
    live.history30d
  ).slice(-30);

  return {
    ...holding,
    company_name: companyName,
    current_price: currentPrice,
    day_change_pct: live.dayChangePct,
    price_source: live.priceSource,
    feed_note: live.feedNote,
    market_value: marketValue,
    cost_basis: costBasis,
    pnl_usd: pnlUsd,
    pnl_pct: pnlPct,
    history_7d: history7d,
    history_30d: history30d,
    signals: [],
  };
}

export async function buildPortfolioResponse(
  deps: PortfolioRouteDeps,
  fresh: boolean,
  options?: { forceResearch?: boolean; skipResearchEnqueue?: boolean }
): Promise<PortfolioResponse> {
  const holdings = listPortfolioHoldings({ activeOnly: true });
  const settings = getPortfolioSettings();
  const companyNames =
    deps.symbolSearchDeps != null
      ? await resolveCompanyNames(
          holdings.map((h) => h.symbol),
          deps.symbolSearchDeps
        )
      : {};
  const enrichedList: PortfolioEnrichedHolding[] = await Promise.all(
    holdings.map(async (h) => {
      const live = await resolveLivePrice(h, deps, fresh);
      if (live.price != null) {
        upsertPriceSnapshot(h.id, todayIso(), live.price, "yahoo_chart");
      }
      return enrichHolding(h, live, companyNames[h.symbol]);
    })
  );

  const enrichedInputs: EnrichedHoldingInput[] = enrichedList.map((e) => {
    const {
      current_price,
      day_change_pct,
      market_value,
      cost_basis,
      pnl_usd,
      pnl_pct,
      price_source,
      feed_note,
      history_7d,
      history_30d,
      signals: _s,
      research: _r,
      ...holding
    } = e;
    return {
      holding: holding as PortfolioHoldingRow,
      currentPrice: current_price,
      dayChangePct: day_change_pct,
      marketValue: market_value,
      costBasis: cost_basis,
      pnlUsd: pnl_usd,
      pnlPct: pnl_pct,
    };
  });

  const aggregates = computeAggregates(enrichedInputs, settings.cash_buffer_usd);
  const portfolioSignals = computePortfolioSignals(enrichedInputs, settings);

  const researchStatus = getResearchStatus();
  let researchMeta: PortfolioResearchMeta = {
    status: researchStatus.status,
    engine: researchStatus.engine as PortfolioResearchMeta["engine"],
    python: researchStatus.engine === "python",
    ollama: false,
    startedAt: researchStatus.startedAt,
    evaluatedAt: researchStatus.evaluatedAt,
    error: researchStatus.error,
  };

  if (settings.research_enabled) {
    const cached = await loadLatestResearchForHoldings(
      enrichedList.map((e) => e.id)
    );
    for (const e of enrichedList) {
      e.research = cached.get(e.id) ?? null;
    }
    if (researchMeta.engine == null && cached.size > 0) {
      const first = cached.values().next().value;
      researchMeta.engine = first?.engine ?? null;
      researchMeta.python = first?.engine === "python";
    }
  }

  if (
    fresh &&
    !options?.skipResearchEnqueue &&
    settings.research_enabled &&
    shouldAutoEnqueueResearch(
      settings.last_research_at,
      options?.forceResearch === true
    )
  ) {
    enqueueResearch(
      {
        holdings,
        enriched: enrichedInputs,
        settings,
        portfolioSignals,
        runNews: true,
      },
      {
        apiCache: deps.apiCache,
        saveCache: deps.saveCache,
        getApiKey: deps.getApiKey,
      }
    );
    const queued = getResearchStatus();
    researchMeta = {
      ...researchMeta,
      status: queued.status,
      startedAt: queued.startedAt,
      evaluatedAt: queued.evaluatedAt,
      engine: queued.engine as PortfolioResearchMeta["engine"],
      error: queued.error,
    };
  }

  const withSignals = enrichedList.map((e) => ({
    ...e,
    signals: portfolioSignals.filter(
      (s) => s.holdingId === undefined || s.holdingId === e.id
    ),
  }));

  return {
    success: true,
    settings,
    aggregates,
    signals: portfolioSignals,
    holdings: withSignals,
    refreshed_at: new Date().toISOString(),
    research: researchMeta,
  };
}

export function registerPortfolioRoutes(
  app: Express,
  deps: PortfolioRouteDeps
): void {
  app.get("/api/portfolio", async (_req, res) => {
    try {
      const data = await buildPortfolioResponse(deps, false);
      res.json(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  });

  app.post("/api/portfolio/refresh", async (req, res) => {
    try {
      const forceResearch =
        req.query.research === "1" || req.query.research === "true";
      const data = await buildPortfolioResponse(deps, true, { forceResearch });
      res.json(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  });

  app.get("/api/portfolio/research/status", (_req, res) => {
    res.json({ success: true, ...getResearchStatus() });
  });

  app.post("/api/portfolio/research/run", async (_req, res) => {
    try {
      const holdings = listPortfolioHoldings({ activeOnly: true });
      const settings = getPortfolioSettings();
      if (!settings.research_enabled || holdings.length === 0) {
        return res.json({
          success: false,
          message: "Research disabled or no holdings.",
          ...getResearchStatus(),
        });
      }
      const enrichedList = await Promise.all(
        holdings.map(async (h) => {
          const live = await resolveLivePrice(h, deps, false);
          return enrichHolding(h, live);
        })
      );
      const enrichedInputs: EnrichedHoldingInput[] = enrichedList.map((e) => {
        const {
          current_price,
          day_change_pct,
          market_value,
          cost_basis,
          pnl_usd,
          pnl_pct,
          price_source,
          feed_note,
          history_7d,
          history_30d,
          signals: _s,
          research: _r,
          ...holding
        } = e;
        return {
          holding: holding as PortfolioHoldingRow,
          currentPrice: current_price,
          dayChangePct: day_change_pct,
          marketValue: market_value,
          costBasis: cost_basis,
          pnlUsd: pnl_usd,
          pnlPct: pnl_pct,
        };
      });
      const portfolioSignals = computePortfolioSignals(enrichedInputs, settings);
      const status = enqueueResearch(
        {
          holdings,
          enriched: enrichedInputs,
          settings,
          portfolioSignals,
          runNews: true,
        },
        {
          apiCache: deps.apiCache,
          saveCache: deps.saveCache,
          getApiKey: deps.getApiKey,
        }
      );
      res.json({ success: true, ...status });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  });

  app.post("/api/portfolio/holdings", (req, res) => {
    try {
      const body = req.body as CreateHoldingInput & {
        barbell_side?: string;
        wealth_bucket?: string;
        fragility?: string;
      };

      if (!body.symbol?.trim() || !body.entry_date || !body.entry_price) {
        return res.status(400).json({
          success: false,
          message: "symbol, entry_date, and entry_price are required.",
        });
      }

      const mode =
        body.entry_mode === "dollars" ? "dollars" : ("shares" as const);
      if (mode === "dollars" && !body.dollars_invested) {
        return res.status(400).json({
          success: false,
          message: "dollars_invested required for dollars entry mode.",
        });
      }
      if (mode === "shares" && (body.shares == null || body.shares <= 0)) {
        return res.status(400).json({
          success: false,
          message: "shares required for shares entry mode.",
        });
      }

      const taxonomy = classifySymbol(body.symbol, {
        barbell_side: body.barbell_side as CreateHoldingInput["barbell_side"],
        wealth_bucket: body.wealth_bucket as CreateHoldingInput["wealth_bucket"],
        fragility: body.fragility as CreateHoldingInput["fragility"],
      });

      const norm = normalizeHoldingEntry({
        ...body,
        entry_mode: mode,
        entry_price: Number(body.entry_price),
      });

      const symKey = body.symbol.trim().toUpperCase();
      registerCustomAssetForSymbol(symKey, norm.entry_price, taxonomy);

      const amountUsd =
        norm.dollars_invested ?? norm.shares * norm.entry_price;
      insertManualBuyTransaction({
        symbol: symKey,
        tx_date: body.entry_date.slice(0, 10),
        shares: norm.shares,
        price: norm.entry_price,
        amount_usd: amountUsd,
      });

      const recompute = recomputeHoldingForSymbol(symKey);
      let holding =
        recompute.id != null ? getPortfolioHolding(recompute.id) : null;

      if (!holding) {
        holding = createPortfolioHolding({
          symbol: symKey,
          entry_date: body.entry_date,
          entry_mode: mode,
          shares: norm.shares,
          entry_price: norm.entry_price,
          dollars_invested: norm.dollars_invested,
          barbell_side: taxonomy.barbell_side,
          wealth_bucket: taxonomy.wealth_bucket,
          fragility: taxonomy.fragility,
          target_pct: body.target_pct ?? null,
          take_profit_pct: body.take_profit_pct ?? null,
          stop_loss_pct: body.stop_loss_pct ?? null,
          kelly_p: body.kelly_p ?? null,
          kelly_b: body.kelly_b ?? null,
        });
      } else if (
        body.target_pct != null ||
        body.take_profit_pct != null ||
        body.stop_loss_pct != null
      ) {
        holding =
          updatePortfolioHolding(holding.id, {
            target_pct: body.target_pct ?? null,
            take_profit_pct: body.take_profit_pct ?? null,
            stop_loss_pct: body.stop_loss_pct ?? null,
          }) ?? holding;
      }

      upsertPriceSnapshot(
        holding.id,
        body.entry_date.slice(0, 10),
        norm.entry_price,
        "manual"
      );
      purgeNewsBayCacheForSymbol(symKey, deps.apiCache);
      purgeNewsBayCacheDb(symKey);
      deps.saveCache();

      res.json({ success: true, holding });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  });

  app.patch("/api/portfolio/holdings/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ success: false, message: "Invalid id." });
      }
      const body = req.body as UpdateHoldingInput;
      const updated = updatePortfolioHolding(id, body);
      if (!updated) {
        return res.status(404).json({ success: false, message: "Not found." });
      }
      res.json({ success: true, holding: updated });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  });

  app.delete("/api/portfolio/holdings/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: "Invalid id." });
    }
    const holding = getPortfolioHolding(id);
    if (!holding) {
      return res.status(404).json({ success: false, message: "Not found." });
    }
    const removeCatalog =
      req.query.removeCatalog === "1" || req.query.removeCatalog === "true";
    const ok = deletePortfolioHolding(id);
    if (!ok) {
      return res.status(404).json({ success: false, message: "Not found." });
    }
    if (removeCatalog) {
      deleteAsset(holding.symbol, { force: false });
    }
    res.json({ success: true });
  });

  app.get("/api/portfolio/holdings/:id/history", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const range = (req.query.range as string) === "30d" ? "30d" : "7d";
      const holding = getPortfolioHolding(id);
      if (!holding) {
        return res.status(404).json({ success: false, message: "Not found." });
      }
      const live = await resolveLivePrice(holding, deps, false);
      const snapshots = listSnapshotsForHolding(holding.id, 60);
      const merged = mergeHistoryPoints(
        snapshots,
        range === "30d" ? live.history30d : live.history7d
      );
      const sliced =
        range === "30d" ? merged.slice(-30) : merged.slice(-7);
      res.json({
        success: true,
        range,
        points: sliced,
        entry_date: holding.entry_date,
        entry_price: holding.entry_price,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  });

  app.patch("/api/portfolio/holdings/:id/archive", (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ success: false, message: "Invalid id." });
      }
      const body = req.body as { archived?: boolean };
      const archived = body.archived === true;
      const holding = setPortfolioHoldingArchived(id, archived);
      if (!holding) {
        return res.status(404).json({ success: false, message: "Not found." });
      }
      res.json({ success: true, holding });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  });

  app.get("/api/portfolio/archived", async (_req, res) => {
    try {
      const holdings = listArchivedPortfolioHoldings();
      const companyNames =
        deps.symbolSearchDeps != null
          ? await resolveCompanyNames(
              holdings.map((h) => h.symbol),
              deps.symbolSearchDeps
            )
          : {};
      const enriched = await Promise.all(
        holdings.map(async (h) => {
          const live = await resolveLivePrice(h, deps, false);
          return enrichHolding(h, live, companyNames[h.symbol]);
        })
      );
      res.json({ success: true, holdings: enriched });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  });

  app.patch("/api/portfolio/transactions/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ success: false, message: "Invalid id." });
      }
      const body = req.body as {
        tx_type?: string;
        shares?: number;
        price?: number;
        amount_usd?: number;
      };
      if (
        body.tx_type != null &&
        body.tx_type !== "buy" &&
        body.tx_type !== "sell"
      ) {
        return res.status(400).json({
          success: false,
          message: "tx_type must be buy or sell.",
        });
      }
      const existing = getPortfolioTransaction(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: "Not found." });
      }
      const updated = updatePortfolioTransaction(id, {
        tx_type: body.tx_type as "buy" | "sell" | undefined,
        shares: typeof body.shares === "number" ? body.shares : undefined,
        price: typeof body.price === "number" ? body.price : undefined,
        amount_usd:
          typeof body.amount_usd === "number" ? body.amount_usd : undefined,
      });
      if (!updated) {
        return res.status(404).json({ success: false, message: "Not found." });
      }
      const recompute = recomputeHoldingForSymbol(updated.symbol);
      const holding =
        recompute.id != null ? getPortfolioHolding(recompute.id) : null;
      const transactions = listTransactionsBySymbol(updated.symbol);
      res.json({
        success: true,
        transaction: updated,
        holding,
        recompute,
        transactions,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  });

  app.delete("/api/portfolio/transactions/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ success: false, message: "Invalid id." });
      }
      const existing = getPortfolioTransaction(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: "Not found." });
      }
      const sym = existing.symbol;
      deletePortfolioTransaction(id);
      const recompute = recomputeHoldingForSymbol(sym);
      const holding =
        recompute.id != null ? getPortfolioHolding(recompute.id) : null;
      res.json({
        success: true,
        symbol: sym,
        holding,
        recompute,
        transactions: listTransactionsBySymbol(sym),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  });

  app.get("/api/portfolio/holdings/:id/transactions", (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const holding = getPortfolioHolding(id);
      if (!holding) {
        return res.status(404).json({ success: false, message: "Not found." });
      }
      const transactions = listTransactionsBySymbol(holding.symbol);
      res.json({ success: true, symbol: holding.symbol, transactions });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  });

  app.get("/api/portfolio/duplicate-symbols", (_req, res) => {
    try {
      const symbols = findDuplicatePortfolioSymbols();
      res.json({ success: true, symbols, hasDuplicates: symbols.length > 0 });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  });

  app.post("/api/portfolio/import-statements", (req, res) => {
    try {
      const body = req.body as { transactions?: unknown[] };
      const raw = body.transactions ?? [];
      const transactions = raw
        .map((t) => t as Record<string, unknown>)
        .filter(
          (t) =>
            typeof t.symbol === "string" &&
            typeof t.tx_date === "string" &&
            (t.tx_type === "buy" || t.tx_type === "sell") &&
            typeof t.shares === "number" &&
            typeof t.price === "number" &&
            typeof t.amount_usd === "number"
        )
        .map((t) => ({
          symbol: String(t.symbol),
          tx_date: String(t.tx_date),
          tx_type: t.tx_type as "buy" | "sell",
          shares: Number(t.shares),
          price: Number(t.price),
          amount_usd: Number(t.amount_usd),
          source_line:
            typeof t.source_line === "number" ? t.source_line : undefined,
        }));

      if (transactions.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid transactions to import.",
        });
      }

      const result = importStatementTransactions(transactions);
      res.json({ success: true, ...result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  });

  app.post("/api/portfolio/consolidate-duplicates", (_req, res) => {
    try {
      const result = consolidateDuplicateHoldings();
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  });

  app.patch("/api/portfolio/settings", (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const settings = savePortfolioSettings({
        safe_target_pct:
          typeof body.safe_target_pct === "number"
            ? body.safe_target_pct
            : undefined,
        aggressive_target_pct:
          typeof body.aggressive_target_pct === "number"
            ? body.aggressive_target_pct
            : undefined,
        rebalance_drift_pct:
          typeof body.rebalance_drift_pct === "number"
            ? body.rebalance_drift_pct
            : undefined,
        last_rebalance_date:
          typeof body.last_rebalance_date === "string"
            ? body.last_rebalance_date
            : undefined,
        cash_buffer_usd:
          typeof body.cash_buffer_usd === "number"
            ? body.cash_buffer_usd
            : undefined,
        research_enabled:
          typeof body.research_enabled === "number"
            ? body.research_enabled
            : undefined,
        research_min_history_days:
          typeof body.research_min_history_days === "number"
            ? body.research_min_history_days
            : undefined,
        ollama_news_enabled:
          typeof body.ollama_news_enabled === "number"
            ? body.ollama_news_enabled
            : undefined,
      });
      res.json({ success: true, settings });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  });
}
