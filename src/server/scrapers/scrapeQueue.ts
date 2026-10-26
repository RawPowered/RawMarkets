import type { ScrapeResult } from "./types";

export type ScrapePhase = "queued" | "start" | "ok" | "fail";

export interface ScrapeActivityEvent {
  id: string;
  at: number;
  provider: string;
  symbol: string;
  url: string;
  phase: ScrapePhase;
  price?: number;
  error?: string;
  elapsedMs?: number;
}

interface QueuedJob<T> {
  id: string;
  provider: string;
  symbol: string;
  url: string;
  priority: number;
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

const MAX_EVENTS = 50;
const events: ScrapeActivityEvent[] = [];
let current: ScrapeActivityEvent | null = null;
const highPriority: QueuedJob<unknown>[] = [];
const normalPriority: QueuedJob<unknown>[] = [];
let drainScheduled = false;
let processing = false;

function eventCount(): number {
  return highPriority.length + normalPriority.length + (processing ? 1 : 0);
}

function pushEvent(ev: ScrapeActivityEvent): void {
  events.push(ev);
  while (events.length > MAX_EVENTS) events.shift();
}

export function getScrapeActivity(): {
  current: ScrapeActivityEvent | null;
  recent: ScrapeActivityEvent[];
  queueDepth: number;
} {
  return {
    current,
    recent: [...events],
    queueDepth: eventCount(),
  };
}

export function formatActivityLine(ev: ScrapeActivityEvent): string {
  if (ev.phase === "start" || ev.phase === "queued") {
    const shortUrl =
      ev.url.length > 48 ? `${ev.url.slice(0, 45)}…` : ev.url;
    return `${ev.provider} → ${ev.symbol} → ${shortUrl}`;
  }
  if (ev.phase === "ok" && ev.price != null) {
    const sec = ((ev.elapsedMs ?? 0) / 1000).toFixed(1);
    return `${ev.provider}: ${ev.symbol} $${ev.price.toFixed(2)} (${sec}s)`;
  }
  return `${ev.provider}: ${ev.symbol} failed — ${ev.error ?? "unknown"}`;
}

export function activityToScrapeLog(recent: ScrapeActivityEvent[]): string[] {
  return recent
    .filter((e) => e.phase === "ok" || e.phase === "fail" || e.phase === "start")
    .map(formatActivityLine);
}

function scheduleDrain(): void {
  if (drainScheduled) return;
  drainScheduled = true;
  void Promise.resolve().then(() => {
    drainScheduled = false;
    void drainOne();
  });
}

async function drainOne(): Promise<void> {
  if (processing) return;
  const job = (highPriority.shift() ?? normalPriority.shift()) as
    | QueuedJob<unknown>
    | undefined;
  if (!job) return;

  processing = true;
  const started = Date.now();
  const startEv: ScrapeActivityEvent = {
    id: job.id,
    at: started,
    provider: job.provider,
    symbol: job.symbol,
    url: job.url,
    phase: "start",
  };
  current = startEv;
  pushEvent(startEv);

  try {
    const result = await job.run();
    const elapsedMs = Date.now() - started;
    const scrape = result as ScrapeResult | undefined;
    const price =
      scrape && typeof scrape.price === "number" ? scrape.price : undefined;
    const ok = scrape?.ok !== false;
    const doneEv: ScrapeActivityEvent = {
      id: job.id,
      at: Date.now(),
      provider: job.provider,
      symbol: job.symbol,
      url: job.url,
      phase: ok && (price != null || scrape?.ok === true) ? "ok" : "fail",
      price,
      error: scrape?.error,
      elapsedMs,
    };
    if (scrape && scrape.ok === false) {
      doneEv.phase = "fail";
      doneEv.error = scrape.error ?? "capture failed";
    }
    pushEvent(doneEv);
    job.resolve(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    pushEvent({
      id: job.id,
      at: Date.now(),
      provider: job.provider,
      symbol: job.symbol,
      url: job.url,
      phase: "fail",
      error: msg,
      elapsedMs: Date.now() - started,
    });
    job.reject(err);
  } finally {
    current = null;
    processing = false;
    scheduleDrain();
  }
}

/** Serialize capture jobs; higher priority runs next. */
export function runTrackedScrape<T>(
  opts: {
    provider: string;
    symbol: string;
    url: string;
    priority?: number;
  },
  fn: () => Promise<T>
): Promise<T> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return new Promise<T>((resolve, reject) => {
    const job: QueuedJob<T> = {
      id,
      provider: opts.provider,
      symbol: opts.symbol,
      url: opts.url,
      priority: opts.priority ?? 0,
      run: fn,
      resolve,
      reject,
    };

    if (job.priority > 0) {
      highPriority.push(job as QueuedJob<unknown>);
    } else {
      normalPriority.push(job as QueuedJob<unknown>);
    }
    scheduleDrain();
  });
}

export function clearScrapeActivity(): void {
  events.length = 0;
  current = null;
}

/** Log a completed HTTP/API capture without queueing (API calls are fast). */
export function recordInstantScrapeActivity(opts: {
  provider: string;
  symbol: string;
  url: string;
  ok: boolean;
  price?: number;
  error?: string;
  elapsedMs?: number;
}): void {
  const id = `${Date.now()}-instant`;
  pushEvent({
    id,
    at: Date.now(),
    provider: opts.provider,
    symbol: opts.symbol,
    url: opts.url,
    phase: opts.ok ? "ok" : "fail",
    price: opts.price,
    error: opts.error,
    elapsedMs: opts.elapsedMs,
  });
}
