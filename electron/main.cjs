const {

  app,

  BrowserWindow,

  ipcMain,

  shell,

} = require("electron");

const path = require("path");

const fs = require("fs");

const { spawn } = require("child_process");

const http = require("http");



const ROOT = path.join(__dirname, "..");
const APP_ROOT = app.isPackaged ? app.getAppPath() : path.join(__dirname, "..");
const USER_DATA_DIR = app.getPath("userData");
const USER_DATA_APP_DIR = path.join(USER_DATA_DIR, "data");
const USER_DATA_DB_PATH = path.join(USER_DATA_APP_DIR, "rawmarkets.db");
const LOG_DIR = path.join(USER_DATA_DIR, "logs");
const SERVER_LOG_PATH = path.join(LOG_DIR, "server.log");
const LAUNCHER_LOG_PATH = path.join(LOG_DIR, "launcher.log");

const PORT = 3000;

const HEALTH_URL = `http://127.0.0.1:${PORT}/api/health`;

const SHUTDOWN_URL = `http://127.0.0.1:${PORT}/api/shutdown`;



let launcherWindow = null;

let appWindow = null;

let serverProcess = null;

let pollTimer = null;

let isQuitting = false;

let shutdownPromise = null;
let bootstrapComplete = false;
let bootstrapRunning = false;



function isPackaged() {

  return app.isPackaged;

}

function hasPackagedServerBundle() {
  const script = path.join(
    process.resourcesPath,
    "app.asar.unpacked",
    "dist",
    "server.cjs"
  );
  return fs.existsSync(script);
}

function packagedSeedDbPath() {
  return path.join(process.resourcesPath, "seed-data", "rawmarkets.db");
}

function ensurePackagedDatabaseSeed() {
  if (!isPackaged()) return;
  try {
    if (!fs.existsSync(USER_DATA_APP_DIR)) {
      fs.mkdirSync(USER_DATA_APP_DIR, { recursive: true });
    }
    if (fs.existsSync(USER_DATA_DB_PATH)) {
      appendLauncherLogLine(`[db] user database exists: ${USER_DATA_DB_PATH}`);
      return;
    }
    const seedPath = packagedSeedDbPath();
    if (!fs.existsSync(seedPath)) {
      appendLauncherLogLine("[db] no packaged seed database found; starting clean.");
      return;
    }
    fs.copyFileSync(seedPath, USER_DATA_DB_PATH);
    appendLauncherLogLine(`[db] seeded user database from packaged resource: ${seedPath}`);
  } catch (err) {
    appendLauncherLogLine(
      `[db] failed to initialize packaged database seed: ${err?.message || String(err)}`
    );
  }
}

