/**
 * Stop running RawMarkets / packaged Electron instances and unlock release/win-unpacked
 * so electron-builder can replace DLLs (fixes "Access is denied" on d3dcompiler_47.dll).
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const unpacked = path.join(root, "release", "win-unpacked");

function sleep(ms) {
  if (process.platform === "win32") {
    spawnSync(
      "powershell",
      ["-NoProfile", "-Command", `Start-Sleep -Milliseconds ${ms}`],
      { stdio: "ignore" }
    );
    return;
  }
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* spin */
  }
}

function stopPackagedProcessesWin() {
  const ps = `
    $root = ${JSON.stringify(root.replace(/\\/g, "\\\\"))}
    Get-Process -Name 'RawMarkets' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Get-Process -Name 'electron' -ErrorAction SilentlyContinue | ForEach-Object {
      try {
        if ($_.Path -and ($_.Path -like "*RawMarkets*release*" -or $_.Path -like "*RawMarkets*win-unpacked*")) {
          Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        }
      } catch {}
    }
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.CommandLine -like "*RawMarkets*" -and $_.CommandLine -like "*server*" } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  `;
  spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], {
    cwd: root,
    stdio: "inherit",
  });
}

async function removeDirWithRetry(dir, label, maxAttempts = 6) {
  if (!fs.existsSync(dir)) return;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`[RawMarkets] Cleared ${label}.`);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt >= maxAttempts) {
        console.error(
          `[RawMarkets] Could not remove ${label} after ${maxAttempts} tries: ${msg}`
        );
        console.error(
          "[RawMarkets] Close RawMarkets, exit any app from release\\win-unpacked, then run the build again."
        );
        process.exit(1);
      }
      console.warn(
        `[RawMarkets] ${label} locked (attempt ${attempt}/${maxAttempts}) — retrying…`
      );
      if (process.platform === "win32") stopPackagedProcessesWin();
      sleep(2000);
    }
  }
}

console.log("[RawMarkets] Unlocking release folder for packaging…");
if (process.platform === "win32") stopPackagedProcessesWin();
sleep(1500);
await removeDirWithRetry(unpacked, "release/win-unpacked");
