import { resolveFocusSymbols } from "./localAiContext";
import {
  executeLocalAiTool,
  freshToolBudget,
  type ToolBudget,
} from "./localAiTools";
import {
  extractNewsQueryTerms,
  resolveSymbolsFromUserText,
  shouldPreflightNewsSearch,
} from "./localAiNewsResolve";
import type { PlatformLocation } from "../types";

export {
  shouldPreflightNewsSearch,
  resolveSymbolsFromUserText,
  extractNewsQueryTerms,
} from "./localAiNewsResolve";

export interface PreflightResult {
  toolContent: string;
  symbols: string[];
}

/** Run search_platform_news before the model when the user clearly wants news. */
export async function runPreflightNewsSearch(
  userText: string,
  context: PlatformLocation,
  budget?: ToolBudget
): Promise<PreflightResult | null> {
  if (!shouldPreflightNewsSearch(userText)) return null;

  const fromText = resolveSymbolsFromUserText(userText);
  const fromFocus = resolveFocusSymbols(context);
  const symbols = [...new Set([...fromText, ...fromFocus])];
  const query = extractNewsQueryTerms(userText);

  const b = budget ?? freshToolBudget();
  const exec = await executeLocalAiTool(
    "search_platform_news",
    JSON.stringify({
      symbols: symbols.length > 0 ? symbols : undefined,
      query: query || undefined,
      limit: 20,
    }),
    context,
    b,
    { lastUserMessage: userText }
  );

  return { toolContent: exec.content, symbols };
}
