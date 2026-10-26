import React, { useState } from "react";
import {
  Bookmark,
  Shield,
  TrendingUp,
  Scale,
  RefreshCw,
  Brain,
  Trees,
  Landmark,
  Target,
  AlertTriangle,
  Rocket,
  Activity,
  BarChart3,
  Lock,
  Flame,
  Skull,
  Zap,
  ArrowRightLeft,
  CircleDollarSign,
  BookOpen,
} from "lucide-react";
import {
  CAPITAL_STACK_DISPLAY,
  EIGHT_LAWS_DISPLAY,
  FLYWHEEL_STEPS_DISPLAY,
  GAMBLER_PILLARS_DISPLAY,
  INVESTOR_PILLARS_DISPLAY,
  SPECULATIVE_DANGERS_DISPLAY,
  WEALTH_DIAGNOSTIC_DISPLAY,
} from "../lib/wealthBibleRules";

const INVESTOR_ICONS: Record<string, typeof Trees> = {
  A: Trees,
  B: Scale,
  C: Target,
  D: Activity,
  E: Brain,
};

const GAMBLER_ICONS: Record<string, typeof Shield> = {
  A: Shield,
  B: AlertTriangle,
  C: Flame,
  D: Skull,
  E: Zap,
};

const LAW_ICONS = [
  Shield,
  Target,
  Trees,
  Landmark,
  RefreshCw,
  AlertTriangle,
  Brain,
  CircleDollarSign,
];

const FLYWHEEL_ICONS = [Shield, Rocket, Activity, BarChart3, ArrowRightLeft];

