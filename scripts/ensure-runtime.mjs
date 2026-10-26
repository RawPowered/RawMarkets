/**
 * First-run / repair: npm deps + Playwright Chromium + Python research venv.
 * Used by Launch RawMarkets.bat before the desktop launcher starts.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OLLAMA_MODEL = "qwen2.5:14b";
const FAST_STATUS_MAX_AGE_MS = Number(
  process.env.RAWMARKETS_RUNTIME_STATUS_MAX_AGE_MS || 12 * 60 * 60 * 1000
);

function runtimeStatusFile() {
  return path.join(root, "data", "runtime-status.json");
}

function depsStampFile() {
  return path.join(root, "node_modules", ".rawmarkets_deps_stamp");
}

function run(label, cmd, args, { optional = false } = {}) {
  console.log(`[RawMarkets] ${label}`);
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  if (r.status !== 0) {
    if (optional) {
      console.warn(`[RawMarkets] Optional step skipped: ${cmd} ${args.join(" ")}`);
      return false;
    }
    console.error(`[RawMarkets] Failed: ${cmd} ${args.join(" ")}`);
    process.exit(r.status ?? 1);
  }
  return true;
}

function hasNode() {
  const r = spawnSync("node", ["-v"], { encoding: "utf8", shell: true });
  return r.status === 0;
}

function hasNpm() {
  const r = spawnSync("npm", ["-v"], { encoding: "utf8", shell: true });
  return r.status === 0;
}

function depsInstalled() {
  return (
    existsSync(path.join(root, "node_modules", "playwright", "package.json")) &&
    existsSync(path.join(root, "node_modules", "better-sqlite3", "package.json")) &&
    existsSync(path.join(root, "node_modules", "tsx", "package.json")) &&
    existsSync(path.join(root, "node_modules", "electron", "package.json"))
  );
}

function lockfileNewerThanModules() {
  const lockPath = path.join(root, "package-lock.json");
  const packagePath = path.join(root, "package.json");
  const modulesPath = path.join(root, "node_modules");
  if (!existsSync(lockPath) || !existsSync(modulesPath)) return false;
  try {
    const stampPath = depsStampFile();
    const baseline = existsSync(stampPath)
      ? statSync(stampPath).mtimeMs
      : statSync(modulesPath).mtimeMs;
    return (
      statSync(lockPath).mtimeMs > baseline ||
      (existsSync(packagePath) && statSync(packagePath).mtimeMs > baseline)
    );
  } catch {
    return false;
  }
}

function writeDepsStamp() {
  try {
    writeFileSync(depsStampFile(), String(Date.now()));
  } catch {
    /* best effort */
  }
}

async function chromiumInstalled() {
  try {
    const { chromium } = await import("playwright");
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
}

function detectPython() {
  const tryCmd = (cmd, args) => {
    const r = spawnSync(cmd, args, {
      encoding: "utf8",
      shell: true,
      timeout: 8000,
    });
    if (r.status !== 0) return null;
    const version = (r.stdout || r.stderr || "").trim();
    const match = version.match(/(\d+)\.(\d+)/);
    if (!match) return null;
    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10);
    if (major < 3 || (major === 3 && minor < 10)) return null;
    return { cmd, version, argsPrefix: args.slice(0, -1) };
  };

  if (process.platform === "win32") {
    const py = tryCmd("py", ["-3", "--version"]);
    if (py) return { ...py, launch: ["py", "-3"] };
  }
  const python = tryCmd("python", ["--version"]);
  if (python) return { ...python, launch: ["python"] };
  const python3 = tryCmd("python3", ["--version"]);
  if (python3) return { ...python3, launch: ["python3"] };
  return null;
}

function ensurePythonVenv(pythonLaunch) {
  const venvDir = path.join(root, "python", ".venv");
  const reqFile = path.join(root, "python", "requirements.txt");
  const stampFile = path.join(venvDir, ".deps_stamp");

  if (!existsSync(venvDir)) {
    run(
      "Creating Python venv for portfolio research…",
      pythonLaunch[0],
      [...pythonLaunch.slice(1), "-m", "venv", venvDir],
      { optional: true }
    );
  }

  const pip =
    process.platform === "win32"
      ? path.join(venvDir, "Scripts", "pip.exe")
      : path.join(venvDir, "bin", "pip");

  if (!existsSync(pip) || !existsSync(reqFile)) {
    return existsSync(pip);
  }

  const reqText = readFileSync(reqFile, "utf8").trim();
  const hasDeps = reqText
    .split("\n")
    .some((line) => line.trim() && !line.trim().startsWith("#"));
  if (!hasDeps) {
    return existsSync(pip);
  }

  let needsInstall = !existsSync(stampFile);
  if (!needsInstall) {
    try {
      needsInstall =
        statSync(reqFile).mtimeMs > statSync(stampFile).mtimeMs;
    } catch {
      needsInstall = true;
    }
  }

  if (needsInstall) {
    const ok = run(
      "Installing Python research dependencies…",
      pip,
      ["install", "-r", reqFile],
      { optional: true }
    );
    if (ok) writeFileSync(stampFile, String(Date.now()));
  }

  return existsSync(pip);
}

