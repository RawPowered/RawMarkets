import type { Browser, BrowserContext, Page } from "playwright";

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let launchPromise: Promise<Browser> | null = null;
/** Serialize all Playwright work (one tab at a time) to avoid hung/blank scrapes. */
let scrapeChain: Promise<unknown> = Promise.resolve();

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function launchBrowser(): Promise<Browser> {
  const { chromium } = await import("playwright");
  return chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--no-sandbox",
    ],
  });
}

export async function getBrowser(): Promise<Browser> {
  if (browser?.isConnected()) return browser;
  if (!launchPromise) {
    launchPromise = launchBrowser()
      .then((b) => {
        browser = b;
        return b;
      })
      .catch((err) => {
        launchPromise = null;
        throw err;
      });
  }
  return launchPromise;
}

async function getContext(): Promise<BrowserContext> {
  const b = await getBrowser();
  if (!context) {
    context = await b.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1366, height: 900 },
      locale: "en-US",
      timezoneId: "America/New_York",
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
  }
  return context;
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = scrapeChain.then(fn, fn);
  scrapeChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** Dismiss common cookie/consent overlays so price DOM can render. */
export async function dismissConsent(page: Page): Promise<void> {
  const labels = [
    "Accept",
    "Accept All",
    "I Agree",
    "Agree",
    "OK",
    "Got it",
    "Allow all",
  ];
  for (const label of labels) {
    try {
      const btn = page.getByRole("button", { name: new RegExp(label, "i") }).first();
      if (await btn.isVisible({ timeout: 800 })) {
        await btn.click({ timeout: 2000 });
        await page.waitForTimeout(500);
        return;
      }
    } catch {
      /* try next */
    }
  }
}

/**
 * Open URL in a fresh tab, run extractor, close tab (user-suggested flow).
 */
export async function withScrapeTab<T>(
  url: string,
  fn: (page: Page) => Promise<T>
): Promise<T> {
  return enqueue(async () => {
    const ctx = await getContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(45_000);
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await dismissConsent(page);
      await page.waitForLoadState("networkidle", { timeout: 2_000 }).catch(() => {});
      await page.waitForTimeout(600);
      return await fn(page);
    } catch (err: unknown) {
      throw err;
    } finally {
      await page.close();
    }
  });
}

/** Legacy helper — still serialized, one tab per callback. */
export async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  return enqueue(async () => {
    const ctx = await getContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(45_000);
    try {
      return await fn(page);
    } finally {
      await page.close();
    }
  });
}

export async function closeBrowser(): Promise<void> {
  if (context) {
    await context.close().catch(() => {});
    context = null;
  }
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
  launchPromise = null;
  scrapeChain = Promise.resolve();
}

export function isBrowserAvailable(): boolean {
  return browser?.isConnected() ?? false;
}
