import React from "react";
import { resolveCommodityIconSrc } from "../lib/commodityIcons";

interface LogoThumbnailProps {
  symbol: string;
  size?: "sm" | "md" | "lg";
}

export function LogoThumbnail({ symbol, size = "md" }: LogoThumbnailProps) {
  const commoditySrc = resolveCommodityIconSrc(symbol);
  const sizeClasses = {
    sm: "w-8 h-8 text-[10px] rounded-lg",
    md: "w-11 h-11 text-xs rounded-xl",
    lg: "w-14 h-14 text-base rounded-[20px]"
  };

  const getStyle = (symbolStr: string) => {
    switch (symbolStr) {
      case "GOLD":
        return {
          bg: "bg-gradient-to-br from-amber-300 via-amber-400 to-yellow-600 text-amber-950 font-mono border-amber-200",
          text: "Au",
          label: "99.9"
        };
      case "OIL":
        return {
          bg: "bg-gradient-to-br from-zinc-850 via-zinc-900 to-black text-[#5AC8FA] font-mono border-zinc-750",
          text: "OIL",
          label: "WTI"
        };
      case "BRENT":
        return {
          bg: "bg-gradient-to-br from-[#121c17] via-[#1a2d24] to-black text-[#34C759] font-mono border-emerald-950",
          text: "BRN",
          label: "BRT"
        };
      case "CVX":
        return {
          bg: "bg-gradient-to-br from-blue-700 via-blue-800 to-cyan-600 text-white font-sans border-blue-500",
          text: "CVX",
          label: "GAS"
        };
      case "XOM":
        return {
          bg: "bg-gradient-to-br from-red-600 via-red-700 to-slate-900 text-white font-sans border-red-500",
          text: "XOM",
          label: "PET"
        };
      case "BP":
        return {
          bg: "bg-gradient-to-br from-emerald-600 to-yellow-500 text-white font-sans border-emerald-400",
          text: "BP",
          label: "OIL"
        };
      case "SHEL":
        return {
          bg: "bg-gradient-to-br from-yellow-400 to-red-600 text-amber-950 font-sans border-yellow-300",
          text: "RDS",
          label: "SHL"
        };
      case "SILVER":
        return {
          bg: "bg-gradient-to-br from-slate-100 via-zinc-200 to-gray-400 text-zinc-800 font-mono border-zinc-300",
          text: "Ag",
          label: "99"
        };
      case "COPPER":
        return {
          bg: "bg-gradient-to-br from-orange-400 to-amber-700 text-orange-950 font-mono border-orange-350",
          text: "Cu",
          label: "29"
        };
      case "NTDOY":
        return {
          bg: "bg-gradient-to-br from-red-500 to-rose-700 text-white font-sans border-red-400",
          text: "NIN",
          label: "NTDO"
        };
      case "NVDA":
        return {
          bg: "bg-gradient-to-br from-[#121212] via-[#76B900] to-black text-white font-sans border-lime-500",
          text: "NVD",
          label: "AI"
        };
      case "GOOGL":
        return {
          bg: "bg-gradient-to-br from-blue-500 via-red-500 to-rose-600 text-white font-sans border-blue-400",
          text: "GOG",
          label: "GEMN"
        };
      case "META":
        return {
          bg: "bg-gradient-to-br from-[#0668E1] to-[#04429E] text-white font-sans border-sky-400",
          text: "MTA",
          label: "LLMA"
        };
      case "TSLA":
        return {
          bg: "bg-gradient-to-br from-red-600 via-zinc-900 to-black text-white font-sans border-red-500",
          text: "TSL",
          label: "BOT"
        };
      case "SMSN":
        return {
          bg: "bg-gradient-to-br from-zinc-950 via-blue-900 to-blue-950 text-white font-sans border-blue-600",
          text: "SEC",
          label: "MEM"
        };
      case "OPENAI":
        return {
          bg: "bg-gradient-to-br from-emerald-600 via-zinc-900 to-zinc-950 text-white font-sans border-emerald-400",
          text: "GPT",
          label: "OAI"
        };
      case "XAI":
        return {
          bg: "bg-gradient-to-br from-black via-zinc-900 to-black text-white font-sans border-zinc-700",
          text: "XAI",
          label: "GROK"
        };
      case "ANTHROPIC":
        return {
          bg: "bg-gradient-to-br from-[#E0B890] via-neutral-900 to-zinc-950 text-[#E0B890] font-sans border-amber-300",
          text: "ANT",
          label: "CLD"
        };
      case "DIS":
        return {
          bg: "bg-gradient-to-br from-blue-600 to-indigo-800 text-white font-sans border-blue-500",
          text: "DIS",
          label: "WALT"
        };
      case "HAS":
        return {
          bg: "bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-600 text-white font-sans border-purple-400",
          text: "HAS",
          label: "TOY"
        };
      case "TCG-POKE":
        return {
          bg: "bg-gradient-to-b from-red-500 via-yellow-400 to-blue-600 text-white font-serif border-yellow-500/50",
          text: "PKM",
          label: "TCG"
        };
      default:
        return {
          bg: "bg-gradient-to-br from-slate-700 to-zinc-900 text-slate-100 font-mono border-zinc-700",
          text: symbolStr.slice(0, 3),
          label: "IDX"
        };
    }
  };

  const style = getStyle(symbol);

  if (commoditySrc) {
    return (
      <div
        className={`relative flex items-center justify-center shrink-0 overflow-hidden bg-black border border-zinc-800/80 shadow-xs select-none ${sizeClasses[size]}`}
      >
        <img
          src={commoditySrc}
          alt={`${symbol} icon`}
          className="w-full h-full object-contain"
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }

  return (
    <div className={`relative flex flex-col items-center justify-center font-black tracking-tight border shadow-xs select-none overflow-hidden shrink-0 ${sizeClasses[size]} ${style.bg}`}>
      {/* Gloss reflection overlay */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-white/15 skew-y-12 origin-top-left pointer-events-none" />
      <span className="leading-none mt-0.5">{style.text}</span>
      {size !== "sm" && (
        <span className="absolute bottom-1 right-1.5 text-[7px] opacity-75 font-bold font-mono uppercase tracking-widest leading-none">
          {style.label}
        </span>
      )}
    </div>
  );
}
