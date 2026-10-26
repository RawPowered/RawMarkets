/**
 * Per-host polite throttling for outbound HTTP (RSS, etc.).
 */

interface HostState {
  inFlight: number;
  lastDoneAt: number;
}

const hostStates = new Map<string, HostState>();

function hostRules(hostname: string): { maxConcurrent: number; minGapMs: number } {
  const h = hostname.toLowerCase();
  if (h === "sec.gov" || h.endsWith(".sec.gov")) {
    return { maxConcurrent: 1, minGapMs: 500 };
  }
  return { maxConcurrent: 2, minGapMs: 300 };
}

function getHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "unknown";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function throttleForUrl<T>(url: string, fn: () => Promise<T>): Promise<T> {
  const host = getHost(url);
  const rules = hostRules(host);
  let state = hostStates.get(host);
  if (!state) {
    state = { inFlight: 0, lastDoneAt: 0 };
    hostStates.set(host, state);
  }

  while (state.inFlight >= rules.maxConcurrent) {
    await sleep(50);
  }

  const since = Date.now() - state.lastDoneAt;
  if (since < rules.minGapMs) {
    await sleep(rules.minGapMs - since);
  }

  state.inFlight += 1;
  try {
    return await fn();
  } finally {
    state.inFlight -= 1;
    state.lastDoneAt = Date.now();
  }
}

export async function runGlobalTaskPool(
  tasks: Array<() => Promise<void>>,
  globalWorkers: number
): Promise<void> {
  let index = 0;
  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const i = index++;
      await tasks[i]();
    }
  }
  const n = Math.min(globalWorkers, Math.max(1, tasks.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
}
