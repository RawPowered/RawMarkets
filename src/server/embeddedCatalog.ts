import type { Asset } from "../types";
import { getRemovedCatalogSymbols, isCatalogSymbolRemoved } from "./catalogRemovals";
import { getDb, setCustomAsset } from "./db";

export interface CatalogPreset {
  key: string;
  name: string;
  symbol: string;
  unit: string;
  current: number;
  category: Asset["category"];
  desc: string;
  changePercent?: string;
}

/** Factory catalog metadata — seeded once into SQLite; no mock history. */
export const EMBEDDED_CATALOG_PRESETS: CatalogPreset[] = [
  { key: "GOLD", symbol: "GOLD", name: "Gold Spot", unit: "USD per Troy Ounce", current: 4567, category: "METALS", desc: "Prime safe-haven commodity and ultimate economic hedge signal." },
  { key: "SILVER", symbol: "SILVER", name: "Silver Spot", unit: "USD per Troy Ounce", current: 77.73, category: "METALS", desc: "Dual asset: precious monetary metal and vital industrial conductor." },
  { key: "COPPER", symbol: "COPPER", name: "Copper Spot", unit: "USD per Lb", current: 4.82, category: "METALS", desc: "Doctor Copper: key economic industrial health tracker." },
  { key: "OIL", symbol: "OIL", name: "WTI Crude Oil", unit: "USD per Barrel", current: 76.85, category: "ENERGY", desc: "West Texas Intermediate (WTI) sweet light crude oil spot price benchmark." },
  { key: "BRENT", symbol: "BRENT", name: "Brent Crude Oil", unit: "USD per Barrel", current: 81.15, category: "ENERGY", desc: "Brent crude oil reference grade for direct oil export pricing throughout Europe and Asia." },
  { key: "CVX", symbol: "CVX", name: "Chevron Corporation", unit: "USD per Share", current: 154.2, category: "ENERGY", desc: "Major integrated energy petroleum giant tracking global operations and refinement." },
  { key: "XOM", symbol: "XOM", name: "Exxon Mobil Corporation", unit: "USD per Share", current: 114.5, category: "ENERGY", desc: "Global energy and chemical corporation tracking petroleum extraction and refining." },
  { key: "BP", symbol: "BP", name: "BP p.l.c.", unit: "USD per Share", current: 34.8, category: "ENERGY", desc: "British multinational oil and gas company focused on energy transition." },
  { key: "SHEL", symbol: "SHEL", name: "Shell plc", unit: "USD per Share", current: 66.0, category: "ENERGY", desc: "Leading international gas developer and liquified natural gas (LNG) carrier." },
  { key: "NVDA", symbol: "NVDA", name: "NVIDIA Corporation", unit: "USD per Share", current: 940.2, category: "TECH", desc: "Pioneer of GPU-accelerated computing, AI chip enterprise hardware standard." },
  { key: "GOOGL", symbol: "GOOGL", name: "Alphabet Inc.", unit: "USD per Share", current: 175.5, category: "TECH", desc: "Global technology leader in AI search engines, Gemini developer, and cloud compute engines." },
  { key: "META", symbol: "META", name: "Meta Platforms, Inc.", unit: "USD per Share", current: 475.25, category: "TECH", desc: "Social hardware and media infrastructure leader training LLaMA open-weight foundational layers." },
  { key: "TSLA", symbol: "TSLA", name: "Tesla, Inc.", unit: "USD per Share", current: 426.01, category: "TECH", desc: "Electric autonomous vehicle standard and humanoid robotics AI computation pioneer." },
  { key: "SMSN", symbol: "SMSN", name: "Samsung Electronics Co.", unit: "USD per GDR", current: 1420, category: "TECH", desc: "South Korean memory wafer fabrication leader, critical global consumer hardware producer." },
  { key: "OPENAI", symbol: "OPENAI", name: "OpenAI Private Valuation Proxy", unit: "Index Points", current: 860, category: "TECH", desc: "Tracking private capital valuations for GPT-series AI infrastructure." },
  { key: "XAI", symbol: "XAI", name: "xAI Private Valuation Proxy", unit: "Index Points", current: 240, category: "TECH", desc: "Secondary-market proxy for Grok / Memphis compute expansion." },
  { key: "ANTHROPIC", symbol: "ANTHROPIC", name: "Anthropic Private Valuation Proxy", unit: "Index Points", current: 185, category: "TECH", desc: "Private index benchmark measuring enterprise integration rates for Claude LLM series." },
  { key: "NTDOY", symbol: "NTDOY", name: "Nintendo Co., Ltd.", unit: "USD per Share", current: 13.95, category: "TECH", desc: "Consolidated developer backing Pokemon intellectual property and console sales." },
  { key: "DIS", symbol: "DIS", name: "The Walt Disney Company", unit: "USD per Share", current: 102.4, category: "MARKETS", desc: "Global media empire providing benchmarks for merchandise licensing power." },
  { key: "HAS", symbol: "HAS", name: "Hasbro, Inc.", unit: "USD per Share", current: 58.75, category: "MARKETS", desc: "Toy and collectible manufacturer, core printer of gaming card indices." },
  { key: "TCG-POKE", symbol: "TCG-POKE", name: "Pokémon Vintage Card Index", unit: "Index Points", current: 1248.1, category: "MARKETS", desc: "Aggregate market weighting of core base set booster packs and high-grade PSA cards." },
  { key: "JPM", symbol: "JPM", name: "JPMorgan Chase & Co.", unit: "USD per Share", current: 198.5, category: "FINANCE", desc: "Largest US bank and global systemic financial services provider." },
  { key: "GS", symbol: "GS", name: "The Goldman Sachs Group", unit: "USD per Share", current: 415.2, category: "FINANCE", desc: "Premier global investment banking and securities powerhouse." },
  { key: "X", symbol: "X", name: "United States Steel Corp.", unit: "USD per Share", current: 38.6, category: "METALS", desc: "Historic integrated steel producer powering industrial development." },
  { key: "NUE", symbol: "NUE", name: "Nucor Corporation", unit: "USD per Share", current: 174.2, category: "METALS", desc: "Largest eco-friendly electric arc furnace steel manufacturer." },
  { key: "SONY", symbol: "SONY", name: "Sony Group Corp ADR", unit: "USD per Share", current: 82.5, category: "TECH", desc: "PlayStation, entertainment, and image sensor conglomerate." },
  { key: "MSFT", symbol: "MSFT", name: "Microsoft Corporation", unit: "USD per Share", current: 425.6, category: "TECH", desc: "Global software and cloud Azure infrastructure leader." },
  { key: "SPACEX", symbol: "SPACEX", name: "SpaceX Private Proxy", unit: "Index Points", current: 155, category: "TECH", desc: "Private aerospace leader tracking Falcon and Starlink coverage." },
  { key: "AAPL", symbol: "AAPL", name: "Apple Inc.", unit: "USD per Share", current: 182.4, category: "TECH", desc: "Sovereign global consumer tech developer and premium hardware ecosystem." },
  { key: "AMZN", symbol: "AMZN", name: "Amazon.com, Inc.", unit: "USD per Share", current: 178.5, category: "MARKETS", desc: "Global e-commerce marketplace and AWS cloud leader." },
  { key: "AMD", symbol: "AMD", name: "Advanced Micro Devices", unit: "USD per Share", current: 165.2, category: "TECH", desc: "High-performance compute processor designer." },
  { key: "INTC", symbol: "INTC", name: "Intel Corporation", unit: "USD per Share", current: 32.1, category: "TECH", desc: "Traditional semiconductor fabrication developer." },
  { key: "NFLX", symbol: "NFLX", name: "Netflix, Inc.", unit: "USD per Share", current: 610.8, category: "MARKETS", desc: "Leading global streaming entertainment platform." },
  { key: "BTC", symbol: "BTC", name: "Bitcoin Core Index", unit: "USD", current: 67200, category: "MARKETS", desc: "Decentralized peer-to-peer monetary network." },
  { key: "ETH", symbol: "ETH", name: "Ethereum Spot Index", unit: "USD", current: 3500, category: "TECH", desc: "Smart contract programmable ledger." },
  { key: "GLD", symbol: "GLD", name: "SPDR Gold Shares", unit: "USD per Share", current: 224.5, category: "METALS", desc: "Physical gold vault bullion backed ETF." },
  { key: "SLV", symbol: "SLV", name: "iShares Silver Trust", unit: "USD per Share", current: 28.15, category: "METALS", desc: "Physical silver bullion backed trust." },
  { key: "PLTR", symbol: "PLTR", name: "Palantir Technologies", unit: "USD per Share", current: 21.4, category: "TECH", desc: "Foundational data integration and AI defense analytics." },
  { key: "ASML", symbol: "ASML", name: "ASML Holding N.V.", unit: "USD per Share", current: 895, category: "TECH", desc: "EUV photolithography scanner manufacturer." },
  { key: "ARM", symbol: "ARM", name: "Arm Holdings plc", unit: "USD per Share", current: 115.5, category: "TECH", desc: "RISC architecture standard for mobile and AI processors." },
  { key: "COAL", symbol: "COAL", name: "Newcastle Coal Futures", unit: "USD", current: 136.5, category: "ENERGY", desc: "Physical dark energy coal commodities benchmark." },
  { key: "GAS", symbol: "GAS", name: "Henry Hub Natural Gas", unit: "USD", current: 2.85, category: "ENERGY", desc: "Natural gas pipeline seasonal grid indicator." },
];