function parseDotEnv(contents) {
  const out = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

function loadUserEnv() {
  const envPath = path.join(USER_DATA_DIR, ".env");
  if (!fs.existsSync(envPath)) return {};
  try {
    return parseDotEnv(fs.readFileSync(envPath, "utf-8"));
  } catch {
    return {};
  }
}

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function rotateServerLog() {
  try {
    ensureLogDir();
    if (fs.existsSync(SERVER_LOG_PATH)) {
      fs.renameSync(SERVER_LOG_PATH, `${SERVER_LOG_PATH}.prev`);
    }
  } catch {}
}

function appendServerLog(chunk) {
  if (!chunk) return;
  try {
    ensureLogDir();
    fs.appendFileSync(SERVER_LOG_PATH, chunk);
  } catch {}
}

function appendServerLogLine(line) {
  appendServerLog(`${line}\n`);
}

function appendLauncherLogLine(line) {
  try {
    ensureLogDir();
    fs.appendFileSync(LAUNCHER_LOG_PATH, `${line}\n`);
  } catch {}
}

process.on("uncaughtException", (err) => {
  appendLauncherLogLine(`[uncaughtException] ${err?.stack || err?.message || String(err)}`);
});

process.on("unhandledRejection", (reason) => {
  appendLauncherLogLine(
    `[unhandledRejection] ${reason?.stack || reason?.message || String(reason)}`
  );
});



function serverCommand() {
  const packagedServerScript = path.join(
    process.resourcesPath,
    "app.asar.unpacked",
    "dist",
    "server.cjs"
  );
  const serverScript = hasPackagedServerBundle()
    ? packagedServerScript
    : path.join(APP_ROOT, "dist", "server.cjs");

  const hasBuild = fs.existsSync(serverScript);



  if (hasPackagedServerBundle() || (hasBuild && process.env.RAWMARKETS_USE_BUILD === "1")) {

    return { script: serverScript, electronNode: true };

  }



  const npx = process.platform === "win32" ? "npx.cmd" : "npx";

  return { cmd: npx, args: ["tsx", path.join(APP_ROOT, "server.ts")] };

}

function serverWorkingDirectory() {
  if (hasPackagedServerBundle()) {
    return path.join(process.resourcesPath, "app.asar.unpacked");
  }
  return APP_ROOT;
}

function packagedNodeModulePaths() {
  const unpacked = path.join(process.resourcesPath, "app.asar.unpacked", "node_modules");
  const asar = path.join(app.getAppPath(), "node_modules");
  const paths = [];
  if (fs.existsSync(unpacked)) paths.push(unpacked);
  if (fs.existsSync(asar)) paths.push(asar);
  return paths;
}

function readServerLogTail(maxChars = 1200) {
  try {
    if (!fs.existsSync(SERVER_LOG_PATH)) return "";
    const raw = fs.readFileSync(SERVER_LOG_PATH, "utf-8");
    return raw.length > maxChars ? raw.slice(-maxChars) : raw;
  } catch {
    return "";
  }
}

function serverExitHint(code) {
  const tail = readServerLogTail();
  const moduleMatch = tail.match(/Cannot find module '([^']+)'/);
  if (moduleMatch) {
    return `Missing dependency "${moduleMatch[1]}" in packaged build. Rebuild with npm run package:portable-memory.`;
  }
  if (tail.includes("better-sqlite3") || tail.includes("NODE_MODULE_VERSION")) {
    return "SQLite native module failed to load. Rebuild the Windows package.";
  }
  if (code !== 0 && code !== null) {
    return `Server exited (${code}). See %APPDATA%\\RawMarkets\\logs\\server.log`;
  }
  return "Server stopped unexpectedly.";
}



function sendStatus(payload) {

  if (launcherWindow && !launcherWindow.isDestroyed()) {

    launcherWindow.webContents.send("launcher:status", payload);

  }

}



function stopServer() {

  if (pollTimer) {

    clearInterval(pollTimer);

    pollTimer = null;

  }

  if (serverProcess) {

    try {

      if (process.platform === "win32") {

        spawn("taskkill", ["/pid", String(serverProcess.pid), "/f", "/t"], {

          stdio: "ignore",

          windowsHide: true,

        });

      } else {

        serverProcess.kill("SIGTERM");

      }

    } catch (_) {}

    serverProcess = null;

  }

}



function requestServerShutdown() {

  return new Promise((resolve) => {

    const req = http.request(

      SHUTDOWN_URL,

      {
        method: "POST",
        timeout: 4000,
        headers: process.env.ADMIN_TOKEN
          ? { "x-admin-token": process.env.ADMIN_TOKEN }
          : {},
      },

      () => resolve(true)

    );

    req.on("error", () => resolve(false));

    req.on("timeout", () => {

      req.destroy();

      resolve(false);

    });

    req.end();

  });

}



function killStaleApiOnPort() {

  const script = path.join(APP_ROOT, "scripts", "stop-stale-api.ps1");

  if (process.platform === "win32" && fs.existsSync(script)) {

    try {

      spawn(

        "powershell",

        ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script],

        { stdio: "ignore", windowsHide: true }

      );

    } catch (_) {}

  }

}


function sleep(ms) {

  return new Promise((resolve) => setTimeout(resolve, ms));

}



