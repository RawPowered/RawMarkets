import React, { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { ReaderTab } from "../../context/ReaderContext";

interface ReaderViewportProps {
  tab: ReaderTab;
  isActive: boolean;
  refreshNonce: number;
  isElectron: boolean;
}

export default function ReaderViewport({
  tab,
  isActive,
  refreshNonce,
  isElectron,
}: ReaderViewportProps) {
  const webviewRef = useRef<HTMLElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeBlocked, setIframeBlocked] = useState(false);

  useEffect(() => {
    if (tab.previewOnly || !tab.url) return;
    if (isElectron && webviewRef.current) {
      const wv = webviewRef.current as HTMLElement & { reload?: () => void };
      wv.reload?.();
      return;
    }
    if (iframeRef.current) {
      iframeRef.current.src = tab.url;
    }
  }, [refreshNonce, tab.url, tab.previewOnly, isElectron]);

  if (tab.previewOnly) {
    return (
      <div
        className={`absolute inset-0 overflow-y-auto bg-white p-6 ${
          isActive ? "block" : "hidden"
        }`}
      >
        <div className="max-w-xl mx-auto space-y-4">
          <span className="text-[10px] font-mono font-bold text-[#86868B] uppercase">
            Preview only
          </span>
          <h2 className="text-lg font-bold text-[#1D1D1F]">
            {tab.previewTitle ?? tab.title}
          </h2>
          {tab.previewSnippet ? (
            <p className="text-sm text-[#86868B] leading-relaxed">
              {tab.previewSnippet}
            </p>
          ) : null}
          <p className="text-xs text-[#86868B]">
            No direct article URL is available for this simulated item. Clip it to
            your Investors Journal for reference.
          </p>
        </div>
      </div>
    );
  }

  if (!tab.url) {
    return (
      <div
        className={`absolute inset-0 flex items-center justify-center bg-[#F5F5F7] text-xs text-[#86868B] ${
          isActive ? "flex" : "hidden"
        }`}
      >
        Enter a URL above to browse
      </div>
    );
  }

  return (
    <div className={`absolute inset-0 ${isActive ? "block" : "hidden"}`}>
      {isElectron ? (
        React.createElement("webview", {
          ref: webviewRef,
          src: tab.url,
          className: "w-full h-full",
          style: { display: "inline-flex" },
          allowpopups: "true",
        })
      ) : (
        <>
          {iframeBlocked ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 p-6 bg-[#F5F5F7] text-center">
              <p className="text-xs text-[#86868B] max-w-sm">
                This site blocks embedded viewing. Open it externally or use the
                desktop app for full in-app browsing.
              </p>
              <a
                href={tab.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#007AFF]"
              >
                Open externally
                <ExternalLink size={12} />
              </a>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={tab.url}
              title={tab.title}
              className="w-full h-full border-0 bg-white"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              onError={() => setIframeBlocked(true)}
            />
          )}
        </>
      )}
    </div>
  );
}