function detectOllama() {
  const ver = spawnSync("ollama", ["--version"], {
    encoding: "utf8",
    shell: true,
    timeout: 5000,
  });
  const installed = ver.status === 0;
  let daemonOk = false;
  let modelReady = false;

  if (installed) {
    try {
      const r = spawnSync(
        "curl",
        ["-s", "-m", "5", "http://127.0.0.1:11434/api/tags"],
        { encoding: "utf8", shell: true }
      );
      if (r.status === 0 && r.stdout) {
        daemonOk = true;
        const data = JSON.parse(r.stdout);
        const models = (data.models ?? []).map((m) => m.name);
        modelReady = models.some(
          (n) =>
            n === DEFAULT_OLLAMA_MODEL ||
            n.startsWith(`${DEFAULT_OLLAMA_MODEL.split(":")[0]}:`)
        );
      }
    } catch {
      /* daemon not running */
    }
  }

  return { installed, daemonOk, modelReady };
}

function writeRuntimeStatus(status) {
  const dataDir = path.join(root, "data");
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  writeFileSync(runtimeStatusFile(), JSON.stringify(status, null, 2));
}

function readRuntimeStatus() {
  try {
    const file = runtimeStatusFile();
    if (!existsSync(file)) return null;
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function runtimeStatusFresh(status) {
  if (!status?.checkedAt) return false;
  if (Date.now() - Number(status.checkedAt) > FAST_STATUS_MAX_AGE_MS) {
    return false;
  }
  return (
    status.nodeDeps?.ok === true &&
    status.chromium?.ok === true &&
    depsInstalled() &&
    !lockfileNewerThanModules()
  );
}

async function main() {
  console.log("[RawMarkets] Checking runtime…");

  if (!hasNode() || !hasNpm()) {
    console.error(
      "[RawMarkets] Node.js and npm are required. Install LTS from https://nodejs.org then run this launcher again."
    );
    process.exit(1);
  }

  if (!depsInstalled() || lockfileNewerThanModules()) {
    run(
      !depsInstalled()
        ? "Installing npm packages (first time may take a few minutes)…"
        : "Updating npm packages (package-lock.json changed)…",
      "npm",
      ["install"]
    );
    writeDepsStamp();
  } else if (!existsSync(depsStampFile())) {
    writeDepsStamp();
  }

  const cachedStatus = readRuntimeStatus();
  if (runtimeStatusFresh(cachedStatus)) {
    console.log("[RawMarkets] Runtime ready (fast cached check).");
    return;
  }

  let chromiumOk = await chromiumInstalled();
  if (!chromiumOk) {
    run(
      "Installing Playwright Chromium (~300MB, one-time) for live Kitco/Yahoo prices…",
      "npx",
      ["playwright", "install", "chromium"]
    );
    chromiumOk = await chromiumInstalled();
  }

  const py = detectPython();
  let venvReady = false;
  if (py) {
    venvReady = ensurePythonVenv(py.launch);
    console.log(`[RawMarkets] Python ${py.version} detected (research engine).`);
  } else {
    console.warn(
      "[RawMarkets] Python 3.10+ not found — portfolio research will use TypeScript fallback."
    );
    console.warn(
      "[RawMarkets] Install: winget install Python.Python.3.12  or run scripts\\install-python.ps1"
    );
  }

  const ollama = detectOllama();
  if (ollama.installed && ollama.daemonOk && !ollama.modelReady) {
    console.warn(
      `[RawMarkets] Ollama running but model ${DEFAULT_OLLAMA_MODEL} not pulled.`
    );
    console.warn(`[RawMarkets] Run: ollama pull ${DEFAULT_OLLAMA_MODEL}`);
  } else if (!ollama.installed) {
    console.log(
      "[RawMarkets] Ollama not installed (optional — news JSON extraction only)."
    );
  }

  writeRuntimeStatus({
    nodeDeps: {
      ok: depsInstalled(),
    },
    chromium: {
      ok: chromiumOk,
    },
    python: {
      ok: !!py && venvReady,
      version: py?.version ?? null,
      path: py?.launch?.[0] ?? null,
      venvReady,
      installHint: py ? null : "winget install Python.Python.3.12",
    },
    ollama: {
      ok: ollama.installed && ollama.daemonOk && ollama.modelReady,
      installed: ollama.installed,
      daemonOk: ollama.daemonOk,
      modelReady: ollama.modelReady,
      defaultModel: DEFAULT_OLLAMA_MODEL,
      installHint: ollama.installed
        ? null
        : "winget install Ollama.Ollama",
    },
    checkedAt: Date.now(),
  });

  console.log(
    "[RawMarkets] Runtime ready. Portfolio uses Yahoo Chart API; Playwright is optional for the market terminal."
  );
}

main().catch((err) => {
  console.error("[RawMarkets]", err instanceof Error ? err.message : err);
  process.exit(1);
});