export default function BibleOfWealth() {
  const [pinnedLaws, setPinnedLaws] = useState<number[]>([]);
  const [answers, setAnswers] = useState<Record<number, boolean>>({});
  const [score, setScore] = useState<number | null>(null);

  const togglePin = (idx: number) => {
    setPinnedLaws((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-[32px] border border-zinc-800 bg-zinc-950 text-zinc-100 p-8 md:p-12 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-violet-500/10 pointer-events-none" />
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-[10px] font-mono font-black uppercase tracking-widest border border-emerald-500/25">
              Build • Preserve • Compound
            </span>
            <span className="text-zinc-600 font-mono text-xs">×</span>
            <span className="px-2.5 py-1 rounded-lg bg-violet-500/15 text-violet-400 text-[10px] font-mono font-black uppercase tracking-widest border border-violet-500/25">
              Survive • Exploit • Adapt
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl font-serif font-bold tracking-tight leading-tight">
            The Bible of Wealth
          </h1>
          <p className="text-sm md:text-base text-zinc-400 leading-relaxed max-w-3xl">
            The ultimate capital canon — architecture meets adaptation. Safe capital is
            protected like an <strong className="text-emerald-400 font-semibold">investor</strong>;
            risk capital is deployed like a{" "}
            <strong className="text-violet-400 font-semibold">disciplined gambler</strong>.
            Sustainable compounding sits at the center.
          </p>

          <div className="flex flex-wrap gap-4 pt-2 text-xs font-mono text-zinc-500">
            <span className="flex items-center gap-1.5">
              <BookOpen size={14} className="text-amber-400" />
              Investor + Gambler synthesis
            </span>
            <span className="text-zinc-700">•</span>
            <span className="flex items-center gap-1.5">
              <RefreshCw size={14} className="text-[#007AFF]" />
              Capital flywheel
            </span>
            <span className="text-zinc-700">•</span>
            <span className="flex items-center gap-1.5">
              <Lock size={14} className="text-emerald-500" />
              8 unbreakable laws
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-4 space-y-4">
          <div className="flex items-center gap-2 px-1">
            <TrendingUp size={16} className="text-emerald-500" />
            <h2 className="text-sm font-extrabold uppercase tracking-widest font-mono text-emerald-700">
              Investor&apos;s Canon
            </h2>
          </div>
          <p className="text-[11px] text-[#86868B] px-1 -mt-2">
            Long-horizon capital architecture
          </p>

          {INVESTOR_PILLARS_DISPLAY.map((p) => {
            const Icon = INVESTOR_ICONS[p.letter] ?? Trees;
            return (
              <div
                key={p.ruleId}
                className="bg-white border border-emerald-200/60 rounded-2xl p-4 space-y-2 hover:border-emerald-300 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <span className="shrink-0 w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center text-xs font-black font-mono">
                    {p.letter}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Icon size={14} className="text-emerald-600 shrink-0" />
                      <h3 className="text-xs font-bold text-[#1D1D1F]">{p.title}</h3>
                    </div>
                    <p className="text-[11px] text-[#86868B] mt-1 leading-relaxed">{p.desc}</p>
                    {p.formula && (
                      <p className="text-[10px] font-mono font-bold text-emerald-700 mt-2 bg-emerald-50 px-2 py-1 rounded-lg inline-block">
                        {p.formula}
                      </p>
                    )}
                    {p.footnote && (
                      <p className="text-[10px] text-zinc-500 mt-1 italic">{p.footnote}</p>
                    )}
                    {p.items && (
                      <ul className="mt-2 space-y-1">
                        {p.items.map((item) => (
                          <li
                            key={item}
                            className="text-[10px] text-[#424245] pl-2 border-l-2 border-emerald-200"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="bg-emerald-950 text-emerald-50 rounded-2xl p-4 border border-emerald-800/50 space-y-3">
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-emerald-400" />
              <span className="text-[10px] font-mono font-black uppercase tracking-wider">
                Long-Horizon Capital Stack
              </span>
            </div>
            {CAPITAL_STACK_DISPLAY.map((row) => (
              <div key={row.ruleId} className="flex justify-between text-[11px] font-mono">
                <span className="text-emerald-200/80">{row.label}</span>
                <span className="font-bold text-emerald-300">{row.pct}</span>
              </div>
            ))}
            <p className="text-[10px] text-emerald-400/80 font-mono pt-2 border-t border-emerald-800/50">
              Preserve power through time
            </p>
          </div>
        </div>

        <div className="xl:col-span-4 space-y-4">
          <div className="flex items-center gap-2 px-1">
            <RefreshCw size={16} className="text-[#007AFF]" />
            <h2 className="text-sm font-extrabold uppercase tracking-widest font-mono text-[#007AFF]">
              The Capital Flywheel
            </h2>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-[28px] p-6 md:p-8 relative overflow-hidden min-h-[420px] flex flex-col justify-center">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
              <div className="w-48 h-48 rounded-full border-2 border-dashed border-zinc-600" />
            </div>

            <p className="text-center text-[10px] font-mono font-black uppercase tracking-[0.2em] text-zinc-500 mb-6 relative">
              Sustainable compounding wealth
            </p>

            <ol className="space-y-3 relative">
              {FLYWHEEL_STEPS_DISPLAY.map((s, i) => {
                const Icon = FLYWHEEL_ICONS[i] ?? Activity;
                const ring =
                  s.theme === "investor"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : s.theme === "gambler"
                      ? "border-violet-500/40 bg-violet-500/10 text-violet-400"
                      : "border-[#007AFF]/40 bg-[#007AFF]/10 text-[#007AFF]";
                return (
                  <li
                    key={s.ruleId}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${ring}`}
                  >
                    <span className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-[10px] font-black font-mono shrink-0">
                      {s.step}
                    </span>
                    <Icon size={16} className="shrink-0" />
                    <span className="text-xs font-bold text-zinc-100">{s.title}</span>
                  </li>
                );
              })}
            </ol>

            <p className="text-[11px] text-zinc-400 text-center leading-relaxed mt-6 relative px-2">
              Wealth compounds fastest when safe capital is protected like an investor and
              risk capital is deployed like a disciplined gambler.
            </p>
            <p className="text-[9px] font-mono font-black uppercase tracking-widest text-center text-zinc-600 mt-4">
              Architecture meets adaptation
            </p>
          </div>
        </div>

        <div className="xl:col-span-4 space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Flame size={16} className="text-violet-500" />
            <h2 className="text-sm font-extrabold uppercase tracking-widest font-mono text-violet-700">
              Gambler&apos;s Canon
            </h2>
          </div>
          <p className="text-[11px] text-[#86868B] px-1 -mt-2">
            Elite risk &amp; behavioral discipline
          </p>

          {GAMBLER_PILLARS_DISPLAY.map((p) => {
            const Icon = GAMBLER_ICONS[p.letter] ?? Shield;
            return (
              <div
                key={p.ruleId}
                className="bg-white border border-violet-200/60 rounded-2xl p-4 space-y-2 hover:border-violet-300 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <span className="shrink-0 w-7 h-7 rounded-lg bg-violet-50 text-violet-700 flex items-center justify-center text-xs font-black font-mono">
                    {p.letter}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Icon size={14} className="text-violet-600 shrink-0" />
                      <h3 className="text-xs font-bold text-[#1D1D1F]">{p.title}</h3>
                    </div>
                    <p className="text-[11px] text-[#86868B] mt-1 leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="bg-violet-950 text-violet-50 rounded-2xl p-4 border border-violet-800/50 space-y-2">
            <span className="text-[10px] font-mono font-black uppercase tracking-wider text-violet-300 block">
              Speculative market dangers
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SPECULATIVE_DANGERS_DISPLAY.map((d) => (
                <span
                  key={d.ruleId}
                  className="text-[9px] font-mono font-bold px-2 py-1 rounded-lg bg-violet-900/80 border border-violet-700/50 text-violet-200"
                >
                  {d.label}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-rose-300/90 font-mono pt-2 border-t border-violet-800/50">
              Uncontrolled risk, leverage, and emotion destroy capital.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1D1D1F] tracking-tight">
            The 8 Unbreakable Laws
          </h2>
          <span className="text-xs font-mono bg-[#F5F5F7] border px-2.5 py-1 rounded-full text-zinc-600 font-bold">
            {pinnedLaws.length} pinned
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {EIGHT_LAWS_DISPLAY.map((law, idx) => {
            const Icon = LAW_ICONS[idx] ?? Shield;
            const pinned = pinnedLaws.includes(idx);
            return (
              <div
                key={law.ruleId}
                className={`bg-white border rounded-2xl p-4 relative group transition-all ${
                  pinned
                    ? "border-amber-400 ring-2 ring-amber-400/10 shadow-md"
                    : "border-[#E5E8EB] hover:border-[#86868B]/60"
                }`}
              >
                <button
                  type="button"
                  onClick={() => togglePin(idx)}
                  className={`absolute top-3 right-3 p-1.5 rounded-lg transition-all ${
                    pinned
                      ? "bg-amber-100 text-amber-700"
                      : "bg-zinc-100 text-zinc-400 opacity-40 group-hover:opacity-100"
                  }`}
                  title="Pin law"
                >
                  <Bookmark size={12} className={pinned ? "fill-amber-600" : ""} />
                </button>
                <span className="text-[10px] font-mono font-black text-zinc-400">
                  {String(law.n).padStart(2, "0")}
                </span>
                <div className="flex items-center gap-2 mt-2 pr-8">
                  <Icon size={16} className="text-[#007AFF] shrink-0" />
                  <h3 className="text-xs font-extrabold text-[#1D1D1F]">{law.title}</h3>
                </div>
                <p className="text-[11px] text-[#86868B] mt-2 leading-relaxed">{law.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-[#E5E8EB] rounded-[32px] p-6 md:p-8 space-y-6 shadow-xs">
        <div className="border-b border-[#E5E8EB] pb-4">
          <span className="text-[9px] font-mono font-black uppercase tracking-widest text-[#007AFF]">
            Unified diagnostic
          </span>
          <h3 className="text-base font-extrabold text-[#1D1D1F] mt-1">
            Wealth Architecture Adherence
          </h3>
          <p className="text-xs text-[#86868B] mt-1">
            Audit whether you are protecting like an investor and deploying like a disciplined
            gambler.
          </p>
        </div>

        <div className="space-y-2">
          {WEALTH_DIAGNOSTIC_DISPLAY.map((q) => (
            <button
              key={q.ruleId}
              type="button"
              onClick={() =>
                setAnswers((prev) => ({ ...prev, [q.idx]: !prev[q.idx] }))
              }
              className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${
                answers[q.idx]
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-[#F5F5F7] border-[#E5E8EB] text-[#424245] hover:bg-white"
              }`}
            >
              {answers[q.idx] ? "✓ " : ""}
              {q.text}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() =>
              setScore(Object.values(answers).filter(Boolean).length)
            }
            className="px-5 py-2.5 bg-[#1D1D1F] text-white text-xs font-bold rounded-xl hover:bg-zinc-800"
          >
            Calculate index
          </button>
          {score !== null && (
            <p className="text-sm font-mono font-bold">
              <span
                className={
                  score >= 6 ? "text-emerald-600" : score >= 4 ? "text-amber-600" : "text-rose-600"
                }
              >
                {score}/8
              </span>
              <span className="text-[#86868B] font-normal ml-2">
                {score >= 6
                  ? "Flywheel aligned — compound with discipline."
                  : score >= 4
                    ? "Mixed — tighten core protection and sizing rules."
                    : "At risk — revisit both canons before deploying capital."}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
