import { spawn, spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const TIMEOUT_MS = 30_000;

export interface PythonResearchPayload {
  holdings: Array<{
    holding_id: number;
    symbol: string;
    prices: number[];
    market_value: number;
    target_pct?: number | null;
    day_change_pct?: number | null;
    signal_codes?: string[];
  }>;
  portfolio_total: number;
  benchmark_prices?: number[];
  news_by_symbol?: Record<
    string,
    Array<{
      sentiment?: number | null;
      confidence?: number | null;
      novelty?: number | null;
    }>
  >;
  portfolio_signals?: Array<{ code: string; detail?: string }>;
  evaluated_at: number;
}

export interface PythonResearchResult {
  ok: boolean;
  engine?: string;
  evaluated_at?: number;
  holdings?: Array<{
    holding_id: number;
    symbol: string;
    factors: Record<string, number | null>;
    forecast: Record<string, unknown>;
    action: Record<string, unknown>;
  }>;
  portfolio_actions?: Array<Record<string, unknown>>;
  error?: string;
}

function resolvePythonCommand(root: string): { cmd: string; args: string[] } {
  const venvWin = path.join(root, "python", ".venv", "Scripts", "python.exe");
  const venvUnix = path.join(root, "python", ".venv", "bin", "python");
  const cli = path.join(root, "python", "research_cli.py");

  if (process.platform === "win32" && fs.existsSync(venvWin)) {
    return { cmd: venvWin, args: [cli] };
  }
  if (fs.existsSync(venvUnix)) {
    return { cmd: venvUnix, args: [cli] };
  }
  if (process.platform === "win32") {
    return { cmd: "py", args: ["-3", cli] };
  }
  return { cmd: "python3", args: [cli] };
}

export function isPythonAvailable(root = process.cwd()): boolean {
  const { cmd, args } = resolvePythonCommand(root);
  try {
    const r = spawnSync(cmd, [...args.slice(0, -1), "--version"], {
      encoding: "utf8",
      timeout: 5000,
      shell: process.platform === "win32",
    });
    return r.status === 0 || (r.stdout ?? "").includes("Python");
  } catch {
    return false;
  }
}

export async function runPythonResearch(
  payload: PythonResearchPayload,
  root = process.cwd()
): Promise<PythonResearchResult> {
  const { cmd, args } = resolvePythonCommand(root);

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const child = spawn(cmd, args, {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill("SIGTERM");
        resolve({ ok: false, error: "Python research timed out after 30s" });
      }
    }, TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, error: err.message });
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        const parsed = JSON.parse(stdout || "{}") as PythonResearchResult;
        if (!parsed.ok && stderr) {
          parsed.error = parsed.error ?? stderr.trim();
        }
        resolve(parsed);
      } catch {
        resolve({
          ok: false,
          error:
            stderr.trim() ||
            stdout.trim() ||
            `Python exited with code ${code ?? "unknown"}`,
        });
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}
