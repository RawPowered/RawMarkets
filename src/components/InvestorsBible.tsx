import React, { useState, useEffect } from "react";
import {
  BookOpen,
  ArrowUpRight,
  ShieldCheck,
  Award,
  Compass,
  CheckCircle,
  Bookmark,
  TrendingUp,
  Lock,
  Briefcase,
  AlertCircle,
  RotateCw,
  Sparkles,
  HelpCircle,
  Clock,
  ExternalLink,
  DollarSign
} from "lucide-react";

interface AdvisorFirm {
  name: string;
  domain: string;
  url: string;
  rating: string;
  minAsset: string;
  specialty: string;
  desc: string;
}

const ADVISORY_FIRMS: AdvisorFirm[] = [
  {
    name: "Vanguard Personal Advisor",
    domain: "vanguard.com",
    url: "https://investment-services.vanguard.com/ws/portals/advisor-services/landing.html",
    rating: "5.0 ★ Popular Choice",
    minAsset: "$50,000",
    specialty: "Low-Cost Index Wealth Planning",
    desc: "An industry standard in fiduciary advisory. Combines algorithmic portfolio rebalancing with direct access to physical certified financial planners (CFPs)."
  },
  {
    name: "Charles Schwab Wealth Advisory",
    domain: "schwab.com",
    url: "https://www.schwab.com/wealth-advisory",
    rating: "4.9 ★ Gold Standard",
    minAsset: "$500,000",
    specialty: "Sophisticated Estate & Wealth Framing",
    desc: "Offers highly personalized, comprehensive portfolio building, tax-saving strategies, and direct fixed-income desk routing tailored for family wealth custody."
  },
  {
    name: "Fidelity Wealth Management",
    domain: "fidelity.com",
    url: "https://www.fidelity.com/wealth-management/overview",
    rating: "4.9 ★ Popular Choice",
    minAsset: "$250,000",
    specialty: "Active Discretionary Asset Management",
    desc: "Provides rigorous hands-on advisory services with continuous monitoring, structured hedge options, and multi-generational trust and tax planning services."
  },
  {
    name: "Fisher Investments",
    domain: "fisherinvestments.com",
    url: "https://www.fisherinvestments.com",
    rating: "4.8 ★ Highly rated",
    minAsset: "$500,000",
    specialty: "Global Fee-Only Custom Strategies",
    desc: "A pure fiduciary fee-only discretionary advisor. Built on global macroeconomic research desks to guide long range capital positioning without commission bias."
  }
];

const TEN_LAWS = [
  {
    law: "Law I",
    title: "Maintain Sovereign Liquidity",
    commandment: "Never commit emergency capital to volatile vehicles.",
    desc: "Always maintain 6 to 12 months of high-yield liquid cash or physical precious metals reserves. Do not let short-term living obligations force you to liquidate long-range asset index positions during market corrections."
  },
  {
    law: "Law II",
    title: "Honor Cumulative Compound Growth",
    commandment: "Treat time in the market as superior to timing the market.",
    desc: "The true engine of abundance is time multiplied by consistent compounding interest. Avoid short-term options bets; instead, hold solid dividend-paying entities and physical-backed indexes for sequential decades."
  },
  {
    law: "Law III",
    title: "Distrust the Daily Hype Machine",
    commandment: "Muffle media sirens and high-frequency news channels.",
    desc: "Financial news corporations generate revenue through engagement, panic, and hysteria. Extreme price fluctuations are often noise. Establish your investment manifesto, automate transactions, and close the ticker stream."
  },
  {
    law: "Law IV",
    title: "Leverage Multi-Asset Separation",
    commandment: "Do not secure all keys inside a single digital ledger.",
    desc: "Hedge across unrelated macroeconomic pillars: physical sovereign precious metals, foundational industrial equities (like steel and bank giants), digital computational networks, energy reserves, and real land assets."
  },
  {
    law: "Law V",
    title: "Systematize Dollar-Cost Averaging",
    commandment: "Automate your accumulation schedules cleanly.",
    desc: "Commit an identical financial sum on a rigid recurring window (e.g., monthly) regardless of price swings. This mathematically enforces buying more shares when assets are cheap, and fewer shares when they are costly."
  },
  {
    law: "Law VI",
    title: "Muffle Expense Arbitrage and Fees",
    commandment: "Guard your baseline capital against premium tolls.",
    desc: "Every fraction of a percent paid to active portfolio managers or commission-heavy brokerages acts as a leaky bucket. Prioritize index ETFs with expense ratios below 0.15% to defend compounding trajectories."
  },
  {
    law: "Law VII",
    title: "Enforce a Minimum Holding Horizon",
    commandment: "Classify purchase coordinates in multi-year blocks.",
    desc: "Never purchase an equity asset unless you are psychologically prepared to hold it continuously for five years. High-frequency impulse trading burns capital on spreads, transaction slippage, and immediate taxation."
  },
  {
    law: "Law VIII",
    title: "Invest Exclusively in Known Engines",
    commandment: "If you cannot explain the business on a napkin, pass.",
    desc: "Do not buy arcane multi-tier derivative contracts, speculative pop-culture tokens and hyped IPOs simply because the price is ascending. Understand what commodities, services, or earnings power the backend asset. "
  },
  {
    law: "Law IX",
    title: "Treat Hedging purely as Insurance",
    commandment: "Precious metals protect wealth; they do not generate yield.",
    desc: "Physical Gold (Au) and Silver (Ag) represent ultimate sound money, but they do not harbor factories or print dividends. Treat physical bullion as a capital defense barrier against currency debasement, not a speculative rocket."
  },
  {
    law: "Law X",
    title: "Tame Your Twin Adversaries: Fear & Greed",
    commandment: "Be fearful when others are greedy, and greedy when others are fearful.",
    desc: "The hardest line of investment is self-discipline. Extreme euphoria precedes severe liquidity crises, and absolute despair creates deep discount buying coordinates. Formulate fixed limits and abide by them mechanically."
  }
];

