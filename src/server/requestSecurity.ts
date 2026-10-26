import type { Request, Response, NextFunction } from "express";

const DEFAULT_LOCAL_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function configuredOrigins(): string[] {
  const raw = [
    ...(process.env.CORS_ORIGINS ?? "").split(","),
    process.env.APP_URL ?? "",
  ];
  return raw.map((s) => s.trim()).filter(Boolean);
}

function normalizeOrigin(origin: string): string | null {
  try {
    const u = new URL(origin);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    return (
      (u.protocol === "http:" || u.protocol === "https:") &&
      (u.hostname === "localhost" ||
        u.hostname === "127.0.0.1" ||
        u.hostname === "[::1]")
    );
  } catch {
    return false;
  }
}

export function allowedOrigins(): Set<string> {
  const origins = new Set<string>();
  for (const origin of [...DEFAULT_LOCAL_ORIGINS, ...configuredOrigins()]) {
    const normalized = normalizeOrigin(origin);
    if (normalized) origins.add(normalized);
  }
  return origins;
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (isLoopbackOrigin(origin)) return true;
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  return allowedOrigins().has(normalized);
}

export function isLoopbackAddress(ip: string | undefined): boolean {
  if (!ip) return false;
  const normalized = ip.replace("::ffff:", "");
  return (
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "localhost"
  );
}

export function requestRemoteAddress(req: Request): string | undefined {
  // The application does not configure Express trust proxy. Treat forwarding
  // headers as untrusted input and use the direct socket peer for local checks.
  return req.socket.remoteAddress;
}

export function hasValidAdminToken(req: Request): boolean {
  const token = process.env.ADMIN_TOKEN?.trim();
  if (!token) return false;
  const headerToken = req.headers["x-admin-token"];
  const provided =
    typeof headerToken === "string"
      ? headerToken
      : Array.isArray(headerToken)
        ? headerToken[0]
        : undefined;
  return provided === token;
}

function requestOriginOrReferer(req: Request): string | undefined {
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin) return origin;

  const referer = req.headers.referer;
  if (typeof referer === "string" && referer) {
    return normalizeOrigin(referer) ?? referer;
  }
  return undefined;
}

function isUnsafeMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

export function rejectUntrustedUnsafeRequests(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!isUnsafeMethod(req.method)) {
    next();
    return;
  }

  if (hasValidAdminToken(req)) {
    next();
    return;
  }

  const origin = requestOriginOrReferer(req);
  if (origin) {
    if (isAllowedOrigin(origin)) {
      next();
      return;
    }
    res.status(403).json({
      success: false,
      message: "Request origin is not trusted for state-changing API calls.",
    });
    return;
  }

  if (isLoopbackAddress(requestRemoteAddress(req))) {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    message: "State-changing API calls require a trusted Origin or admin token.",
  });
}
