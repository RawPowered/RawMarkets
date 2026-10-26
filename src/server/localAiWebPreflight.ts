import {
  executeLocalAiTool,
  freshToolBudget,
  type ToolBudget,
} from "./localAiTools";
import {
  extractWebResearchQuery,
  shouldPreflightWebResearch,
} from "./localAiWebIntent";
import type { PlatformLocation } from "../types";

export {
  shouldPreflightWebResearch,
  extractWebResearchQuery,
} from "./localAiWebIntent";

export interface WebPreflightResult {
  toolContent: string;
  query: string;
}

export async function runPreflightWebResearch(
  userText: string,
  context: PlatformLocation,
  budget?: ToolBudget
): Promise<WebPreflightResult | null> {
  if (!shouldPreflightWebResearch(userText)) return null;

  const query = extractWebResearchQuery(userText);
  const b = budget ?? freshToolBudget();
  const exec = await executeLocalAiTool(
    "web_research",
    JSON.stringify({ query, fetchPages: 2 }),
    context,
    b,
    { lastUserMessage: userText }
  );

  return { toolContent: exec.content, query };
}
