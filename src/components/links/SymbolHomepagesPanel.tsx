import React, { useMemo, useState } from "react";
import { Search, ExternalLink, Globe } from "lucide-react";
import type { Asset } from "../../types";
import SymbolLogo from "../SymbolLogo";
import { resolveSymbolDomain } from "../../lib/symbolDomains";
import { categoryBrandTint } from "../../lib/categoryBrand";

const CATEGORIES = ["ALL", "METALS", "ENERGY", "TECH", "MARKETS", "FINANCE"] as const;

interface SymbolHomepagesPanelProps {
  assets: Record<string, Asset>;
  pinnedSymbols?: string[];
}

export default function SymbolHomepagesPanel({
  assets,
  pinnedSymbols = [],
}: SymbolHomepagesPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("ALL");

  const pinnedSet = useMemo(
    () => new Set(pinnedSymbols.map((s) => s.toUpperCase())),
    [pinnedSymbols]
  );

  const entries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return Object.entries(assets)
      .map(([key, asset]) => {
        const domain = resolveSymbolDomain(key);
        return { key, asset, domain };
      })
      .filter(({ asset, domain, key }) => {
        if (category !== "ALL" && asset.category !== category) return false;
        if (!q) return true;
        const hay = `${key} ${asset.name} ${asset.symbol} ${domain ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const ap = pinnedSet.has(a.key) ? 0 : 1;
        const bp = pinnedSet.has(b.key) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return a.key.localeCompare(b.key);
      });
  }, [assets, searchQuery, category, pinnedSet]);

  const withDomain = entries.filter((e) => e.domain);
  const withoutDomain = entries.filter((e) => !e.domain);

  return (
    <div className="space-y-6">
      <div className="border-b border-[#E5E8EB] pb-5">
        <div className="flex items-center gap-2 mb-1">
          <Globe size={14} className="text-[#007AFF]" />
          <span className="text-[10px] font-mono font-bold uppercase text-[#86868B]">
            Company sites
          </span>
        </div>
        <h3 className="text-base font-extrabold text-[#1D1D1F]">Issuer &amp; brand homepages</h3>
        <p className="text-xs text-[#86868B] mt-1">
          Official sites for every symbol in your catalog ({entries.length} instruments).
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="flex flex-wrap gap-1 bg-[#F5F5F7] p-1 rounded-xl border border-[#E5E8EB]">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                category === cat
                  ? "bg-white text-[#1D1D1F] shadow-xs"
                  : "text-[#86868B]"
              }`}
            >
              {cat === "ALL" ? "All" : cat}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search symbol, name, or domain…"
            className="w-full pl-8 pr-3 py-2 bg-white border border-[#E5E8EB] rounded-xl text-xs outline-none focus:border-[#007AFF]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {withDomain.map(({ key, asset, domain }) => {
          const url = `https://${domain}`;
          const tint = categoryBrandTint(asset.category);
          return (
            <div
              key={key}
              className="bg-white border border-[#E5E8EB] rounded-2xl p-4 hover:shadow-md transition-all flex flex-col gap-3"
              style={{ boxShadow: `0 4px 16px -8px ${tint}44` }}
            >
              <div className="flex items-start justify-between gap-2">
                <SymbolLogo symbol={key} size="md" brandTint={tint} resolveRemote={false} />
                {pinnedSet.has(key) ? (
                  <span className="text-[9px] font-mono font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                    PINNED
                  </span>
                ) : null}
              </div>
              <div className="min-w-0">
                <span className="text-sm font-black text-[#1D1D1F]">{asset.symbol}</span>
                <p className="text-[11px] text-[#86868B] line-clamp-2 mt-0.5">{asset.name}</p>
                <span
                  className="inline-block mt-2 text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${tint}18`, color: tint }}
                >
                  {asset.category}
                </span>
              </div>
              <p className="text-[10px] font-mono text-[#86868B] truncate">{domain}</p>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="mt-auto w-full py-2 rounded-xl bg-[#1D1D1F] hover:bg-[#007AFF] text-white text-[10px] font-bold font-mono flex items-center justify-center gap-1.5 transition-colors"
              >
                Visit site
                <ExternalLink size={11} />
              </a>
            </div>
          );
        })}
      </div>

      {withoutDomain.length > 0 ? (
        <div className="border-t border-[#E5E8EB] pt-6">
          <h4 className="text-[11px] font-mono font-bold text-[#86868B] uppercase mb-3">
            No public homepage mapped ({withoutDomain.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {withoutDomain.map(({ key, asset }) => (
              <span
                key={key}
                className="text-[10px] font-mono px-2 py-1 bg-zinc-100 text-zinc-500 rounded-lg"
                title={asset.name}
              >
                {key}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