async function shutdownPlatform() {

  if (shutdownPromise) return shutdownPromise;



  shutdownPromise = (async () => {

    if (isQuitting) return;

    isQuitting = true;



    await requestServerShutdown();
    const waitStart = Date.now();
    while (serverProcess && Date.now() - waitStart < 5000) {
      const healthy = await checkHealth();
      if (!healthy) break;
      await sleep(200);
    }
    stopServer();

    killStaleApiOnPort();



    await new Promise((resolve) => setTimeout(resolve, 900));



    for (const win of BrowserWindow.getAllWindows()) {

      if (!win.isDestroyed()) {

        win.removeAllListeners("close");

        win.destroy();

      }

    }

    appWindow = null;

    launcherWindow = null;



    app.quit();

  })();



  return shutdownPromise;

}



function wireWindowCloseToShutdown(win) {

  if (!win || win.isDestroyed()) return;

  win.on("close", (event) => {

    if (isQuitting) return;

    event.preventDefault();

    void shutdownPlatform();

  });

}



function postJson(path, method = "GET", body, timeoutMs = 0) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      headers: payload
        ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
        : {},
    };
    if (timeoutMs > 0) opts.timeout = timeoutMs;
    const req = http.request(`http://127.0.0.1:${PORT}${path}`, opts, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(data || "{}"), text: data || "" });
          } catch {
            resolve({ status: res.statusCode, json: {}, text: data || "" });
          }
        });
      }
    );
    req.on("error", reject);
    if (timeoutMs > 0) {
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timed out"));
      });
    }
    if (payload) req.write(payload);
    req.end();
  });
}

async function pollLaunchStatus() {
  try {
    return await postJson("/api/launch/status", "GET", null, 0);
  } catch (err) {
    await sleep(300);
    return postJson("/api/launch/status", "GET", null, 0);
  }
}

async function pollLaunchBootstrap(maxMs = 600000) {
  const start = Date.now();
  let lastPhase = "";
  while (Date.now() - start < maxMs) {
    let json;
    let statusCode = 0;
    try {
      const res = await pollLaunchStatus();
      statusCode = Number(res.status || 0);
      json = res.json;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      sendStatus({
        state: "warming",
        phase: lastPhase || "market",
        detail: `Waiting for engine… (${msg})`,
      });
      await sleep(1000);
      continue;
    }
    if (statusCode === 404) {
      bootstrapRunning = false;
      bootstrapComplete = false;
      sendStatus({
        state: "error",
        message: "Launch status API missing — packaged server bundle is incomplete.",
      });
      return false;
    }
    if (json.phase) lastPhase = json.phase;
    if (json.hydrateSummary) {
      sendStatus({
        state: "warming",
        phase: json.phase,
        detail: json.detail,
        progress: json.progress,
        hydrateSummary: json.hydrateSummary,
      });
    } else {
      sendStatus({
        state: "warming",
        phase: json.phase,
        detail: json.detail,
        progress: json.progress,
      });
    }
    if (json.status === "complete") {
      bootstrapComplete = true;
      bootstrapRunning = false;
      sendStatus({ state: "ready", message: "Preload complete" });
      return true;
    }
    if (json.status === "error") {
      bootstrapRunning = false;
      bootstrapComplete = false;
      sendStatus({
        state: "error",
        message: json.error || json.detail || "Launch preload failed",
      });
      return false;
    }
    await sleep(500);
  }
  bootstrapRunning = false;
  sendStatus({ state: "error", message: "Launch preload timed out" });
  return false;
}

