import { ExternalLink } from "lucide-react";
import type { Asset } from "../types";
import { getValidationLink } from "../lib/validationUrls";

interface AssetValidationActionsProps {
  symbol: string;
  category: Asset["category"];
  name?: string;
  variant?: "button" | "icon";
  className?: string;
}

export default function AssetValidationActions({
  symbol,
  category,
  name,
  variant = "button",
  className = "",
}: AssetValidationActionsProps) {
  const link = getValidationLink(symbol, category, name);

  if (!link) {
    if (variant === "icon") {
      return (
        <span
          title="No direct quote page for this symbol"
          className={`inline-flex p-1.5 rounded-lg text-zinc-300 cursor-not-allowed ${className}`}
        >
          <ExternalLink size={14} />
        </span>
      );
    }
    return (
      <button
        type="button"
        disabled
        title="No direct quote page for this symbol"
        className={`px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 bg-zinc-100 border border-zinc-200 cursor-not-allowed ${className}`}
      >
        Validate live quote
      </button>
    );
  }

  if (variant === "icon") {
    return (
      <a
        href={link.url}
        target="_blank"
        rel="noreferrer"
        title={`Validate on ${link.provider}: ${link.label}`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className={`inline-flex p-1.5 rounded-lg text-[#007AFF] hover:bg-[#F0F7FF] border border-transparent hover:border-[#D5E6F7] transition-colors ${className}`}
      >
        <ExternalLink size={14} />
      </a>
    );
  }

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer"
      title={link.label}
      className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#F0F7FF] hover:bg-[#E0EFFF] text-[#007AFF] text-xs font-bold rounded-xl border border-[#D5E6F7] transition-colors shrink-0 ${className}`}
    >
      Validate live quote on {link.provider}
      <ExternalLink size={13} />
    </a>
  );
}
