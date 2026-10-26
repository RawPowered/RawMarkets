const CORPORATE_SUFFIX_RE =
  /\b(incorporated|inc|corporation|corp|company|co|plc|ltd|limited|holdings|holding|group|class|common|stock|adr|ads|sa|nv|ag|se|lp|llc)\b\.?/gi;

const GENERIC_COMPANY_WORDS = new Set([
  "the",
  "and",
  "company",
  "group",
  "holdings",
  "holding",
  "corporation",
  "corp",
  "inc",
  "plc",
  "ltd",
  "limited",
  "common",
  "stock",
  "class",
]);

const AMBIGUOUS_SYMBOLS = new Set([
  "A",
  "AI",
  "ALL",
  "ARE",
  "BE",
  "BY",
  "CAN",
  "CAT",
  "DD",
  "FOR",
  "GO",
  "HAS",
  "HE",
  "I",
  "IT",
  "LIFE",
  "LOVE",
  "NOW",
  "ON",
  "OR",
  "OUT",
  "REAL",
  "SEE",
  "SO",
  "U",
  "VERY",
  "X",
]);

export function matchesSymbolInText(
  text: string,
  symbol: string,
  companyName?: string | null
): boolean {
  return classifySymbolRelevance(text, symbol, companyName).matched;
}

export interface SymbolRelevance {
  matched: boolean;
  confidence: "none" | "low" | "medium" | "high";
  reasons: string[];
}

export function classifySymbolRelevance(
  text: string,
  symbol: string,
  companyName?: string | null
): SymbolRelevance {
  const sym = symbol.trim().toUpperCase();
  if (!sym) return { matched: false, confidence: "none", reasons: [] };

  const reasons: string[] = [];
  const aliases = companyAliases(companyName);
  const lower = normalizeText(text);
  for (const alias of aliases) {
    if (lower.includes(alias)) {
      reasons.push(`company:${alias}`);
      return { matched: true, confidence: "high", reasons };
    }
  }

  if (hasCashtag(text, sym)) {
    return { matched: true, confidence: "high", reasons: ["cashtag"] };
  }

  if (hasExchangeQualifiedSymbol(text, sym) || hasParentheticalSymbol(text, sym)) {
    return { matched: true, confidence: "high", reasons: ["qualified_ticker"] };
  }

  const ambiguous = isAmbiguousSymbol(sym);
  if (hasTickerContext(text, sym)) {
    return {
      matched: true,
      confidence: ambiguous ? "medium" : "high",
      reasons: ["ticker_context"],
    };
  }

  if (!ambiguous && hasBareTicker(text, sym)) {
    return { matched: true, confidence: "medium", reasons: ["bare_ticker"] };
  }

  return { matched: false, confidence: "none", reasons };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function companyAliases(companyName?: string | null): string[] {
  if (!companyName?.trim()) return [];
  const normalized = normalizeText(
    companyName.replace(/\([^)]*\)/g, " ").replace(CORPORATE_SUFFIX_RE, " ")
  );
  const parts = normalized
    .split(/\s+/)
    .filter((p) => p.length >= 2 && !GENERIC_COMPANY_WORDS.has(p));
  const aliases = new Set<string>();
  if (normalized.length >= 4) aliases.add(normalized);
  if (parts.length >= 2) aliases.add(parts.slice(0, 2).join(" "));
  if (parts.length >= 3) aliases.add(parts.slice(0, 3).join(" "));
  const first = parts[0];
  if (first && first.length >= 5 && !GENERIC_COMPANY_WORDS.has(first)) {
    aliases.add(first);
  }
  return [...aliases].filter((a) => a.length >= 4);
}

function isAmbiguousSymbol(symbol: string): boolean {
  return symbol.length <= 2 || AMBIGUOUS_SYMBOLS.has(symbol);
}

function hasCashtag(text: string, symbol: string): boolean {
  return new RegExp(`(^|[^A-Za-z0-9_])\\$${escapeRegex(symbol)}\\b`, "i").test(text);
}

function hasExchangeQualifiedSymbol(text: string, symbol: string): boolean {
  return new RegExp(
    `\\b(NASDAQ|NYSE|AMEX|ARCA|OTC|CBOE|TSX|LSE)\\s*[:\\-]\\s*${escapeRegex(symbol)}\\b`,
    "i"
  ).test(text);
}

function hasParentheticalSymbol(text: string, symbol: string): boolean {
  return new RegExp(`\\(${escapeRegex(symbol)}\\)`).test(text);
}

function hasTickerContext(text: string, symbol: string): boolean {
  const sym = escapeRegex(symbol);
  return new RegExp(
    `\\b${sym}(?:['\u2019]s|s)?\\b\\s+(stock|shares|earnings|guidance|revenue|eps|filing|dividend|buyback|analyst|rating|price|target|options|calls|puts)\\b|\\b(stock|shares|earnings|guidance|revenue|eps|filing|dividend|buyback|analyst|rating|price|target|options|calls|puts)\\s+(?:for|on|in)?\\s*\\b${sym}\\b`,
    "i"
  ).test(text);
}

function hasBareTicker(text: string, symbol: string): boolean {
  return new RegExp(`\\b${escapeRegex(symbol)}(?:['\u2019]s|s)?\\b`).test(text);
}
