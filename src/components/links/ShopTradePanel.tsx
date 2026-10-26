import React, { useState } from "react";
import { Search, Coins, ArrowUpRight, Info } from "lucide-react";
import { MARKET_HUBS, googleFaviconUrlForHub } from "../../lib/marketHubs";

export default function ShopTradePanel() {
  const [filterType, setFilterType] = useState<"ALL" | "METALS" | "STOCKS">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredHubs = MARKET_HUBS.filter((hub) => {
    const matchesFilter =
      filterType === "ALL" ||
      (filterType === "METALS" && hub.category === "metals") ||
      (filterType === "STOCKS" && hub.category === "stocks");

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      hub.name.toLowerCase().includes(q) ||
      hub.desc.toLowerCase().includes(q) ||
      hub.domain.toLowerCase().includes(q) ||
      hub.tag.toLowerCase().includes(q) ||
      hub.features.some((f) => f.toLowerCase().includes(q));

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#E5E8EB] pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1 px-2.5 bg-zinc-950 font-mono text-[9px] font-black uppercase text-amber-400 rounded-md tracking-wider flex items-center gap-1">
              <Coins size={11} className="text-amber-400" />
              Shop &amp; trade
            </span>
          </div>
          <h3 className="text-base font-extrabold text-[#1D1D1F] tracking-tight">
            Bullion dealers &amp; equity brokers
          </h3>
          <p className="text-xs text-[#86868B]">
            Vetted outlets for physical metals and stock brokerage. Opens in a new tab.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#F5F5F7] p-2 rounded-2xl border border-[#E5E8EB]">
        <div className="flex items-center bg-white p-1 rounded-xl border border-[#E5E8EB] shrink-0 font-medium">
          {(["ALL", "METALS", "STOCKS"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
                filterType === type
                  ? "bg-zinc-900 text-white shadow-xs"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              {type === "ALL"
                ? "All"
                : type === "METALS"
                  ? "Physical metals"
                  : "Equity brokers"}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
            <Search size={13} />
          </span>
          <input
            type="text"
            placeholder="Filter outlets…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#E5E8EB] focus:border-zinc-400 rounded-xl text-xs text-[#1D1D1F] outline-none"
          />
        </div>
      </div>

      {filteredHubs.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-[#E5E8EB] bg-zinc-50 rounded-2xl">
          <p className="text-xs font-bold text-[#1D1D1F]">No outlets match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredHubs.map((hub) => {
            const faviconUrl = googleFaviconUrlForHub(hub.domain);
            return (
              <div
                key={hub.name}
                className="group bg-white border border-[#E5E8EB] hover:border-[#86868B]/80 hover:shadow-md rounded-2xl p-5 transition-all flex flex-col"
              >
                <div className="flex items-center justify-between gap-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center shrink-0 p-1.5 overflow-hidden">
                      <img
                        src={faviconUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-[#1D1D1F]">{hub.name}</h4>
                      <span className="text-[10px] text-zinc-400 font-mono">{hub.domain}</span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase font-mono ${
                      hub.category === "metals"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {hub.category}
                  </span>
                </div>
                <p className="text-[10px] font-bold text-zinc-500 font-mono uppercase mb-2">
                  {hub.tag}
                </p>
                <p className="text-[11px] text-[#424245] leading-relaxed mb-4 flex-1">
                  {hub.desc}
                </p>
                <div className="space-y-3 pt-3 border-t border-zinc-100">
                  <div className="flex flex-wrap gap-1">
                    {hub.features.map((feat) => (
                      <span
                        key={feat}
                        className="text-[9px] font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-sm"
                      >
                        {feat}
                      </span>
                    ))}
                  </div>
                  <a
                    href={hub.url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 bg-[#007AFF] hover:bg-[#0066CC] text-white rounded-xl text-[10px] font-extrabold font-mono tracking-wide flex items-center justify-center gap-1.5 transition-all"
                  >
                    Visit {hub.name}
                    <ArrowUpRight size={12} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-[#F5F5F7] border border-[#E5E8EB] p-4 rounded-2xl flex items-start gap-3">
        <Info size={16} className="text-[#86868B] shrink-0 mt-0.5" />
        <p className="text-[11px] text-[#86868B] leading-relaxed">
          External links — not affiliated with Raw Investor. Verify fees, custody, and
          regulatory coverage before trading or purchasing metals.
        </p>
      </div>
    </div>
  );
}
