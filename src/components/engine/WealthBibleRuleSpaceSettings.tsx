import React, { useMemo } from "react";
import { BookOpen } from "lucide-react";
import type { EngineSettingsShape } from "../../lib/engineSettings";
import {
  DEFAULT_ENABLED_WEALTH_BIBLE_RULE_IDS,
  WEALTH_BIBLE_CATEGORY_LABELS,
  WEALTH_BIBLE_CATEGORY_ORDER,
  WEALTH_BIBLE_RULES_BY_CATEGORY,
} from "../../lib/wealthBibleRules";

interface WealthBibleRuleSpaceSettingsProps {
  settings: EngineSettingsShape;
  onUpdate: (patch: Partial<EngineSettingsShape>) => void;
}

function effectiveEnabledIds(settings: EngineSettingsShape): Set<string> {
  if (settings.aiWealthBibleRuleIds.length > 0) {
    return new Set(settings.aiWealthBibleRuleIds);
  }
  return new Set(DEFAULT_ENABLED_WEALTH_BIBLE_RULE_IDS);
}

export default function WealthBibleRuleSpaceSettings({
  settings,
  onUpdate,
}: WealthBibleRuleSpaceSettingsProps) {
  const enabledSet = useMemo<Set<string>>(
    () => effectiveEnabledIds(settings),
    [settings]
  );
  const activeCount = settings.aiWealthBibleEnabled ? enabledSet.size : 0;
  const totalCount = DEFAULT_ENABLED_WEALTH_BIBLE_RULE_IDS.length;

  const persistIds = (next: Set<string>) => {
    onUpdate({ aiWealthBibleRuleIds: [...next] });
  };

  const toggleRule = (id: string) => {
    const next = new Set<string>(enabledSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (next.size === 0) {
      onUpdate({ aiWealthBibleEnabled: false, aiWealthBibleRuleIds: [] });
      return;
    }
    persistIds(next);
  };

  const setCategory = (category: (typeof WEALTH_BIBLE_CATEGORY_ORDER)[number], on: boolean) => {
    const next = new Set<string>(enabledSet);
    for (const rule of WEALTH_BIBLE_RULES_BY_CATEGORY[category]) {
      if (on) next.add(rule.id);
      else next.delete(rule.id);
    }
    if (next.size === 0) {
      onUpdate({ aiWealthBibleEnabled: false, aiWealthBibleRuleIds: [] });
      return;
    }
    persistIds(next);
  };

  return (
    <div className="bg-white border border-[#E5E8EB] shadow-sm rounded-[32px] p-6 md:p-8 space-y-5">
      <div className="flex items-start justify-between gap-4 border-b border-[#E5E8EB] pb-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 bg-emerald-950 text-emerald-400 rounded-2xl">
            <BookOpen size={18} />
          </span>
          <div>
            <h3 className="text-base font-bold text-[#1D1D1F] tracking-tight">
              AI Rule Space — Bible of Wealth
            </h3>
            <p className="text-xs text-[#86868B] mt-0.5 leading-relaxed max-w-xl">
              First principles for Local Copilot. Open the Bible of Wealth page in the
              sidebar to read the full canon.
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 shrink-0 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.aiWealthBibleEnabled}
            onChange={(e) => {
              const on = e.target.checked;
              onUpdate({
                aiWealthBibleEnabled: on,
                aiWealthBibleRuleIds: on
                  ? settings.aiWealthBibleRuleIds.length > 0
                    ? settings.aiWealthBibleRuleIds
                    : [...DEFAULT_ENABLED_WEALTH_BIBLE_RULE_IDS]
                  : [],
              });
            }}
            className="accent-[#007AFF] w-4 h-4"
          />
          <span className="text-xs font-bold text-[#1D1D1F]">Enabled</span>
        </label>
      </div>

      <p className="text-[11px] font-mono text-[#86868B]">
        {settings.aiWealthBibleEnabled
          ? `${activeCount} of ${totalCount} principles active for Local Copilot`
          : "Wealth Bible rules off — Copilot uses platform data only"}
      </p>

      {settings.aiWealthBibleEnabled && (
        <div className="space-y-5 max-h-[420px] overflow-y-auto pr-1">
          {WEALTH_BIBLE_CATEGORY_ORDER.map((category) => {
            const rules = WEALTH_BIBLE_RULES_BY_CATEGORY[category];
            const selected = rules.filter((r) => enabledSet.has(r.id)).length;
            return (
              <div
                key={category}
                className="bg-[#F5F5F7] border border-[#E5E8EB] rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono font-black uppercase tracking-wider text-[#424245]">
                    {WEALTH_BIBLE_CATEGORY_LABELS[category]}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCategory(category, true)}
                      className="text-[9px] font-bold text-[#007AFF] hover:underline"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategory(category, false)}
                      className="text-[9px] font-bold text-[#86868B] hover:underline"
                    >
                      Clear
                    </button>
                    <span className="text-[9px] font-mono text-[#86868B]">
                      {selected}/{rules.length}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  {rules.map((rule) => (
                    <label
                      key={rule.id}
                      className="flex items-start gap-2 cursor-pointer text-left"
                    >
                      <input
                        type="checkbox"
                        checked={enabledSet.has(rule.id)}
                        onChange={() => toggleRule(rule.id)}
                        className="mt-0.5 accent-emerald-600"
                      />
                      <span className="min-w-0">
                        <span className="text-[11px] font-bold text-[#1D1D1F] block">
                          {rule.title}
                        </span>
                        <span className="text-[10px] text-[#86868B] line-clamp-2">
                          {rule.body}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
