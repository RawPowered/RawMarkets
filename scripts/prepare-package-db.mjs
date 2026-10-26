import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const flavor = (process.env.RAWMARKETS_BUILD_FLAVOR || "portable-memory").trim();

const stageDir = path.join(root, "build-resources", "portable-memory", "data");
const stagedDb = path.join(stageDir, "rawmarkets.db");
const sourceDb = path.join(root, "data", "rawmarkets.db");

function clearStagedDb() {
  if (fs.existsSync(stagedDb)) {
    fs.rmSync(stagedDb, { force: true });
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

if (flavor !== "portable-memory") {
  clearStagedDb();
  console.log(`[RawMarkets] Build flavor '${flavor}' uses clean installer data.`);
  process.exit(0);
}

if (!fs.existsSync(sourceDb)) {
  console.error(
    "[RawMarkets] Cannot create portable-memory package: data/rawmarkets.db was not found."
  );
  process.exit(1);
}

ensureDir(stageDir);
fs.copyFileSync(sourceDb, stagedDb);
console.log(`[RawMarkets] Staged memory database: ${path.relative(root, stagedDb)}`);
