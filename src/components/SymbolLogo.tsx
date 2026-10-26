import React, { useEffect, useState } from "react";
import CommodityIcon from "./CommodityIcon";
import { LogoThumbnail } from "./LogoThumbnail";
import { resolveCommodityIconSrc } from "../lib/commodityIcons";
import { googleFaviconUrl, resolveSymbolDomain } from "../lib/symbolDomains";
import { apiFetch, readApiJson } from "../lib/api";

export type SymbolLogoSize = "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<SymbolLogoSize, number> = {
  sm: 32,
  md: 44,
  lg: 56,
  xl: 72,
};

const SIZE_CLASS: Record<SymbolLogoSize, string> = {
  sm: "w-8 h-8 rounded-lg",
  md: "w-11 h-11 rounded-xl",
  lg: "w-14 h-14 rounded-2xl",
  xl: "w-[72px] h-[72px] rounded-[22px]",
};

interface SymbolLogoProps {
  symbol: string;
  size?: SymbolLogoSize;
  /** Tint behind logo (hex) — used for branded cards */
  brandTint?: string;
  className?: string;
  domainOverride?: string;
  /** Fetch domain from server when not in local map */
  resolveRemote?: boolean;
}

export default function SymbolLogo({
  symbol,
  size = "md",
  brandTint,
  className = "",
  domainOverride,
  resolveRemote = true,
}: SymbolLogoProps) {
  const [domain, setDomain] = useState<string | null>(
    () => domainOverride ?? resolveSymbolDomain(symbol)
  );
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
    if (domainOverride) {
      setDomain(domainOverride);
      return;
    }
    const local = resolveSymbolDomain(symbol);
    if (local) {
      setDomain(local);
      return;
    }
    if (!resolveRemote) {
      setDomain(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const resp = await apiFetch(
          `/api/symbol-logo/${encodeURIComponent(symbol.toUpperCase())}`
        );
        if (!resp.ok) return;
        const data = await readApiJson<{ domain?: string }>(resp);
        if (!cancelled && data.domain) setDomain(data.domain);
      } catch {
        /* fallback placeholder */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol, domainOverride, resolveRemote]);

  const px = SIZE_PX[size];
  const faviconSz = size === "xl" || size === "lg" ? 128 : 64;
  const commodityIconSrc = resolveCommodityIconSrc(symbol);
  const showImage = domain && !imgFailed;
  const logoUrl = domain ? googleFaviconUrl(domain, faviconSz) : null;

  if (commodityIconSrc) {
    return (
      <div className={className}>
        <CommodityIcon symbol={symbol} size={size} />
      </div>
    );
  }

  const tintStyle: React.CSSProperties | undefined = brandTint
    ? {
        background: `linear-gradient(145deg, ${brandTint}22 0%, ${brandTint}08 45%, #ffffff 100%)`,
        boxShadow: `0 8px 24px -8px ${brandTint}55`,
      }
    : undefined;

  if (!showImage) {
    return (
      <div className={className}>
        <LogoThumbnail symbol={symbol} size={size === "xl" ? "lg" : size === "lg" ? "md" : "sm"} />
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 overflow-hidden border border-white/80 bg-white shadow-sm ${SIZE_CLASS[size]} ${className}`}
      style={tintStyle}
    >
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          background: brandTint
            ? `radial-gradient(circle at 30% 20%, ${brandTint}, transparent 70%)`
            : undefined,
        }}
      />
      <img
        src={logoUrl!}
        alt={`${symbol} logo`}
        width={px}
        height={px}
        referrerPolicy="no-referrer"
        loading="lazy"
        decoding="async"
        onError={() => setImgFailed(true)}
        className="relative z-[1] w-[72%] h-[72%] object-contain"
      />
    </div>
  );
}
