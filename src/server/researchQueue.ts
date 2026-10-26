import type { ResearchJobDeps, ResearchJobInput } from "./portfolioResearchJob";
import { runPortfolioResearchJob } from "./portfolioResearchJob";
import { getEngineMeta, setEngineMeta } from "./portfolioResearchDb";

export type ResearchJobStatus = "idle" | "running" | "ready" | "error";

export interface ResearchStatusPayload {
  status: ResearchJobStatus;
  startedAt: number | null;
  evaluatedAt: number | null;
  engine: string | null;
  error: string | null;
}

let running = false;
let pendingJob: { input: ResearchJobInput; deps: ResearchJobDeps } | null = null;

function readMeta(key: string): string | null {
  return getEngineMeta(key);
}

function writeStatus(partial: Partial<ResearchStatusPayload>): void {
  if (partial.status !== undefined) {
    setEngineMeta("research_job_status", partial.status);
  }
  if (partial.startedAt !== undefined && partial.startedAt != null) {
    setEngineMeta("research_job_started_at", String(partial.startedAt));
  }
  if (partial.evaluatedAt !== undefined && partial.evaluatedAt != null) {
    setEngineMeta("research_job_evaluated_at", String(partial.evaluatedAt));
  }
  if (partial.engine !== undefined && partial.engine != null) {
    setEngineMeta("research_job_engine", partial.engine);
  }
  if (partial.error !== undefined) {
    setEngineMeta("research_job_error", partial.error ?? "");
  }
}

export function getResearchStatus(): ResearchStatusPayload {
  const status = (readMeta("research_job_status") ?? "idle") as ResearchJobStatus;
  const startedRaw = readMeta("research_job_started_at");
  const evalRaw = readMeta("research_job_evaluated_at");
  const error = readMeta("research_job_error");
  return {
    status: running ? "running" : status,
    startedAt: startedRaw ? parseInt(startedRaw, 10) : null,
    evaluatedAt: evalRaw ? parseInt(evalRaw, 10) : null,
    engine: readMeta("research_job_engine"),
    error: error || null,
  };
}

export function isResearchRunning(): boolean {
  return running;
}

async function executeJob(
  input: ResearchJobInput,
  deps: ResearchJobDeps
): Promise<void> {
  running = true;
  const startedAt = Date.now();
  writeStatus({ status: "running", startedAt, error: null });

  try {
    const result = await runPortfolioResearchJob(input, deps);
    writeStatus({
      status: "ready",
      evaluatedAt: result.evaluatedAt ?? startedAt,
      engine: result.meta.engine,
      error: null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    writeStatus({ status: "error", error: msg });
    console.warn("[Research] Job failed:", msg);
  } finally {
    running = false;
    if (pendingJob) {
      const next = pendingJob;
      pendingJob = null;
      void executeJob(next.input, next.deps);
    }
  }
}

export function enqueueResearch(
  input: ResearchJobInput,
  deps: ResearchJobDeps
): ResearchStatusPayload {
  if (running) {
    pendingJob = { input, deps };
    return getResearchStatus();
  }
  void executeJob(input, deps);
  return getResearchStatus();
}

export function shouldAutoEnqueueResearch(
  lastResearchAt: number | null,
  forceResearch: boolean
): boolean {
  if (forceResearch) return true;
  if (lastResearchAt == null) return true;
  const ageMs = Date.now() - lastResearchAt;
  return ageMs > 24 * 60 * 60 * 1000;
}