async function runLaunchBootstrap() {
  if (bootstrapRunning) return bootstrapComplete;
  bootstrapRunning = true;
  bootstrapComplete = false;
  sendStatus({ state: "warming", phase: "hydrate", detail: "Starting launch preload…", progress: 0 });
  try {
    const started = await postJson("/api/launch/bootstrap", "POST", null, 15000);
    if (started.status === 404) {
      bootstrapRunning = false;
      sendStatus({
        state: "error",
        message:
          "Launch API missing — run: npm run build (then restart launcher)",
      });
      return false;
    }
    if (started.status < 200 || started.status >= 300) {
      bootstrapRunning = false;
      sendStatus({
        state: "error",
        message:
          started.json?.message ||
          `Launch bootstrap failed with HTTP ${started.status}. Check launcher/server logs.`,
      });
      return false;
    }
    return await pollLaunchBootstrap();
  } catch (err) {
    bootstrapRunning = false;
    sendStatus({ state: "error", message: err.message || "Bootstrap request failed" });
    return false;
  }
}

function checkHealth() {

  return new Promise((resolve) => {

    const req = http.get(HEALTH_URL, (res) => {

      let body = "";

      res.on("data", (chunk) => {

        body += chunk;

      });

      res.on("end", () => {

        const trimmed = body.trimStart();

        if (trimmed.startsWith("<") || trimmed.toLowerCase().startsWith("<!")) {

          resolve(false);

          return;

        }

        try {

          const j = JSON.parse(body);

          resolve(

            res.statusCode === 200 &&

              j &&

              j.status === "ok" &&

              j.portfolio === true

          );

        } catch {

          resolve(false);

        }

      });

    });

    req.on("error", () => resolve(false));

    req.setTimeout(2000, () => {

      req.destroy();

      resolve(false);

    });

  });

}



function waitForServer(maxMs = 60000) {

  const start = Date.now();

  return new Promise((resolve, reject) => {

    pollTimer = setInterval(async () => {

      if (await checkHealth()) {

        clearInterval(pollTimer);

        pollTimer = null;

        resolve();

        return;

      }

      if (Date.now() - start > maxMs) {

        clearInterval(pollTimer);

        pollTimer = null;

        reject(new Error("Server did not start in time"));

      }

    }, 500);

  });

}



function startServer() {

  return new Promise((resolve, reject) => {

    if (serverProcess) {

      checkHealth().then((ok) => (ok ? resolve() : reject(new Error("Server unhealthy"))));

      return;

    }



    killStaleApiOnPort();

    sendStatus({ state: "starting" });



    const spec = serverCommand();

    const env = {

      ...process.env,
      ...loadUserEnv(),

      NODE_ENV:
        hasPackagedServerBundle() ? "production" : process.env.NODE_ENV || "development",
      RAWMARKETS_DATA_DIR:
        process.env.RAWMARKETS_DATA_DIR ||
        (hasPackagedServerBundle()
          ? path.join(USER_DATA_DIR, "data")
          : path.join(APP_ROOT, "data")),

    };

    if (hasPackagedServerBundle()) {
      const modulePaths = packagedNodeModulePaths();
      if (modulePaths.length > 0) {
        const existing = process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : [];
        env.NODE_PATH = [...modulePaths, ...existing].filter(Boolean).join(path.delimiter);
      }
    }



    if (spec.script) {

      if (spec.electronNode) env.ELECTRON_RUN_AS_NODE = "1";

      const runner = spec.electronNode ? process.execPath : "node";
      const usePackedStdio = hasPackagedServerBundle();
      if (usePackedStdio) rotateServerLog();
      if (usePackedStdio) {
        appendServerLogLine(
          `[launcher] spawning script runner=${runner} cwd=${serverWorkingDirectory()} script=${spec.script}`
        );
      }

      serverProcess = spawn(runner, [spec.script], {

        cwd: serverWorkingDirectory(),

        env,

        stdio: usePackedStdio ? ["ignore", "pipe", "pipe"] : "inherit",

        shell: false,
        windowsHide: usePackedStdio,

      });
      if (usePackedStdio && serverProcess.stdout && serverProcess.stderr) {
        serverProcess.stdout.on("data", (chunk) => appendServerLog(chunk));
        serverProcess.stderr.on("data", (chunk) => appendServerLog(chunk));
      }

    } else {

      serverProcess = spawn(spec.cmd, spec.args, {

        cwd: serverWorkingDirectory(),

        env,

        stdio: "inherit",

        shell: process.platform === "win32",

      });

    }



    serverProcess.on("error", (err) => {
      appendServerLogLine(`[launcher] spawn error: ${err.message}`);

      sendStatus({ state: "error", message: err.message });

      reject(err);

    });



    serverProcess.on("exit", (code) => {
      appendServerLogLine(`[launcher] server exited code=${code}`);

      if (code !== 0 && code !== null && !isQuitting) {

        const hint = bootstrapRunning
          ? "Engine stopped during preload (run npm run build, then retry)."
          : serverExitHint(code);

        sendStatus({ state: "error", message: hint });

        bootstrapRunning = false;

        bootstrapComplete = false;

      }

      serverProcess = null;

    });



    waitForServer()

      .then(async () => {

        await runLaunchBootstrap();

        resolve();

      })

      .catch(reject);

  });

}



