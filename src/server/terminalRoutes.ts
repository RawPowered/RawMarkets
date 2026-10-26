import type { Express, Request, Response } from "express";
import { loadCustomAssets } from "./db";
import { deleteAsset } from "./assetLifecycle";
import { EMBEDDED_CATALOG_PRESETS } from "./embeddedCatalog";
import {
  getDashboardLayout,
  saveDashboardLayout,
  type DashboardLayoutV1,
} from "./dashboardLayoutDb";
import { resolveSymbolLogo } from "./symbolLogo";
import {
  listHiddenSymbols,
  listPinnedSymbols,
  restoreAllHidden,
  setSymbolHidden,
  syncPinnedSymbols,
} from "./terminalSymbolPrefs";

export interface TerminalRouteDeps {
  reloadCustomAssets: () => void;
  getCustomAssets: () => Record<string, unknown>;
}

export function registerTerminalRoutes(
  app: Express,
  deps: TerminalRouteDeps
): void {
  app.get("/api/terminal/hidden", (_req: Request, res: Response) => {
    res.json({ success: true, symbols: listHiddenSymbols() });
  });

  app.get("/api/terminal/pinned", (_req: Request, res: Response) => {
    res.json({ success: true, symbols: listPinnedSymbols() });
  });

  app.post("/api/terminal/pinned/sync", (req: Request, res: Response) => {
    const symbols = Array.isArray(req.body?.symbols)
      ? (req.body.symbols as string[]).map((s) => String(s).toUpperCase())
      : [];
    const count = syncPinnedSymbols(symbols);
    res.json({ success: true, count, symbols: listPinnedSymbols() });
  });

  app.post("/api/terminal/hidden", (req: Request, res: Response) => {
    const symbol = String(req.body?.symbol ?? "").trim();
    if (!symbol) {
      return res.status(400).json({ success: false, message: "Symbol required" });
    }
    const hidden = req.body?.hidden !== false;
    setSymbolHidden(symbol, hidden);
    res.json({ success: true, symbol: symbol.toUpperCase(), hidden });
  });

  app.post("/api/terminal/hidden/restore-all", (_req: Request, res: Response) => {
    const count = restoreAllHidden();
    res.json({ success: true, restored: count });
  });

  function handleDeleteSymbol(req: Request, res: Response): void {
    const symbol = String(req.params.symbol ?? "").trim().toUpperCase();
    const force =
      req.query.force === "1" ||
      req.query.force === "true" ||
      req.body?.force === true;

    if (!symbol) {
      res.status(400).json({ success: false, message: "Symbol required" });
      return;
    }

    const result = deleteAsset(symbol, { force });
    if (result.blockedByPortfolio) {
      res.status(409).json({
        success: false,
        ...result,
      });
      return;
    }

    deps.reloadCustomAssets();
    res.json({ success: result.success, ...result });
  }

  app.delete("/api/terminal/symbols/:symbol", handleDeleteSymbol);
  app.delete("/api/assets/:symbol", handleDeleteSymbol);

  app.get("/api/symbol-logo/:symbol", (req: Request, res: Response) => {
    const symbol = String(req.params.symbol ?? "").trim();
    if (!symbol) {
      return res.status(400).json({ success: false, message: "Symbol required" });
    }
    const info = resolveSymbolLogo(symbol);
    res.json({ success: true, ...info });
  });

  app.get("/api/dashboard/layout", (_req: Request, res: Response) => {
    const pinned = listPinnedSymbols();
    const layout = getDashboardLayout(pinned);
    res.json({ success: true, layout, pinned });
  });

  app.put("/api/dashboard/layout", (req: Request, res: Response) => {
    const body = req.body as { layout?: DashboardLayoutV1 };
    if (!body?.layout || body.layout.version !== 1) {
      return res.status(400).json({ success: false, message: "Invalid layout" });
    }
    saveDashboardLayout(body.layout);
    const flat = body.layout.groups.flatMap((g) =>
      g.symbols.map((s) => String(s).toUpperCase())
    );
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const sym of flat) {
      if (seen.has(sym)) continue;
      seen.add(sym);
      ordered.push(sym);
    }
    syncPinnedSymbols(ordered);
    res.json({
      success: true,
      layout: getDashboardLayout(ordered),
      pinned: listPinnedSymbols(),
    });
  });

  app.get("/api/terminal/custom-symbols", (_req: Request, res: Response) => {
    const embedded = new Set(
      EMBEDDED_CATALOG_PRESETS.map((p) => p.key.toUpperCase())
    );
    const custom = Object.keys(loadCustomAssets())
      .map((s) => s.toUpperCase())
      .filter((s) => !embedded.has(s));
    res.json({ success: true, symbols: custom });
  });
}
