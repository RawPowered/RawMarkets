import React, { useState } from "react";
import { Link2, Store, Globe } from "lucide-react";
import type { Asset } from "../../types";
import ShopTradePanel from "./ShopTradePanel";
import SymbolHomepagesPanel from "./SymbolHomepagesPanel";

type LinksTab = "shops" | "sites";

interface MarketLinksPageProps {
  assets: Record<string, Asset>;
  pinnedSymbols: string[];
}

export default function MarketLinksPage({
  assets,
  pinnedSymbols,
}: MarketLinksPageProps) {
  const [tab, setTab] = useState<LinksTab>("shops");

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      <div className="bg-white border border-[#E5E8EB] rounded-[32px] p-6 md:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center">
              <Link2 size={22} className="text-[#007AFF]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#1D1D1F] tracking-tight">
                Market Links
              </h2>
              <p className="text-xs text-[#86868B]">
                One place to shop, trade, and visit issuer homepages.
              </p>
            </div>
          </div>

          <div className="flex p-1 bg-[#F5F5F7] rounded-xl border border-[#E5E8EB]">
            <button
              type="button"
              onClick={() => setTab("shops")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                tab === "shops"
                  ? "bg-white text-[#1D1D1F] shadow-sm"
                  : "text-[#86868B]"
              }`}
            >
              <Store size={14} />
              Shop &amp; trade
            </button>
            <button
              type="button"
              onClick={() => setTab("sites")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                tab === "sites"
                  ? "bg-white text-[#1D1D1F] shadow-sm"
                  : "text-[#86868B]"
              }`}
            >
              <Globe size={14} />
              Company sites
            </button>
          </div>
        </div>

        {tab === "shops" ? (
          <ShopTradePanel />
        ) : (
          <SymbolHomepagesPanel assets={assets} pinnedSymbols={pinnedSymbols} />
        )}
      </div>
    </div>
  );
}