function isAllowedExternalUrl(url) {

  try {

    const parsed = new URL(url);

    return parsed.protocol === "http:" || parsed.protocol === "https:";

  } catch {

    return false;

  }

}



function wireExternalLinks(win) {

  const appOrigin = `http://127.0.0.1:${PORT}`;

  win.webContents.setWindowOpenHandler(({ url }) => {

    if (isAllowedExternalUrl(url)) {

      void shell.openExternal(url);

    }

    return { action: "deny" };

  });



  win.webContents.on("will-navigate", (event, url) => {

    if (url.startsWith(appOrigin) || url.startsWith(`http://localhost:${PORT}`)) {

      return;

    }

    event.preventDefault();

    if (isAllowedExternalUrl(url)) {

      void shell.openExternal(url);

    }

  });

}



function createLauncherWindow() {

  launcherWindow = new BrowserWindow({

    width: 440,

    height: 640,

    resizable: false,

    frame: false,

    transparent: false,

    backgroundColor: "#0a0c10",

    show: true,

    webPreferences: {

      preload: path.join(__dirname, "preload.cjs"),

      contextIsolation: true,

      nodeIntegration: false,

    },

  });



  launcherWindow.loadFile(path.join(__dirname, "launcher.html"));
  if (isPackaged()) {
    launcherWindow.webContents.on("before-input-event", (_event, input) => {
      const openDevToolsShortcut =
        input.type === "keyDown" &&
        ((input.key === "F12") ||
          ((input.control || input.meta) && input.shift && input.key.toUpperCase() === "I"));
      if (openDevToolsShortcut) {
        _event.preventDefault();
      }
    });
  }

  wireWindowCloseToShutdown(launcherWindow);

}



function openAppWindow(route = "") {

  if (appWindow && !appWindow.isDestroyed()) {

    appWindow.focus();

    if (route) appWindow.loadURL(`http://127.0.0.1:${PORT}${route}`);

    return;

  }



  appWindow = new BrowserWindow({

    width: 1280,

    height: 860,

    minWidth: 900,

    minHeight: 600,

    backgroundColor: "#F4F7FB",

    show: true,

    webPreferences: {

      nodeIntegration: false,

      contextIsolation: true,

      preload: path.join(__dirname, "preload.cjs"),

      webviewTag: true,

    },

  });



  wireExternalLinks(appWindow);
  if (isPackaged()) {
    appWindow.webContents.on("before-input-event", (_event, input) => {
      const openDevToolsShortcut =
        input.type === "keyDown" &&
        ((input.key === "F12") ||
          ((input.control || input.meta) && input.shift && input.key.toUpperCase() === "I"));
      if (openDevToolsShortcut) {
        _event.preventDefault();
      }
    });
  }

  let loadPath = route || "/";
  if (!loadPath.includes("launch=")) {
    loadPath += loadPath.includes("?") ? "&launch=1" : "?launch=1";
  }
  appWindow.loadURL(`http://127.0.0.1:${PORT}${loadPath}`);

  wireWindowCloseToShutdown(appWindow);



  appWindow.on("closed", () => {

    appWindow = null;

  });

}