export function presetToAssetMetadata(preset: CatalogPreset): Asset {
  const changePercent = preset.changePercent ?? "+0.00%";
  const pctNum = parseFloat(changePercent.replace("%", "")) || 0;
  const change = parseFloat((preset.current * (pctNum / 100)).toFixed(2));
  return {
    name: preset.name,
    symbol: preset.symbol,
    unit: preset.unit,
    current: preset.current,
    open: preset.current,
    high: preset.current,
    low: preset.current,
    volume: 0,
    change,
    changePercent,
    history: [],
    category: preset.category,
    desc: preset.desc,
    priceSource: "unavailable",
  };
}

export function getCustomAssetCount(): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) as c FROM custom_assets")
    .get() as { c: number };
  return row.c;
}

export function applyCatalogBaseline(): number {
  const database = getDb();
  const applied = database
    .prepare("SELECT value FROM engine_meta WHERE key = ?")
    .get("catalog_baseline_version") as { value: string } | undefined;
  if (applied?.value === "1") return 0;

  const insert = database.prepare(
    "INSERT OR IGNORE INTO custom_assets (symbol, payload) VALUES (?, ?)"
  );
  let n = 0;
  const tx = database.transaction(() => {
    for (const preset of EMBEDDED_CATALOG_PRESETS) {
      const key = preset.key.toUpperCase();
      if (isCatalogSymbolRemoved(key)) continue;
      const asset = presetToAssetMetadata(preset);
      const r = insert.run(key, JSON.stringify(asset));
      if (r.changes > 0) n++;
    }
    database
      .prepare("INSERT OR REPLACE INTO engine_meta (key, value) VALUES (?, ?)")
      .run("catalog_baseline_version", "1");
  });
  tx();
  if (n > 0) {
    console.log(`[DB] Catalog baseline: inserted ${n} factory instruments.`);
  }
  return n;
}

