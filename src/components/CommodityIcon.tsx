import React from "react";
import { resolveCommodityIconSrc } from "../lib/commodityIcons";
import type { SymbolLogoSize } from "./SymbolLogo";

const SIZE_CLASS: Record<SymbolLogoSize, string> = {
  sm: "w-8 h-8 rounded-lg",
  md: "w-11 h-11 rounded-xl",
  lg: "w-14 h-14 rounded-2xl",
  xl: "w-[72px] h-[72px] rounded-[22px]",
};

interface CommodityIconProps {
  symbol: string;
  size?: SymbolLogoSize;
  className?: string;
  alt?: string;
}

export default function CommodityIcon({
  symbol,
  size = "md",
  className = "",
  alt,
}: CommodityIconProps) {
  const src = resolveCommodityIconSrc(symbol);
  if (!src) return null;

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 overflow-hidden bg-black border border-zinc-800/80 shadow-sm ${SIZE_CLASS[size]} ${className}`}
    >
      <img
        src={src}
        alt={alt ?? `${symbol} icon`}
        className="w-full h-full object-contain"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
