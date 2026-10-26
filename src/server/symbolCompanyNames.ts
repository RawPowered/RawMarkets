import type { SymbolSearchDeps } from "./symbolSearch";
import { searchSymbols } from "./symbolSearch";

export async function resolveCompanyNames(
  symbols: string[],
  deps: SymbolSearchDeps
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  await Promise.all(
    unique.map(async (sym) => {
      try {
        const result = await searchSymbols({ q: sym, mode: "symbol" }, deps);
        const hit =
          result.matches.find((m) => m.symbol.toUpperCase() === sym) ??
          result.matches[0];
        if (hit?.name?.trim()) out[sym] = hit.name.trim();
      } catch {
        /* optional enrichment */
      }
    })
  );
  return out;
}
