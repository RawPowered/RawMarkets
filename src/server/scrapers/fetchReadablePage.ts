import { withScrapeTab } from "./browserPool";

const DEFAULT_MAX_CHARS = 8000;

export interface ReadablePageResult {
  url: string;
  title: string;
  text: string;
  truncated: boolean;
}

export async function fetchReadablePage(
  url: string,
  maxChars = DEFAULT_MAX_CHARS
): Promise<ReadablePageResult> {
  return withScrapeTab(url, async (page) => {
    const extracted = await page.evaluate(() => {
      const title = document.title?.trim() ?? "";
      const article = document.querySelector("article");
      const main = document.querySelector("main");
      const root = article ?? main ?? document.body;
      const text = (root as HTMLElement).innerText?.trim() ?? "";
      return { title, text };
    });
    const limit = Math.max(500, maxChars);
    const truncated = extracted.text.length > limit;
    const text = truncated
      ? `${extracted.text.slice(0, limit - 1)}…`
      : extracted.text;
    return {
      url,
      title: extracted.title || url,
      text,
      truncated,
    };
  });
}
