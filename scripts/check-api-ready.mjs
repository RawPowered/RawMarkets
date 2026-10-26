/**
 * Exit 0 when RawMarkets Express API is up with portfolio module (not stale Vite-only).
 */
import http from "http";

const healthUrl =
  process.env.RAWMARKETS_HEALTH_URL || "http://127.0.0.1:3000/api/health";

function fetchJson(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let body = "";
      res.on("data", (c) => {
        body += c;
      });
      res.on("end", () => {
        const trimmed = body.trimStart();
        if (trimmed.startsWith("<") || trimmed.toLowerCase().startsWith("<!")) {
          resolve({ ok: false, reason: "html", status: res.statusCode });
          return;
        }
        try {
          resolve({
            ok: true,
            status: res.statusCode,
            json: JSON.parse(body),
          });
        } catch {
          resolve({ ok: false, reason: "invalid_json", status: res.statusCode });
        }
      });
    });
    req.on("error", (err) => resolve({ ok: false, reason: err.message }));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve({ ok: false, reason: "timeout" });
    });
  });
}

async function main() {
  const health = await fetchJson(healthUrl);
  if (!health.ok || health.status !== 200) {
    console.error(
      `[RawMarkets] API not reachable (${health.reason ?? health.status}).`
    );
    process.exit(1);
  }
  if (health.json?.status !== "ok") {
    console.error("[RawMarkets] Health check failed.");
    process.exit(1);
  }
  if (health.json?.portfolio !== true) {
    console.error(
      "[RawMarkets] Stale server on port 3000 (missing portfolio module). Close the RawMarkets API window and restart."
    );
    process.exit(2);
  }
  process.exit(0);
}

main();
