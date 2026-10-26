import React from "react";
import SymbolLogo from "../SymbolLogo";
import NewsFaviconLogo from "./NewsFaviconLogo";
import { resolveNewsSourceDomain } from "../../lib/newsSourceDomains";
import type { NewsBayItem, NewsItem } from "../../types";

interface NewsArticleLogosProps {
  item: NewsItem;
  /** Fallback when item has no stockSymbol / matchedSymbols */
  defaultStockSymbol?: string;
  feedId?: string;
}

export default function NewsArticleLogos({
  item,
  defaultStockSymbol,
  feedId,
}: NewsArticleLogosProps) {
  const bay = item as NewsBayItem;
  const stockSymbol =
    item.stockSymbol ??
    (bay.matchedSymbols?.[0]) ??
    defaultStockSymbol;

  const sourceDomain =
    item.sourceDomain ??
    resolveNewsSourceDomain({
      feedId: feedId ?? bay.feedId,
      sourceLabel: item.source,
      articleUrl: item.link,
    });

  if (!stockSymbol && !sourceDomain) return null;

  return (
    <div className="flex items-center gap-0 shrink-0" aria-hidden>
      {stockSymbol ? (
        <div className="relative z-[2]">
          <SymbolLogo symbol={stockSymbol} size="sm" resolveRemote />
        </div>
      ) : null}
      {sourceDomain || item.source ? (
        <div className={stockSymbol ? "-ml-2 relative z-[1]" : ""}>
          <NewsFaviconLogo
            domain={sourceDomain}
            label={item.source}
            size="sm"
            title={item.source}
            ringClass={stockSymbol ? "ring-2 ring-white" : "ring-1 ring-[#E5E8EB]"}
          />
        </div>
      ) : null}
    </div>
  );
}
