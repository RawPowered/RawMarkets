/**
 * Run electron-builder for a given RAWMARKETS_BUILD_FLAVOR.
 * Expects dist/ to already exist (npm run build).
 */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const flavor = process.argv[2]?.trim();
const allowed = new Set(["portable-memory", "nsis-clean"]);

if (!flavor || !allowed.has(flavor)) {
  console.error(
    "Usage: node scripts/electron-package.mjs <portable-memory|nsis-clean>"
  );
  process.exit(1);
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env, RAWMARKETS_BUILD_FLAVOR: flavor };

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`[RawMarkets] Packaging (${flavor})…`);
run("node", ["scripts/unlock-release-for-pack.mjs"]);
run("node", ["scripts/prepare-package-db.mjs"]);
run("npx", ["electron-builder", "--config", "electron-builder.config.cjs"]);
console.log(`[RawMarkets] Done (${flavor}).`);
