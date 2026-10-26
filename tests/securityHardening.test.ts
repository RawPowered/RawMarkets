import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  isAllowedOrigin,
  allowedOrigins,
} from "../src/server/requestSecurity";
import {
  assertPublicHttpUrl,
  isBlockedHostname,
  isBlockedNetworkAddress,
} from "../src/server/urlSafety";

const prevCorsOrigins = process.env.CORS_ORIGINS;
const prevAppUrl = process.env.APP_URL;

afterEach(() => {
  if (prevCorsOrigins === undefined) delete process.env.CORS_ORIGINS;
  else process.env.CORS_ORIGINS = prevCorsOrigins;
  if (prevAppUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = prevAppUrl;
});

describe("request security", () => {
  it("allows local app origins by default and rejects arbitrary origins", () => {
    assert.equal(isAllowedOrigin("http://localhost:3000"), true);
    assert.equal(isAllowedOrigin("http://127.0.0.1:5173"), true);
    assert.equal(isAllowedOrigin("https://evil.example"), false);
  });

  it("honors configured CORS origins without wildcard reflection", () => {
    process.env.CORS_ORIGINS = "https://markets.example.com";
    const origins = allowedOrigins();
    assert.equal(origins.has("https://markets.example.com"), true);
    assert.equal(isAllowedOrigin("https://markets.example.com"), true);
    assert.equal(isAllowedOrigin("https://other.example.com"), false);
  });
});

describe("URL safety", () => {
  it("blocks local/private network URL targets", async () => {
    assert.equal(isBlockedHostname("localhost"), true);
    assert.equal(isBlockedNetworkAddress("127.0.0.1"), true);
    assert.equal(isBlockedNetworkAddress("10.0.0.5"), true);
    assert.equal(isBlockedNetworkAddress("192.168.1.5"), true);
    assert.equal(isBlockedNetworkAddress("8.8.8.8"), false);

    await assert.rejects(
      () => assertPublicHttpUrl("http://127.0.0.1:3000/api/admin/keys"),
      /private network/
    );
    await assert.rejects(
      () => assertPublicHttpUrl("file:///C:/Windows/win.ini"),
      /http and https/
    );
  });

  it("allows public http URLs used by legitimate captures", async () => {
    const safe = await assertPublicHttpUrl("https://8.8.8.8/");
    assert.equal(safe.hostname, "8.8.8.8");
  });
});
