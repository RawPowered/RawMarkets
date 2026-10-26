import React, { useState } from "react";
import {
  Bookmark,
  Sparkles,
  AlertCircle,
  Scale,
  Zap,
  Skull,
  Target,
  BarChart3,
  Brain,
  Layers,
  Flame,
} from "lucide-react";

const TEN_COMMANDMENTS = [
  {
    law: "I",
    title: "Thou Shalt Worship Expected Value",
    desc: "If the math does not guarantee a positive return over infinite iterations, no amount of gut feeling justifies the entry.",
  },
  {
    law: "II",
    title: "Thou Shalt Calculate the Kelly",
    desc: "Never expose capital randomly. Sizing is dictated solely by the probability of the edge and the payout ratio.",
  },
  {
    law: "III",
    title: "Thou Shalt Ruthlessly Cut Losers",
    desc: "A breached invalidation level requires immediate, emotionless execution. Hope is a psychological defect.",
  },
  {
    law: "IV",
    title: "Thou Shalt Press Winners to the Throat",
    desc: "When the skew is violently in your favor, compound the position. Fat tails generate the entirety of the outperformance.",
  },
  {
    law: "V",
    title: "Thou Shalt Exploit the Herd",
    desc: "When the 90% panic, provide liquidity at a massive premium. When they are euphoric, distribute your bags into their greed.",
  },
  {
    law: "VI",
    title: "Capital Preservation Above All",
    desc: "Return ON capital is irrelevant if there is no return OF capital. Survival allows you to play the next hand.",
  },
  {
    law: "VII",
    title: "Trade the Probability, Not the Outcome",
    desc: "You can make a perfect mathematical decision and still lose the hand. Judge yourself on the execution of the process, not the variance of a single event.",
  },
  {
    law: "VIII",
    title: "Understand Macro, Execute Micro",
    desc: "Systemic liquidity dictates the ocean currents; quantitative execution navigates the waves. Know both.",
  },
  {
    law: "IX",
    title: "Variance is a Tax on the Weak",
    desc: "Drawdowns will happen. The weak fold and abandon their system; the strong use it as proof that the underlying probabilities are resetting.",
  },
  {
    law: "X",
    title: "Stay Liquid, Stay Lethal",
    desc: "Illiquidity is the death of agency. Maintain cash reserves to deploy when blood is in the streets and asymmetric opportunities manifest.",
  },
];

const TEN_SINS = [
  {
    sin: "01.",
    title: "The Revenge Trade",
    desc: 'Forcing a setup immediately after a loss to "win it back." Pure emotion, zero math.',
  },
  {
    sin: "02.",
    title: "Over-Leverage",
    desc: "Using margin to amplify a weak edge. It amplifies the speed of ruin exponentially.",
  },
  {
    sin: "03.",
    title: "Marrying a Thesis",
    desc: "Ignoring new data because it contradicts your original bias. The market doesn't care about your ego.",
  },
  {
    sin: "04.",
    title: "Ignoring the Rake",
    desc: "Failing to calculate fees, slippage, and taxes. A positive gross EV can be a negative net EV.",
  },
  {
    sin: "05.",
    title: "Emotional Sizing",
    desc: 'Betting larger because you "feel lucky" or smaller out of fear. A direct violation of Kelly.',
  },
  {
    sin: "06.",
    title: "Averaging Down",
    desc: "Adding capital to a losing position to improve average cost. Throwing good money after bad.",
  },
  {
    sin: "07.",
    title: "Boredom Trading",
    desc: "Executing sub-optimal setups simply for the dopamine hit of being in the market.",
  },
  {
    sin: "08.",
    title: "Mistaking Luck",
    desc: "Attributing a win in a negative EV situation to skill. Reinforces behaviors that guarantee eventual ruin.",
  },
  {
    sin: "09.",
    title: "FOMO Execution",
    desc: "Buying the top of a parabolic move because others are profiting. Buying others' exit liquidity.",
  },
  {
    sin: "10.",
    title: "No Exit Plan",
    desc: "Entering without defined take-profit and stop-loss levels. Leaving the exit to emotional whim.",
  },
];

