import type { EngineSettings } from "./db";
import { resolvedWealthBibleRuleIds } from "./db";
import {
  getWealthBibleRuleById,
  type WealthBibleRule,
} from "../lib/wealthBibleRules";

const DEFAULT_MAX_CHARS = 8000;

export function resolveEnabledWealthBibleRules(
  settings: EngineSettings
): WealthBibleRule[] {
  const ids = resolvedWealthBibleRuleIds(settings);
  const rules: WealthBibleRule[] = [];
  for (const id of ids) {
    const rule = getWealthBibleRuleById(id);
    if (rule) rules.push(rule);
  }
  return rules.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

function formatRuleLine(rule: WealthBibleRule, index: number): string {
  const bullets =
    rule.bullets && rule.bullets.length > 0
      ? ` (${rule.bullets.join("; ")})`
      : "";
  return `${index}. [${rule.id}] ${rule.title} — ${rule.body}${bullets}`;
}

export function buildWealthBibleRuleSpacePrompt(
  settings: EngineSettings,
  options?: { maxChars?: number }
): string {
  if (!settings.aiWealthBibleEnabled) return "";

  const maxChars = options?.maxChars ?? DEFAULT_MAX_CHARS;
  const enabled = resolveEnabledWealthBibleRules(settings);
  if (enabled.length === 0) return "";

  const header = `## First principles — Bible of Wealth (Rule Space)
You MUST align answers with these enabled principles. They override general market hype and speculative narratives when in conflict.
When a user trade idea conflicts with these principles, state the conflict explicitly and favor survival, sizing discipline, and core protection.`;

  const lines: string[] = [header];
  let omitted = 0;

  for (let i = 0; i < enabled.length; i++) {
    const candidate = [...lines, formatRuleLine(enabled[i], i + 1)].join("\n");
    if (candidate.length > maxChars) {
      omitted = enabled.length - i;
      break;
    }
    lines.push(formatRuleLine(enabled[i], i + 1));
  }

  if (omitted > 0) {
    lines.push(`(${omitted} lower-priority rules omitted for length)`);
  }

  return lines.join("\n");
}

export function countActiveWealthBibleRules(settings: EngineSettings): number {
  if (!settings.aiWealthBibleEnabled) return 0;
  return resolveEnabledWealthBibleRules(settings).length;
}