export default function InvestorsBible() {
  // Checklist Interactive state
  const [adherenceAnswers, setAdherenceAnswers] = useState<Record<number, boolean>>({});
  const [score, setScore] = useState<number | null>(null);
  const [readingProgress, setReadingProgress] = useState(0);
  const [pinnedLaws, setPinnedLaws] = useState<number[]>([]);

  // Calculate read progress metric as user scrolls or clicks on tabs
  const handleToggleAnswer = (index: number) => {
    setAdherenceAnswers(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleCalculateScore = () => {
    // Count how many "True" answers (adherence answers representing solid habits)
    const positiveCount = Object.values(adherenceAnswers).filter(v => v === true).length;
    setScore(positiveCount);
  };

  const handleTogglePinLaw = (idx: number) => {
    setPinnedLaws(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  // Pre-populate checklist if empty
  const lawsDiagnosticQuestions = [
    "I have at least 6 months of living expenses secured in highly stable liquid buffers or physical metals. (Law 1)",
    "I focus on long-term compound indexes rather than day-trading or high-risk leverage. (Law 2)",
    "I do not panic or execute rash trades when the global markets undergo standard corrections. (Law 3)",
    "My wealth is distributed across multiple distinct silos (metals, equities, index ETFs). (Law 4)",
    "I use a programmatic plan to buy assets automatically at steady regular intervals. (Law 5)",
    "I actively review and choose funds with low expense ratios and minimal broker commissions. (Law 6)",
    "My average intended holding period for any single stock or core ETF is 3+ years. (Law 7)",
    "I fully comprehend how each asset in my portfolio generates its underlying revenue. (Law 8)",
    "I view physical gold and silver as sound-money defense, not as a rapid speculative play. (Law 9)",
    "I follow written systematic limits instead of responding emotionally to hype, FOMO, or fear. (Law 10)"
  ];

  return (
    <div className="space-y-8">

      {/* Editorial Title Banner with Book Accent */}
      <div className="bg-white border border-[#E5E8EB] p-8 md:p-12 rounded-[32px] relative overflow-hidden shadow-xs">
        {/* Ambient aesthetic shape */}
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-3xl space-y-4">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-zinc-950 text-amber-400 rounded-xl flex items-center justify-center font-mono text-xs">
              <BookOpen size={16} />
            </span>
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#86868B] font-mono">
              The Golden Canonical Textbook
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-serif font-bold text-[#1D1D1F] tracking-tight leading-tight">
            The Investors Bible
          </h1>

          <p className="text-sm text-[#424245] leading-relaxed">
            Compiled from centuries of macroeconomic history, index mutual structures, and physical gold market behaviors. This document presents the definitive principles for surviving systemic inflations and compounding generational abundance.
          </p>

          <div className="flex flex-wrap gap-4 pt-2 text-xs font-mono font-medium text-zinc-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-500" />
              Sovereign Sound-Money Principles
            </span>
            <span className="text-zinc-300">•</span>
            <span className="flex items-center gap-1.5">
              <Award size={14} className="text-amber-500" />
              10 Immutable Commandment Laws
            </span>
            <span className="text-zinc-300">•</span>
            <span className="flex items-center gap-1.5">
              <Clock size={14} className="text-[#007AFF]" />
              Immutable Horizon Focus
            </span>
          </div>
        </div>
      </div>

      {/* Ten Laws Grid with elegant bookmarking interaction */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-lg font-bold text-[#1D1D1F] tracking-tight flex items-center gap-2">
              <Compass size={18} className="text-[#1D1D1F]" />
              The X Commandment Laws
            </h2>
            <p className="text-xs text-[#86868B]">
              Absorb each law carefully. Pin important tenets to highlight them in local view focus.
            </p>
          </div>
          <span className="text-xs font-mono bg-[#F5F5F7] border px-2.5 py-1 rounded-full text-zinc-600 font-bold">
            {pinnedLaws.length} Tenets Highlighted
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {TEN_LAWS.map((item, idx) => {
            const isPinned = pinnedLaws.includes(idx);
            return (
              <div
                key={idx}
                className={`bg-white border rounded-3xl p-6 transition-all duration-200 relative flex flex-col justify-between group ${
                  isPinned
                    ? "border-amber-400 ring-2 ring-amber-400/5 shadow-md"
                    : "border-[#E5E8EB] hover:border-[#86868B]/60 hover:shadow-sm"
                }`}
              >
                {/* Law index float badge */}
                <div className="absolute top-6 right-6 flex items-center gap-2 select-none">
                  <span className="text-[10px] font-mono font-black tracking-widest text-[#86868B] uppercase">
                    {item.law}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleTogglePinLaw(idx)}
                    className={`p-1.5 rounded-lg transition-all ${
                      isPinned
                        ? "bg-amber-100 text-amber-700"
                        : "bg-zinc-100 text-zinc-400 opacity-40 group-hover:opacity-100 hover:text-zinc-700"
                    }`}
                    title="Highlight Law"
                  >
                    <Bookmark size={12} className={isPinned ? "fill-amber-600" : ""} />
                  </button>
                </div>

                <div className="space-y-3.5 pr-14">
                  <h3 className="text-[#1D1D1F] font-extrabold text-sm tracking-tight flex items-center gap-2">
                    {item.title}
                  </h3>

                  <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl leading-relaxed">
                    <p className="text-[11px] font-sans font-bold text-zinc-700 italic">
                      “{item.commandment}”
                    </p>
                  </div>

                  <p className="text-xs text-[#424245] leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                {/* Micro badge of classification */}
                <div className="mt-5 pt-4 border-t border-zinc-100/80 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                  <span>DISCIPLE HABIT</span>
                  <span className="text-zinc-300">|</span>
                  <span className="text-[#007AFF] font-bold">SECURE ACCUMULATION</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Adherence Diagnostic Tool */}
      <div className="bg-white border border-[#E5E8EB] shadow-xs rounded-[32px] p-6 md:p-8 space-y-6">
        <div className="border-b border-[#E5E8EB] pb-5">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-[#F0F7FF] text-[#007AFF] rounded font-mono text-[9px] font-black uppercase tracking-wider">
              interactive
            </span>
            <span className="text-[10px] font-extrabold font-mono text-zinc-500 uppercase tracking-widest">
              diagnostic audit
            </span>
          </div>
          <h3 className="text-base font-extrabold text-[#1D1D1F] mt-1 tracking-tight">
            Investor Creed Adherence Diagnostic
          </h3>
          <p className="text-xs text-[#86868B]">
            Truthfully audit your investment strategy against the 10 Immutable Laws to calculate your Portfolio Survivability Index.
          </p>
        </div>

        {/* List of questions to toggle */}
        <div className="space-y-3">
          {lawsDiagnosticQuestions.map((q, idx) => {
            const active = adherenceAnswers[idx] || false;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleToggleAnswer(idx)}
                className={`w-full p-4 rounded-2xl text-left border text-xs flex items-center justify-between gap-4 transition-all hover:bg-neutral-50 cursor-pointer ${
                  active
                    ? "bg-emerald-50/45 border-emerald-300 text-[#1D1D1F]"
                    : "bg-white border-[#E5E8EB] text-[#424245]"
                }`}
              >
                <span className="font-semibold">{q}</span>
                <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-all ${
                  active
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : "border-zinc-300 bg-white text-transparent"
                }`}>
                  ✓
                </span>
              </button>
            );
          })}
        </div>

        {/* Scoring execution element */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-6 bg-[#F5F5F7] p-6 rounded-2xl border border-[#E5E8EB]">
          <div className="space-y-1 text-center sm:text-left">
            <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">
              diagnostic outcome
            </span>
            <p className="text-xs text-[#1D1D1F] font-semibold leading-relaxed max-w-md">
              Calculate your mathematical alignment to raw capital preserving metrics before the next macroeconomic correction event.
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {score !== null && (
              <div className="text-center font-mono">
                <div className="text-2xl font-black text-zinc-950">
                  {score * 10}%
                </div>
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
              <TrendingUp size={13} />
              Evaluate Adherence Score
            </button>
          </div>
        </div>

        {/* Feedback message according to score level */}
        {score !== null && (
          <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 flex gap-3 text-xs leading-relaxed text-[#1D1D1F]">
            <Sparkles size={16} className="text-[#007AFF] shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">
                {score >= 8
                  ? "Sovereign Tier Capital Guardian: "
                  : score >= 5
                    ? "Prudent Accumulator: "
                    : "Speculative Danger exposure: "
                }
              </strong>
              {score >= 8
                ? "Excellent self-discipline. You have fortified your wealth structure against sudden devaluations and emotional traps. Keep backing positions mechanically."
                : score >= 5
                  ? "Reasonable alignment, but there are structural leakages. Consider re-evaluating your liquid emergency reserves or passive holding timelines to guard against market panics."
                  : "Caution. Your current style exposes you to extreme tail risk and speculative volatility shocks. Align closer with Laws I, IV, and VII to defend your base assets."
              }
            </div>
          </div>
        )}
      </div>

      {/* Advisory firms with Favicon Extraction */}
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-[#1D1D1F] tracking-tight flex items-center gap-2">
            <Award size={18} className="text-amber-500" />
            Vetted Professional Advisory Frameworks
          </h2>
          <p className="text-xs text-[#86868B]">
            These firms manage multi-billion portfolios. Note that these are not endorsements or affiliations, but suggested results curated by popular choices of high net worth investors.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ADVISORY_FIRMS.map((firm) => {
            const faviconSecureUrl = `https://www.google.com/s2/favicons?domain=${firm.domain}&sz=64`;
            return (
              <div
                key={firm.name}
                className="bg-white border border-[#E5E8EB] hover:border-[#86868B]/80 hover:shadow-xs rounded-3xl p-6 transition-all flex flex-col justify-between"
              >
                <div className="space-y-4">

                  {/* Top Header Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-200/80 p-1.5 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
                        <img
                          src={faviconSecureUrl}
                          alt={`${firm.name} Brand Icon`}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=64&auto=format&fit=crop&q=60`;
                          }}
                          className="w-full h-full object-contain rounded-md"
                        />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-[#1D1D1F] leading-tight">
                          {firm.name}
                        </h4>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {firm.domain}
                        </span>
                      </div>
                    </div>

                    <span className="bg-amber-500/10 text-amber-800 text-[9px] font-black uppercase font-mono px-2 py-0.5 rounded-full">
                      {firm.rating}
                    </span>
                  </div>

                  {/* Details stats lists */}
                  <div className="grid grid-cols-2 gap-3 p-3 bg-[#F5F5F7] rounded-xl border border-zinc-200/50 font-mono text-[10px]">
                    <div>
                      <span className="block text-zinc-400 uppercase tracking-wider">Advisory Specialty:</span>
                      <strong className="block text-zinc-800 font-extrabold mt-0.5">{firm.specialty}</strong>
                    </div>
                    <div>
                      <span className="block text-zinc-400 uppercase tracking-wider">Advisor Min Investment:</span>
                      <strong className="block text-zinc-800 font-extrabold mt-0.5">{firm.minAsset}</strong>
                    </div>
                  </div>

                  <p className="text-xs text-[#424245] leading-relaxed">
                    {firm.desc}
                  </p>

                </div>

                <div className="mt-5 pt-4 border-t border-zinc-100 flex items-center justify-between">
                  <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
                    SECURED PORTAL LINK
                  </span>

                  <a
                    href={firm.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-[10px] font-extrabold font-mono tracking-wider flex items-center gap-1.5 cursor-pointer select-none transition-all"
                  >
                    VISIT DESK
                    <ArrowUpRight size={11} />
                  </a>
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* Advisory Neutral Disclaimer */}
      <div className="p-6 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex items-start gap-4">
        <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="text-[10px] font-extrabold uppercase font-mono tracking-wider text-amber-700 block">
            Disclaimer regarding advisory curations
          </span>
          <p className="text-xs text-zinc-600 leading-relaxed">
            The firm references displayed above do not constitute formal commercial endorsements, payment partnerships, or certified recommendations by the Raw Investor development staff. They represent popular choice outcomes of the broader investment community for high reputational score fiduciaries. Investors are strictly reminded to consult native certified legal and CPA professionals prior to allocating high capital sums.
          </p>
        </div>
      </div>

    </div>
  );
}
