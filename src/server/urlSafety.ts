import dns from "dns/promises";
import net from "net";

const LOOPBACK_HOSTS = new Set(["localhost", "localhost.localdomain"]);

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p))) {
    return true;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return (
    lower === "::1" ||
    lower === "::" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe80:") ||
    lower.startsWith("::ffff:127.") ||
    lower.startsWith("::ffff:10.") ||
    lower.startsWith("::ffff:192.168.")
  );
}

export function isBlockedNetworkAddress(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return LOOPBACK_HOSTS.has(host) || host.endsWith(".localhost");
}

export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed");
  }
  if (parsed.username || parsed.password) {
    throw new Error("URLs with embedded credentials are not allowed");
  }
  if (isBlockedHostname(parsed.hostname)) {
    throw new Error("Local or private network URLs are not allowed");
  }

  const ipVersion = net.isIP(parsed.hostname);
  if (ipVersion && isBlockedNetworkAddress(parsed.hostname)) {
    throw new Error("Local or private network URLs are not allowed");
  }

  if (!ipVersion) {
    const addresses = await dns.lookup(parsed.hostname, { all: true });
    if (
      addresses.length === 0 ||
      addresses.some((addr) => isBlockedNetworkAddress(addr.address))
    ) {
      throw new Error("Local or private network URLs are not allowed");
    }
  }

  return parsed;
}

function isRedirectStatus(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

export async function fetchPublicHttpUrl(
  rawUrl: string,
  init?: RequestInit,
  maxRedirects = 5
): Promise<Response> {
  let current = rawUrl;
  for (let i = 0; i <= maxRedirects; i++) {
    const safeUrl = await assertPublicHttpUrl(current);
    const resp = await fetch(safeUrl.href, {
      ...init,
      redirect: "manual",
    });
    if (!isRedirectStatus(resp.status)) return resp;

    const location = resp.headers.get("location");
    if (!location) {
      throw new Error("Redirect response did not include a Location header");
    }
    current = new URL(location, safeUrl.href).href;
  }
  throw new Error("Too many redirects");
}
