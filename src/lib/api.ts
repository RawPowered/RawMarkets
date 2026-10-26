let apiBaseUrl = "";
let adminToken = "";

export interface RemoteApiConfig {
  apiBaseUrl?: string;
  adminToken?: string;
}

export async function initApiConfig(): Promise<void> {
  if (import.meta.env.MODE !== "ftp") {
    return;
  }
  try {
    const res = await fetch("./config.json");
    if (!res.ok) return;
    const cfg = (await res.json()) as RemoteApiConfig;
    apiBaseUrl = (cfg.apiBaseUrl || "").replace(/\/$/, "");
    adminToken = cfg.adminToken || "";
  } catch {
    console.warn("[API] Could not load config.json; using same-origin API.");
  }
}

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return apiBaseUrl ? `${apiBaseUrl}${p}` : p;
}

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (adminToken) {
    headers.set("X-Admin-Token", adminToken);
  }
  return fetch(apiUrl(path), { ...init, headers });
}

/** Abort fetch if the API does not respond (avoids infinite loading spinner). */
export function apiFetchWithTimeout(
  path: string,
  init?: RequestInit,
  timeoutMs = 30_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const merged: RequestInit = {
    ...init,
    signal: init?.signal ?? controller.signal,
  };
  return apiFetch(path, merged).finally(() => clearTimeout(timer));
}

/** Parse JSON from API; reject Vite/HTML fallthrough (wrong process on :3000). */
export async function readApiJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trimStart();
  if (trimmed.startsWith("<!") || trimmed.toLowerCase().startsWith("<html")) {
    throw new Error(
      "Backend API not ready (got HTML instead of JSON). Close the RawMarkets API taskbar window and double-click Launch RawMarkets.bat again — do not run vite alone on port 3000."
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Invalid JSON from API — is the Express server running?");
  }
}

export function getAdminToken(): string {
  return adminToken;
}
