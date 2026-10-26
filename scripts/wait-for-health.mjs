/**
 * Wait until the RawMarkets API responds on /api/health with JSON { status: "ok" }.
 */
import http from "http";

const url = process.env.RAWMARKETS_HEALTH_URL || "http://127.0.0.1:3000/api/health";
const maxMs = Number(process.env.RAWMARKETS_HEALTH_TIMEOUT_MS || 120_000);
const start = Date.now();

function probe() {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
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
              j?.status === "ok" &&
              j?.portfolio === true
          );
        } catch {
          resolve(false);
        }
      });
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  console.log(`[RawMarkets] Waiting for API at ${url} …`);
  while (Date.now() - start < maxMs) {
    if (await probe()) {
      console.log("[RawMarkets] API is up.");
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.error(
    "[RawMarkets] API did not start in time (need JSON health with portfolio:true). Run: npm run dev — not vite alone. Close any stale server on port 3000."
  );
  process.exit(1);
}

main();
