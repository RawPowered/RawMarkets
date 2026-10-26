import { extractNewsQueryTerms, resolveSymbolsFromUserText } from "./localAiNewsResolve";

const WEB_RESEARCH_INTENT =
  /\b(use the web|web research|research online|research on the web|browse the web|look up online|look this up|investigate online|search the web|google it|use google|find online|scrape|headless)\b/i;

export function shouldPreflightWebResearch(userText: string): boolean {
  return WEB_RESEARCH_INTENT.test(userText.trim());
}

export function extractWebResearchQuery(userText: string): string {
  const about = userText.match(
    /\b(?:research|investigate|look up|find out about)\s+(?:on\s+)?([a-z0-9][a-z0-9\s.&'-]{1,50})/i
  );
  if (about?.[1]) return about[1].trim();

  const newsQ = extractNewsQueryTerms(userText);
  if (newsQ) return newsQ;

  const symbols = resolveSymbolsFromUserText(userText);
  if (symbols.length === 1) return symbols[0];

  const stripped = userText
    .replace(
      /\b(use the web|web research|research online|please|can you|to)\b/gi,
      " "
    )
    .trim();
  if (stripped.length >= 3 && stripped.length <= 80) return stripped;

  return userText.trim().slice(0, 80);
}
