import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "migrations");
const dest = path.join(root, "dist", "migrations");

if (!fs.existsSync(src)) {
  console.warn("[copy-migrations] No migrations/ folder — skip.");
  process.exit(0);
}

fs.mkdirSync(dest, { recursive: true });
for (const name of fs.readdirSync(src)) {
  if (!name.endsWith(".sql")) continue;
  fs.copyFileSync(path.join(src, name), path.join(dest, name));
}
console.log(`[copy-migrations] Copied SQL migrations to ${dest}`);
