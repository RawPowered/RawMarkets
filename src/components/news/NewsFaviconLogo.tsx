import React, { useState } from "react";
import { googleFaviconUrl } from "../../lib/symbolDomains";

export type NewsFaviconSize = "xs" | "sm";

const SIZE_CLASS: Record<NewsFaviconSize, string> = {
  xs: "w-6 h-6 rounded-md",
  sm: "w-8 h-8 rounded-lg",
};

interface NewsFaviconLogoProps {
  domain: string | null | undefined;
  label: string;
  size?: NewsFaviconSize;
  title?: string;
  ringClass?: string;
}

export default function NewsFaviconLogo({
  domain,
  label,
  size = "sm",
  title,
  ringClass = "ring-2 ring-white",
}: NewsFaviconLogoProps) {
  const [failed, setFailed] = useState(false);
  const showImg = domain && !failed;
  const initials = label
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`relative shrink-0 flex items-center justify-center overflow-hidden border border-[#E5E8EB] bg-white shadow-sm ${SIZE_CLASS[size]} ${ringClass}`}
      title={title ?? label}
    >
      {showImg ? (
        <img
          src={googleFaviconUrl(domain, 64)}
          alt=""
          width={size === "sm" ? 32 : 24}
          height={size === "sm" ? 32 : 24}
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="w-[70%] h-[70%] object-contain"
        />
      ) : (
        <span className="text-[8px] font-extrabold text-[#86868B] font-mono">
          {initials || "?"}
        </span>
      )}
    </div>
  );
}