ipcMain.handle("launcher:play", async () => {

  try {

    const ok = await checkHealth();

    if (!ok) await startServer();

    if (!bootstrapComplete) {

      const warmed = await runLaunchBootstrap();

      if (!warmed) {

        return { success: false, message: "Launch preload did not complete" };

      }

    }

    openAppWindow();

    if (launcherWindow && !launcherWindow.isDestroyed()) {

      launcherWindow.hide();

    }

    return { success: true };

  } catch (err) {

    sendStatus({ state: "error", message: err.message });

    return { success: false, message: err.message };

  }

});



ipcMain.handle("launcher:settings", async () => {

  try {

    const ok = await checkHealth();

    if (!ok) await startServer();

    if (!bootstrapComplete) {

      const warmed = await runLaunchBootstrap();

      if (!warmed) {

        return { success: false, message: "Launch preload did not complete" };

      }

    }

    openAppWindow("/?page=config");

    if (launcherWindow && !launcherWindow.isDestroyed()) {

      launcherWindow.hide();

    }

    return { success: true };

  } catch (err) {

    sendStatus({ state: "error", message: err.message });

    return { success: false };

  }

});



ipcMain.handle("launcher:quit", () => {

  void shutdownPlatform();

  return { success: true };

});



ipcMain.on("launcher:get-version", (e) => {

  e.returnValue = app.getVersion();

});



ipcMain.handle("shell:open-external", async (_event, url) => {

  if (!isAllowedExternalUrl(url)) {

    return { ok: false, error: "Invalid URL" };

  }

  try {

    await shell.openExternal(url);

    return { ok: true };

  } catch (err) {

    return { ok: false, error: err.message };

  }

});



function runEnsureRuntime() {

  return new Promise((resolve, reject) => {

    if (process.env.RAWMARKETS_RUNTIME_READY === "1") {

      resolve();

      return;

    }

    const script = path.join(APP_ROOT, "scripts", "ensure-runtime.mjs");

    if (!fs.existsSync(script)) {

      resolve();

      return;

    }

    sendStatus({ state: "starting", message: "Checking dependencies…" });

    const child = spawn("node", [script], {

      cwd: APP_ROOT,

      stdio: "inherit",

      shell: process.platform === "win32",

    });

    child.on("error", reject);

    child.on("exit", (code) => {

      if (code === 0) resolve();

      else reject(new Error(`Runtime setup failed (exit ${code})`));

    });

  });

}



app.whenReady().then(async () => {
  appendLauncherLogLine("[startup] whenReady reached");
  app.setAppUserModelId("com.rawinvestor.rawmarkets");
  const hasLock = app.requestSingleInstanceLock();
  if (!hasLock) {
    app.quit();
    return;
  }
  app.on("second-instance", () => {
    if (appWindow && !appWindow.isDestroyed()) {
      if (appWindow.isMinimized()) appWindow.restore();
      appWindow.focus();
      return;
    }
    if (launcherWindow && !launcherWindow.isDestroyed()) {
      launcherWindow.show();
      launcherWindow.focus();
    }
  });

  createLauncherWindow();
  ensurePackagedDatabaseSeed();

  try {
    await runEnsureRuntime();
  } catch (err) {
    if (!isPackaged()) throw err;
  }

  try {
    const ok = await checkHealth();

    if (ok) {

      await runLaunchBootstrap();

      return;

    }

    sendStatus({ state: "starting", message: "Starting API server…" });

    killStaleApiOnPort();

    await sleep(400);

    await startServer();

  } catch (err) {

    sendStatus({

      state: "error",

      message: err?.message || "Failed to start",

    });

  }

});



app.on("window-all-closed", () => {

  if (!isQuitting) {

    void shutdownPlatform();

  } else if (process.platform !== "darwin") {

    app.quit();

  }

});



app.on("before-quit", () => {

  isQuitting = true;

  stopServer();

});
