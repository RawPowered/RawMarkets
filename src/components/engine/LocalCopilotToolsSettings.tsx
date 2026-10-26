import React from "react";
import { Bot } from "lucide-react";
import type { EngineSettingsShape } from "../../lib/engineSettings";

interface LocalCopilotToolsSettingsProps {
  settings: EngineSettingsShape;
  hasSerpApiKey?: boolean;
  onUpdate: (patch: Partial<EngineSettingsShape>) => void;
  onCommit?: (patch: Partial<EngineSettingsShape>) => void | Promise<void>;
}

export default function LocalCopilotToolsSettings({
  settings,
  hasSerpApiKey = false,
  onUpdate,
  onCommit,
}: LocalCopilotToolsSettingsProps) {
  return (
    <div className="bg-white border border-[#E5E8EB] shadow-sm rounded-[32px] p-6 md:p-8 space-y-4">
      <div className="flex items-start gap-3 border-b border-[#E5E8EB] pb-4">
        <span className="p-2.5 bg-[#F0F7FF] text-[#007AFF] rounded-2xl">
          <Bot size={18} />
        </span>
        <div className="flex-1">
          <h3 className="text-base font-bold text-[#1D1D1F] tracking-tight">
            Local Copilot research tools
          </h3>
          <p className="text-xs text-[#86868B] mt-0.5 leading-relaxed max-w-xl">
            Cached news search, background page reads, optional SerpApi
            news search, and Reader tabs for sources you want to open in-app.
          </p>
        </div>
        <label className="flex items-center gap-2 shrink-0 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.aiLocalToolsEnabled}
            onChange={(e) => {
              const enabled = e.target.checked;
              onUpdate({ aiLocalToolsEnabled: enabled });
              void onCommit?.({ aiLocalToolsEnabled: enabled });
            }}
            className="accent-[#007AFF] w-4 h-4"
          />
          <span className="text-xs font-bold text-[#1D1D1F]">Enabled</span>
        </label>
      </div>

      {settings.aiLocalToolsEnabled && (
        <>
          <ul className="text-[10px] text-[#86868B] space-y-1 font-mono leading-relaxed">
            <li>
              <span className="text-[#1D1D1F] font-bold">News cache</span> — stored
              News Bay / RSS headlines
            </li>
            <li>
              <span className="text-[#1D1D1F] font-bold">Page reader</span> —
              background reads of article URLs you request
            </li>
            <li>
              <span className="text-[#1D1D1F] font-bold">Reader tab</span> —
              in-app browser drawer (user-visible, not scraping)
            </li>
            <li>
              <span className="text-[#1D1D1F] font-bold">SerpApi</span> — live
              Google News when toggled below + API key
            </li>
          </ul>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <label className="text-[10px] font-mono font-bold uppercase text-[#86868B]">
                Max tool rounds
              </label>
              <input
                type="number"
                min={1}
                max={8}
                value={settings.aiLocalToolsMaxRounds}
                onChange={(e) =>
                  onUpdate({
                    aiLocalToolsMaxRounds: Math.max(
                      1,
                      Math.min(8, Math.round(Number(e.target.value) || 4))
                    ),
                  })
                }
                className="w-16 text-xs font-mono border border-[#E5E8EB] rounded-lg px-2 py-1"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.aiLocalSerpEnabled}
                onChange={(e) => {
                  const on = e.target.checked;
                  onUpdate({ aiLocalSerpEnabled: on });
                  void onCommit?.({ aiLocalSerpEnabled: on });
                }}
                className="accent-[#007AFF] w-4 h-4"
              />
              <span className="text-xs font-bold text-[#1D1D1F]">
                SerpApi for Copilot
              </span>
            </label>
          </div>

          {settings.aiLocalSerpEnabled && !hasSerpApiKey && (
            <p className="text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              SerpApi toggle is on but no API key is configured. Add a key under
              Config → API Keys.
            </p>
          )}
        </>
      )}
    </div>
  );
}
