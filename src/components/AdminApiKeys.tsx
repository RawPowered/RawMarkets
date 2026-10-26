import { useCallback, useEffect, useState } from "react";
import {
  Key,
  ExternalLink,
  Save,
  Trash2,
  Zap,
  ShieldCheck,
  Download,
  Upload,
  Database,
} from "lucide-react";
import { apiFetch, apiUrl } from "../lib/api";

type KeyMeta = {
  id: string;
  hasValue: boolean;
  updatedAt: number | null;
  hint: string | null;
  source: "db" | "env" | "none";
};

const PROVIDERS: {
  id: string;
  label: string;
  envName: string;
  signup: string;
  color: string;
}[] = [
  {
    id: "gemini",
    label: "Cloud AI API",
    envName: "GEMINI_API_KEY",
    signup: "https://aistudio.google.com/apikey",
    color: "#007AFF",
  },
  {
    id: "alpha_vantage",
    label: "Alpha Vantage",
    envName: "ALPHA_VANTAGE_API_KEY",
    signup: "https://www.alphavantage.co/support/#api-key",
    color: "#007AFF",
  },
  {
    id: "metalprice",
    label: "MetalPriceAPI (optional — not used for spot display)",
    envName: "METALPRICE_API_KEY",
    signup: "https://metalpriceapi.com",
    color: "#FF9500",
  },
  {
    id: "serpapi",
    label: "SerpApi",
    envName: "SERPAPI_API_KEY",
    signup: "https://serpapi.com",
    color: "#34C759",
  },
  {
    id: "app_url",
    label: "App URL (optional)",
    envName: "APP_URL",
    signup: "",
    color: "#86868B",
  },
];