const PROTOCOL_STEPS = [
  "Extract performance metrics from N ≥ 100 trials",
  "Compute true edge: b = avg_win / avg_loss",
  "Solve Kelly fractional risk: f* = (bp − q) / b",
  "Scale risk to buffer ceiling: 0.25 × f* (Quarter-Kelly cap)",
  "Implement strict, continuous 50/50 rebalancing",
  "Pause and recalibrate when drawdown threshold is met",
];

const creedDiagnosticQuestions = [
  "I only enter when expected value is positive — never on gut feel alone. (I)",
  "I size every position with Kelly from edge probability and payout ratio. (II)",
  "I exit immediately when invalidation breaks — no hope-holding. (III)",
  "I press winners when skew is in my favor, within defined risk limits. (IV)",
  "I buy panic and distribute into euphoria — I do not chase the herd. (V)",
  "I prioritize return OF capital; survival before aggressive optimization. (VI)",
  "I judge myself on process quality, not the outcome of a single trade. (VII)",
  "I read macro liquidity while executing micro rules mechanically. (VIII)",
  "I stay in my system through drawdowns without revenge or boredom trades. (IX)",
  "I keep cash dry powder for asymmetric opportunities in dislocations. (X)",
];

export default function GamblersBible() {
  const [adherenceAnswers, setAdherenceAnswers] = useState<Record<number, boolean>>({});
  const [score, setScore] = useState<number | null>(null);
  const [pinnedLaws, setPinnedLaws] = useState<number[]>([]);
  const [showSins, setShowSins] = useState(true);

  const handleToggleAnswer = (index: number) => {
    setAdherenceAnswers((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleCalculateScore = () => {
    const positiveCount = Object.values(adherenceAnswers).filter((v) => v === true).length;
    setScore(positiveCount);
  };

  const handleTogglePinLaw = (idx: number) => {
    setPinnedLaws((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  return (
    <div className="space-y-8">
      <div className="bg-white border border-[#E5E8EB] p-8 md:p-12 rounded-[32px] relative overflow-hidden shadow-xs">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-violet-500/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-48 h-48 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-3xl space-y-4 relative">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-zinc-950 text-violet-400 rounded-xl flex items-center justify-center font-mono text-xs">
              <Flame size={16} />
            </span>
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#86868B] font-mono">
              Quantitative Risk Canon
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-serif font-bold text-[#1D1D1F] tracking-tight leading-tight">
            The Gambler&apos;s Bible
          </h1>

          <p className="text-sm text-[#424245] leading-relaxed">
            Elite speculation in high-beta markets — equities, options, digital assets, and
            collectibles — is governed by ergodic survival, fractional Kelly sizing, volatility
            harvesting, reflexivity, and behavioral arbitrage. Roughly 10% of traders execute 85% of
            volume by treating markets as non-ergodic landscapes, not directional lotteries.
          </p>

          <div className="flex flex-wrap gap-4 pt-2 text-xs font-mono font-medium text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Scale size={14} className="text-violet-500" />
              Kelly &amp; Ergodicity
            </span>
            <span className="text-zinc-300">•</span>
            <span className="flex items-center gap-1.5">
              <Zap size={14} className="text-rose-500" />
              10 Commandments
            </span>
            <span className="text-zinc-300">•</span>
            <span className="flex items-center gap-1.5">
              <Skull size={14} className="text-zinc-600" />
              10 Fatal Sins
            </span>
          </div>
        </div>
      </div>

      <div className="bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-[24px] p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-violet-400" />
          <h2 className="text-sm font-extrabold tracking-tight uppercase font-mono text-violet-300">
            Quantitative Risk Protocol
          </h2>
        </div>
        <ol className="space-y-2 font-mono text-xs">
          {PROTOCOL_STEPS.map((step, i) => (
            <li key={i} className="flex gap-3 text-zinc-300">
              <span className="text-violet-400 font-black shrink-0">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="text-[10px] text-zinc-500 font-mono pt-2 border-t border-zinc-800">
          f* = (bp − q) / b · geometric growth ≈ arithmetic mean − ½σ² (volatility drag)
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-lg font-bold text-[#1D1D1F] tracking-tight flex items-center gap-2">
              <Target size={18} className="text-violet-600" />
              The 10 Commandments
            </h2>
            <p className="text-xs text-[#424245] font-medium leading-relaxed max-w-xl">
              The immutable laws of the elite. Break them, and you become liquidity for those who
              don&apos;t.
            </p>
          </div>
          <span className="text-xs font-mono bg-[#F5F5F7] border px-2.5 py-1 rounded-full text-zinc-600 font-bold">
            {pinnedLaws.length} Pinned
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {TEN_COMMANDMENTS.map((item, idx) => {
            const isPinned = pinnedLaws.includes(idx);
            return (
              <div
                key={idx}
                className={`bg-white border rounded-3xl p-6 transition-all duration-200 relative flex flex-col justify-between group ${
                  isPinned
                    ? "border-violet-400 ring-2 ring-violet-400/10 shadow-md"
                    : "border-[#E5E8EB] hover:border-[#86868B]/60 hover:shadow-sm"
                }`}
              >
                <div className="absolute top-6 right-6 flex items-center gap-2 select-none">
                  <span className="text-sm font-serif font-black text-violet-600/80 tabular-nums">
                    {item.law}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleTogglePinLaw(idx)}
                    className={`p-1.5 rounded-lg transition-all ${
                      isPinned
                        ? "bg-violet-100 text-violet-700"
                        : "bg-zinc-100 text-zinc-400 opacity-40 group-hover:opacity-100 hover:text-zinc-700"
                    }`}
                    title="Pin commandment"
                  >
                    <Bookmark size={12} className={isPinned ? "fill-violet-600" : ""} />
                  </button>
                </div>

                <div className="space-y-3.5 pr-14">
                  <h3 className="text-[#1D1D1F] font-extrabold text-sm tracking-tight leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[#424245] leading-relaxed">{item.desc}</p>
                </div>

                <div className="mt-5 pt-4 border-t border-zinc-100/80 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                  <span>ELITE WAGER</span>
                  <span className="text-zinc-300">|</span>
                  <span className="text-violet-600 font-bold">STRUCTURAL EDGE</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setShowSins((v) => !v)}
          className="w-full flex items-center justify-between gap-4 text-left"
        >
          <div className="space-y-0.5">
            <h2 className="text-lg font-bold text-[#1D1D1F] tracking-tight flex items-center gap-2">
              <Skull size={18} className="text-rose-600" />
              The 10 Fatal Sins
            </h2>
            <p className="text-xs text-[#424245] font-medium leading-relaxed max-w-xl">
              The guaranteed pathways to zero. These are the psychological traps that feed the
              bankrolls of the 10%.
            </p>
          </div>
          <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase shrink-0">
            {showSins ? "Collapse" : "Expand"}
          </span>
        </button>

        {showSins && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TEN_SINS.map((item, idx) => (
              <div
                key={idx}
                className="bg-rose-50/30 border border-rose-200/60 rounded-2xl p-5 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-black text-rose-700 uppercase tracking-widest">
                    {item.sin}
                  </span>
                </div>
                <h3 className="text-sm font-extrabold text-[#1D1D1F] tracking-tight">
                  {item.title}
                </h3>
                <p className="text-xs text-[#424245] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-[#E5E8EB] shadow-xs rounded-[32px] p-6 md:p-8 space-y-6">
        <div className="border-b border-[#E5E8EB] pb-5">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-violet-50 text-violet-700 rounded font-mono text-[9px] font-black uppercase tracking-wider">
              interactive
            </span>
            <span className="text-[10px] font-extrabold font-mono text-zinc-500 uppercase tracking-widest">
              risk discipline audit
            </span>
          </div>
          <h3 className="text-base font-extrabold text-[#1D1D1F] mt-1 tracking-tight flex items-center gap-2">
            <Brain size={16} className="text-violet-600" />
            Quantitative Gambler Creed Diagnostic
          </h3>
          <p className="text-xs text-[#86868B]">
            Audit your execution against the Ten Commandments to calculate your Ergodic
            Survivability Index.
          </p>
        </div>

        <div className="space-y-3">
          {creedDiagnosticQuestions.map((q, idx) => {
            const active = adherenceAnswers[idx] || false;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleToggleAnswer(idx)}
                className={`w-full p-4 rounded-2xl text-left border text-xs flex items-center justify-between gap-4 transition-all hover:bg-neutral-50 cursor-pointer ${
                  active
                    ? "bg-violet-50/50 border-violet-300 text-[#1D1D1F]"
                    : "bg-white border-[#E5E8EB] text-[#424245]"
                }`}
              >
                <span className="font-semibold">{q}</span>
                <span
                  className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-all ${
                    active
                      ? "bg-violet-600 border-violet-600 text-white"
                      : "border-zinc-300 bg-white text-transparent"
                  }`}
                >
                  ✓
                </span>
              </button>
            );
          })}
        </div>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-6 bg-[#F5F5F7] p-6 rounded-2xl border border-[#E5E8EB]">
          <div className="space-y-1 text-center sm:text-left">
            <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">
              diagnostic outcome
            </span>
            <p className="text-xs text-[#1D1D1F] font-semibold leading-relaxed max-w-md">
              Measure alignment to fractional Kelly, ergodic survival, and behavioral suppression
              before the next correlation spike or Minsky moment.
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {score !== null && (
              <div className="text-center font-mono">
                <div className="text-2xl font-black text-zinc-950">{score * 10}%</div>
                <div className="text-[9px] font-extrabold uppercase text-zinc-500 tracking-wider">
                  Survivability Index
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleCalculateScore}
              className="px-6 py-2.5 bg-zinc-900 text-white font-bold text-xs rounded-xl hover:bg-zinc-800 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Layers size={13} />
              Evaluate Discipline Score
            </button>
          </div>
        </div>

        {score !== null && (
          <div className="p-4 rounded-xl border border-violet-100 bg-violet-50/50 flex gap-3 text-xs leading-relaxed text-[#1D1D1F]">
            <Sparkles size={16} className="text-violet-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">
                {score >= 8
                  ? "Elite Quant Tier: "
                  : score >= 5
                    ? "Developing Edge: "
                    : "Ruin-Zone Exposure: "}
              </strong>
              {score >= 8
                ? "You operate like the 10%. Worship EV, honor Kelly, cut losers, and stay liquid. Keep auditing for revenge trades and FOMO leaks."
                : score >= 5
                  ? "Edge is forming but sins may still bleed you. Re-read III (cut losers), V (herd), and X (liquidity) — and purge 01, 05, and 09 from your playbook."
                  : "You are liquidity for someone else. Stop revenge trading, emotional sizing, and FOMO entries. Rebuild from Commandment I and VI before sizing up."}
            </div>
          </div>
        )}
      </div>

      <div className="p-6 bg-violet-500/5 border border-violet-500/20 rounded-2xl flex items-start gap-4">
        <AlertCircle size={16} className="text-violet-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="text-[10px] font-extrabold uppercase font-mono tracking-wider text-violet-700 block">
            Speculation risk disclosure
          </span>
          <p className="text-xs text-zinc-600 leading-relaxed">
            This canon synthesizes quantitative finance and behavioral research for educational
            framing only. It is not investment advice, a guarantee of edge, or an endorsement of
            leverage, options, or crypto speculation. Past statistical edges decay; Kelly inputs
            require continuous validation. Consult licensed professionals before risking capital you
            cannot lose entirely.
          </p>
        </div>
      </div>
    </div>
  );
}