export function restoreMissingBaselinePresets(options?: {
  includeRemoved?: boolean;
}): number {
  const existing = new Set(
    (
      getDb()
        .prepare("SELECT symbol FROM custom_assets")
        .all() as { symbol: string }[]
    ).map((r) => r.symbol.toUpperCase())
  );
  const removed = options?.includeRemoved
    ? new Set<string>()
    : getRemovedCatalogSymbols();
  let added = 0;
  for (const preset of EMBEDDED_CATALOG_PRESETS) {
    const key = preset.key.toUpperCase();
    if (existing.has(key) || removed.has(key)) continue;
    setCustomAsset(key, presetToAssetMetadata(preset));
    added++;
  }
  if (added > 0) {
    console.log(`[DB] Restored ${added} missing baseline instruments.`);
  }
  return added;
}

export function purgeSimulationArtifacts(): void {
  const database = getDb();
  const applied = database
    .prepare("SELECT value FROM engine_meta WHERE key = ?")
    .get("purge_simulation_v1") as { value: string } | undefined;
  if (applied) return;

  const rows = database
    .prepare("SELECT symbol, payload FROM custom_assets")
    .all() as { symbol: string; payload: string }[];

  const update = database.prepare(
    "UPDATE custom_assets SET payload = ? WHERE symbol = ?"
  );
  const tx = database.transaction(() => {
    for (const row of rows) {
      try {
        const asset = JSON.parse(row.payload) as Asset & { history?: unknown[] };
        if (Array.isArray(asset.history) && asset.history.length > 0) {
          asset.history = [];
          if ((asset.priceSource as string) === "simulated") {
            asset.priceSource = "unavailable";
          }
          update.run(JSON.stringify(asset), row.symbol);
        }
      } catch {
        /* skip corrupt payload */
      }
    }
    database.prepare("DELETE FROM api_cache WHERE cache_key LIKE ?").run("serp_news_%");
    database
      .prepare("INSERT OR REPLACE INTO engine_meta (key, value) VALUES (?, ?)")
      .run("purge_simulation_v1", String(Date.now()));
  });
  tx();
  console.log("[DB] Purged mock history from custom_assets and simulated news cache.");
}