export default function AdminApiKeys({
  onKeysChanged,
}: {
  onKeysChanged?: () => void;
}) {
  const [keys, setKeys] = useState<KeyMeta[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<Record<string, string>>({});
  const [dbBusy, setDbBusy] = useState(false);
  const [feedVerify, setFeedVerify] = useState<{
    blockers: string[];
    hint: string;
    providers: Record<string, { ok: boolean; message: string; sample?: string }>;
    market?: { livePriceCount?: number; simulatedPriceCount?: number };
    avQuota?: { paused: boolean; resetsAt: string | null; note: string | null };
  } | null>(null);
  const [verifyingFeed, setVerifyingFeed] = useState(false);

  const loadKeys = useCallback(async () => {
    try {
      const resp = await apiFetch("/api/admin/keys");
      if (resp.ok) {
        const data = await resp.json();
        if (data.success) setKeys(data.keys);
      }
    } catch (e) {
      console.error("Failed to load API keys metadata", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const runFeedVerify = useCallback(async () => {
    setVerifyingFeed(true);
    try {
      const resp = await apiFetch("/api/feed-verify");
      if (resp.ok) {
        const data = await resp.json();
        if (data.success) setFeedVerify(data);
      }
    } catch (e) {
      console.error("Feed verify failed", e);
    } finally {
      setVerifyingFeed(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
    runFeedVerify();
  }, [loadKeys, runFeedVerify]);

  const metaFor = (id: string) => keys.find((k) => k.id === id);

  const handleSave = async (id: string) => {
    const value = drafts[id]?.trim();
    if (!value) return;
    setSavingId(id);
    try {
      const resp = await apiFetch("/api/admin/keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, value }),
      });
      const data = await resp.json();
      if (data.success) {
        setKeys(data.keys);
        setDrafts((d) => ({ ...d, [id]: "" }));
        onKeysChanged?.();
        void runFeedVerify();
      } else {
        alert(data.message || "Save failed");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setSavingId(null);
    }
  };

  const handleClear = async (id: string) => {
    if (!confirm(`Remove stored key for ${id}? Environment fallback may still apply.`))
      return;
    setSavingId(id);
    try {
      const resp = await apiFetch(`/api/admin/keys/${id}`, { method: "DELETE" });
      const data = await resp.json();
      if (data.success) {
        setKeys(data.keys);
        onKeysChanged?.();
      }
    } finally {
      setSavingId(null);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestMsg((m) => ({ ...m, [id]: "" }));
    try {
      const resp = await apiFetch(`/api/admin/keys/${id}/test`, {
        method: "POST",
      });
      const data = await resp.json();
      setTestMsg((m) => ({
        ...m,
        [id]: data.success
          ? `✓ ${data.message}`
          : `✗ ${data.message || "Test failed"}`,
      }));
      if (data.success) void runFeedVerify();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestMsg((m) => ({ ...m, [id]: msg }));
    } finally {
      setTestingId(null);
    }
  };

  const handleImportDb = async (file: File | undefined) => {
    if (!file) return;
    setDbBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const resp = await apiFetch("/api/admin/db/import", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: buf,
      });
      const data = await resp.json();
      if (data.success) {
        alert(data.message);
        onKeysChanged?.();
        loadKeys();
      } else {
        alert(data.message || "Import failed");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setDbBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E5E8EB] shadow-sm rounded-[32px] p-6 md:p-8">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck size={18} className="text-[#007AFF]" />
          <h3 className="text-base font-bold tracking-tight text-[#1D1D1F]">
            API Keys — Unified Admin
          </h3>
        </div>
        <p className="text-xs text-[#86868B] mb-4 max-w-2xl leading-relaxed">
          Store keys in the local SQLite vault. Values never appear in the browser
          network tab after save. Environment variables are used only when no DB
          value exists.
        </p>

        <div className="mb-6 p-4 rounded-2xl border border-[#E5E8EB] bg-white space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#1D1D1F]">
              Live feed check
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={verifyingFeed}
                onClick={() => runFeedVerify()}
                className="px-3 py-1.5 bg-[#007AFF] text-white text-[10px] font-bold rounded-lg"
              >
                {verifyingFeed ? "Checking…" : "Re-check APIs"}
              </button>
              <button
                type="button"
                disabled={dbBusy || feedVerify?.avQuota?.paused}
                onClick={async () => {
                  setDbBusy(true);
                  try {
                    const resp = await apiFetch("/api/admin/av-quota/acknowledge", {
                      method: "POST",
                    });
                    const data = await resp.json();
                    alert(data.message || "AV paused for today");
                    onKeysChanged?.();
                    void runFeedVerify();
                  } finally {
                    setDbBusy(false);
                  }
                }}
                className="px-3 py-1.5 border border-amber-300 text-amber-900 text-[10px] font-bold rounded-lg"
              >
                Stop AV today
              </button>
              <button
                type="button"
                disabled={dbBusy}
                onClick={async () => {
                  setDbBusy(true);
                  try {
                    const resp = await apiFetch("/api/admin/cache/clear", {
                      method: "POST",
                    });
                    const data = await resp.json();
                    alert(data.message || "Cache cleared");
                    onKeysChanged?.();
                    void runFeedVerify();
                  } finally {
                    setDbBusy(false);
                  }
                }}
                className="px-3 py-1.5 border border-[#E5E8EB] text-[10px] font-bold rounded-lg"
              >
                Clear stale cache
              </button>
            </div>
          </div>
          {feedVerify?.avQuota?.paused ? (
            <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              Alpha Vantage daily quota exhausted until{" "}
              {feedVerify.avQuota.resetsAt
                ? new Date(feedVerify.avQuota.resetsAt).toLocaleString("en-US", {
                    timeZone: "UTC",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "midnight"}{" "}
              UTC. Earlier refreshes used your 25 free calls while the UI still showed seeded
              prices — no more AV requests will be made until reset.
            </p>
          ) : null}
          {feedVerify?.blockers?.length ? (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              {feedVerify.blockers.join(" ")}
            </p>
          ) : null}
          {feedVerify?.providers ? (
            <ul className="text-[11px] space-y-1.5 font-mono">
              {(
                [
                  "kitco",
                  "yahoo",
                  "metalprice",
                  "alpha_vantage",
                ] as const
              ).map((id) => {
                const p = feedVerify.providers[id];
                if (!p) return null;
                return (
                  <li key={id} className={p.ok ? "text-emerald-700" : "text-rose-700"}>
                    {id}: {p.ok ? "OK" : "FAIL"} — {p.message}
                    {p.sample ? ` (${p.sample})` : ""}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {feedVerify?.market ? (
            <p className="text-[10px] text-[#86868B]">
              Last dashboard sync: {feedVerify.market.livePriceCount ?? 0} live /{" "}
              {feedVerify.market.simulatedPriceCount ?? 0} sim — {feedVerify.hint}
            </p>
          ) : (
            <p className="text-[10px] text-[#86868B]">
              Click <strong>Test</strong> on each key (expect a sample price), then{" "}
              <strong>Re-check APIs</strong>, then refresh the dashboard.
            </p>
          )}
        </div>

        {loading ? (
          <p className="text-xs text-[#86868B] font-mono">Loading key registry…</p>
        ) : (
          <div className="space-y-4">
            {PROVIDERS.map((p) => {
              const meta = metaFor(p.id);
              const configured = meta?.hasValue;
              return (
                <div
                  key={p.id}
                  className="p-5 bg-zinc-50 border border-[#E5E8EB] rounded-2xl space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span
                        className="text-[9px] uppercase tracking-wider font-extrabold font-mono block"
                        style={{ color: p.color }}
                      >
                        {p.label}
                      </span>
                      <code className="text-[10px] text-zinc-500 font-mono">
                        {p.envName}
                      </code>
                      <div className="flex gap-2 text-[10px] font-mono mt-1 items-center">
                        <span
                          className={
                            configured
                              ? "text-[#34C759] font-bold"
                              : "text-amber-500 font-bold"
                          }
                        >
                          {configured ? "● CONFIGURED" : "× MISSING"}
                        </span>
                        {meta?.hint && (
                          <span className="text-zinc-400">{meta.hint}</span>
                        )}
                        {meta?.source === "env" && (
                          <span className="text-zinc-400">(from .env)</span>
                        )}
                      </div>
                      {testMsg[p.id] && (
                        <p className="text-[10px] text-zinc-600 mt-1 font-mono">
                          {testMsg[p.id]}
                        </p>
                      )}
                    </div>
                    {p.signup && (
                      <a
                        href={p.signup}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-white border border-[#E5E8EB] rounded-lg text-[10px] font-bold flex items-center gap-1"
                      >
                        Get Key <ExternalLink size={10} />
                      </a>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-white border border-[#E5E8EB] rounded-xl px-3 py-2">
                      <Key size={14} className="text-zinc-400 shrink-0" />
                      <input
                        type="password"
                        placeholder={
                          configured
                            ? "Enter new key to replace…"
                            : "Paste API key…"
                        }
                        className="flex-1 text-xs font-mono bg-transparent outline-none min-w-0"
                        value={drafts[p.id] || ""}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [p.id]: e.target.value }))
                        }
                      />
                    </div>
                    <button
                      type="button"
                      disabled={savingId === p.id || !drafts[p.id]?.trim()}
                      onClick={() => handleSave(p.id)}
                      className="px-4 py-2 bg-[#1D1D1F] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 disabled:opacity-40"
                    >
                      <Save size={12} />
                      {savingId === p.id ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      disabled={testingId === p.id}
                      onClick={() => handleTest(p.id)}
                      className="px-4 py-2 bg-[#F0F7FF] text-[#007AFF] text-xs font-bold rounded-xl flex items-center justify-center gap-1"
                    >
                      <Zap size={12} />
                      {testingId === p.id ? "…" : "Test"}
                    </button>
                    {meta?.source === "db" && (
                      <button
                        type="button"
                        disabled={savingId === p.id}
                        onClick={() => handleClear(p.id)}
                        className="px-3 py-2 border border-red-200 text-red-600 text-xs font-bold rounded-xl"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-[#F5F5F7] border border-[#E5E8EB] rounded-[32px] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Database size={16} />
          <span className="text-[11px] font-extrabold uppercase tracking-widest font-mono text-zinc-600">
            SQLite Database
          </span>
        </div>
        <p className="text-xs text-[#86868B]">
          Export or import <code className="bg-white px-1 rounded">rawmarkets.db</code>{" "}
          for backup and migration.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={apiUrl("/api/admin/db/export")}
            className="px-4 py-2 bg-white border border-[#E5E8EB] rounded-xl text-xs font-bold flex items-center gap-2"
          >
            <Download size={14} />
            Export DB
          </a>
          <label className="px-4 py-2 bg-[#007AFF] text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer">
            <Upload size={14} />
            {dbBusy ? "Importing…" : "Import DB"}
            <input
              type="file"
              accept=".db,application/octet-stream"
              className="hidden"
              disabled={dbBusy}
              onChange={(e) => {
                handleImportDb(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
