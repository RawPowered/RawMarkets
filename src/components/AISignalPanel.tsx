import React, { useState } from "react";
import { apiFetch } from "../lib/api";
import { Asset, AnalysisResponse } from "../types";
import { isRealPriceSource } from "../lib/feedDisplay";
import { Sparkles, Brain, ArrowRight, TrendingUp, AlertCircle, ShieldAlert } from "lucide-react";

interface AISignalPanelProps {
  assets: Record<string, Asset>;
}

export default function AISignalPanel({ assets }: AISignalPanelProps) {
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Compute a live "Index Heat Score" based on gold/silver relative gains vs stock gains
  const calculateHeatIndex = () => {
    let positiveCount = 0;
    let totalCount = 0;

    const withRealPrice = Object.values(assets).filter((a) =>
      isRealPriceSource(a.priceSource)
    );
    withRealPrice.forEach((a) => {
      totalCount++;
      if (a.changePercent && !a.changePercent.startsWith("-")) {
        positiveCount++;
      }
    });

    const winRatio = totalCount > 0 ? positiveCount / totalCount : 0;
    const gold = assets["GOLD"];
    const poke = assets["TCG-POKE"];
    const goldChangePct =
      gold && isRealPriceSource(gold.priceSource)
        ? parseFloat(gold.changePercent || "0")
        : 0;
    const pokeChangePct =
      poke && isRealPriceSource(poke.priceSource)
        ? parseFloat(poke.changePercent || "0")
        : 0;

    let status = "Stable";
    let score = Math.round(winRatio * 100);
    let color = "from-blue-500 to-indigo-500";
    let bgLight = "bg-[#F0F7FF]";
    let textColor = "text-[#007AFF]";
    let desc =
      totalCount === 0
        ? "No live price feeds yet — heat index needs real data, not seeded simulation."
        : "Balanced market signals. Alternative assets and raw metals are moving inside stable bounds.";

    if (score >= 70) {
      status = "Bullish Synergy";
      color = "from-[#34C759] to-teal-500";
      bgLight = "bg-[#34C759]/10";
      textColor = "text-[#34C759]";
      desc = "Correlated macro run! Physical wealth assets and pop-culture hobbyist pools are syncing upward.";
    } else if (score <= 30) {
      status = "Macro Contraction";
      color = "from-[#FF3B30] to-red-500";
      bgLight = "bg-[#FF3B30]/10";
      textColor = "text-[#FF3B30]";
      desc = "Broad defensive pullback. Liquidity constraints are putting downward pressure on equities and secondary pools.";
    } else if (goldChangePct > 0.5 && pokeChangePct < -0.2) {
      status = "Fear-Based Hedging";
      color = "from-amber-600 to-orange-500";
      bgLight = "bg-amber-500/10";
      textColor = "text-amber-600";
      desc = "Risk-off divergence. Money is fleeing consumer collectibles & equities, parking inside hard bullion safety gauges.";
    } else if (pokeChangePct > 1.0 && goldChangePct <= 0) {
      status = "Speculative Retail Heat";
      color = "from-[#FF3B30] to-pink-500";
      bgLight = "bg-[#FF3B30]/10";
      textColor = "text-[#FF3B30]";
      desc = "Hot collectible markets. High liquid retail attention focused on intellectual assets like Pokémon base sets and Nintendo shares.";
    }

    return { score, status, color, bgLight, textColor, desc };
  };

  const signal = calculateHeatIndex();

  const handleGenerateReport = async (promptOverride?: string) => {
    setLoading(true);
    setErrorMsg(null);
    const queryPrompt = promptOverride !== undefined ? promptOverride : customPrompt;

    try {
      const response = await apiFetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: assets,
          customPrompt: queryPrompt,
        }),
      });

      const data: AnalysisResponse = await response.json();
      if (data.success && data.analysis) {
        setReport(data.analysis);
      } else {
        setErrorMsg(data.message || "Failed to generate dynamic insights. Make sure GEMINI_API_KEY is configured.");
      }
    } catch (err: any) {
      setErrorMsg(`Connection error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Simplest clean local Markdown-like parser for gorgeous styling
  const renderFormattedReport = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      let trimmed = line.trim();

      // Heading 3
      if (trimmed.startsWith("###")) {
        return (
          <h4 key={idx} className="text-sm font-black text-zinc-800 tracking-tight mt-6 mb-2 flex items-center gap-1.5 border-l-2 border-zinc-900 pl-2">
            {trimmed.replace("###", "").trim()}
          </h4>
        );
      }
      // Heading 2
      if (trimmed.startsWith("##")) {
        return (
          <h3 key={idx} className="text-base font-bold text-zinc-950 tracking-tight mt-6 mb-3 pb-1 border-b border-zinc-150">
            {trimmed.replace("##", "").trim()}
          </h3>
        );
      }
      // Bullet items
      if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
        const itemContent = trimmed.substring(1).trim();
        return (
          <li key={idx} className="text-xs text-zinc-600 leading-relaxed ml-4 my-1.5 list-disc list-outside">
            {formatBoldText(itemContent)}
          </li>
        );
      }
      // Row spaces
      if (trimmed === "") {
        return <div key={idx} className="h-2" />;
      }
      // Base paragraph
      return (
        <p key={idx} className="text-xs text-zinc-650 leading-relaxed my-2">
          {formatBoldText(trimmed)}
        </p>
      );
    });
  };

  // Parser for bold text "**text**" -> <strong> tags
  const formatBoldText = (text: string) => {
    const parts = text.split(/\*\*([\s\S]*?)\*\*/g);
    return parts.map((part, i) => (i % 2 === 1 ? <strong key={i} className="font-bold text-zinc-900">{part}</strong> : part));
  };

  const PROMPT_TEMPLATES = [
    {
      title: "AI compute & Big Tech hardware",
      prompt: "Diagnostic: Analyze WTI Crude Oil and industrial Copper dynamics vs NVIDIA (NVDA) and Samsung chip production volumes. Are global energy costs capping hardware fabrication throughput?",
    },
    {
      title: "Private OpenAI vs xAI & Anthropic",
      prompt: "Value Vector: Assess how the private valuation proxies for Anthropic (Claude), OpenAI (GPT-4), and xAI (Grok) move compared to Google (GOOGL) and Meta (META) equities.",
    },
    {
      title: "Metal hedges vs Tech Growth",
      prompt: "Macro Review: Compare safe-haven Gold Spot price action with high-multiple tech giants like Tesla (TSLA) and Nvidia (NVDA). Which acts as a superior liquidity sensor?",
    },
  ];

  return (
    <div id="ai-panel" className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">

      {/* Col 1: Modern Heat Score Gauge & Tactical Quick-Taps */}
      <div className="lg:col-span-1 flex flex-col gap-6">

        {/* Modern Samsung UI inspired Gauges Card */}
        <div className="bg-white border border-[#E5E8EB] shadow-sm rounded-[28px] p-6 flex flex-col items-center">
          <div className="w-full text-left">
            <span className="text-[10px] font-extrabold tracking-wider uppercase text-[#86868B] font-mono block mb-1">
              Economic Heat Index
            </span>
            <h3 className="text-lg font-bold text-[#1D1D1F] tracking-tight">
              Tactical Diagnosis
            </h3>
          </div>

          {/* Large Circle Gauge */}
          <div className="relative w-36 h-36 flex items-center justify-center my-6">
            {/* SVG circle backdrop */}
            <svg className="absolute w-full h-full transform -rotate-90">
              <circle
                cx="72"
                cy="72"
                r="64"
                className="stroke-[#E5E8EB]"
                strokeWidth="10"
                fill="none"
              />
              <circle
                cx="72"
                cy="72"
                r="64"
                className="stroke-[#007AFF]"
                strokeWidth="10"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 64}`}
                strokeDashoffset={`${2 * Math.PI * 64 * (1 - signal.score / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="flex flex-col items-center z-10 text-center">
              <span className="text-3xl font-bold text-[#1D1D1F] tracking-tight">
                {signal.score}%
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded-full ${signal.bgLight} ${signal.textColor} mt-1`}>
                {signal.status}
              </span>
            </div>
          </div>

          <p className="text-xs text-center text-[#86868B] leading-relaxed max-w-xs mb-2">
            {signal.desc}
          </p>
        </div>

        {/* Templates Panel */}
        <div className="bg-white border border-[#E5E8EB] shadow-sm rounded-[28px] p-6 flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-bold text-[#1D1D1F] tracking-tight">
              Macro Signal Presets
            </h3>
            <p className="text-[11px] text-[#86868B]">
              Tap any template to synthesize target correlations instantly via cloud AI.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {PROMPT_TEMPLATES.map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCustomPrompt(item.prompt);
                  handleGenerateReport(item.prompt);
                }}
                disabled={loading}
                className="w-full text-left p-3 hover:bg-[#F5F5F7] border border-[#E5E8EB] rounded-2xl transition duration-150 text-xs font-semibold text-[#424245] flex items-center justify-between cursor-pointer group"
              >
                <span>{item.title}</span>
                <ArrowRight size={14} className="text-[#86868B] group-hover:text-[#1D1D1F] transition duration-150" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Col 2 & 3: Main AI Compiler Block */}
      <div className="lg:col-span-2 bg-white border border-[#E5E8EB] shadow-sm rounded-[32px] p-6 md:p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between border-b border-[#E5E8EB] pb-4">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-[#F0F7FF] text-[#007AFF] rounded-xl">
              <Sparkles size={18} className="animate-pulse" />
            </span>
            <div>
              <h3 className="text-base font-bold text-[#1D1D1F] tracking-tight">
                AI Economic Analyst
              </h3>
              <p className="text-xs text-[#86868B]">
                AI compiler synthesizing multi-market indices and alternative funds data.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono bg-[#F5F5F7] text-[#86868B] border border-[#E5E8EB] px-2.5 py-1 rounded-lg">
            cloud AI
          </span>
        </div>

        {/* Input prompt box */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-extrabold text-[#86868B] tracking-wider font-mono">
            CUSTOM SIGNAL DIALOGUE FOCUS (OPTIONAL)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g., Explain why Disney and Hasbro are moving in opposite directions..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              disabled={loading}
              className="flex-1 bg-[#F5F5F7] border-none rounded-full px-5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-[#007AFF] transition-all"
            />
            <button
              onClick={() => handleGenerateReport()}
              disabled={loading}
              className="bg-[#007AFF] hover:bg-[#0062CC] transition duration-150 text-white text-xs font-bold px-5 py-2.5 rounded-full flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50 shadow-sm shadow-[#007AFF]/25"
            >
              <Brain size={14} />
              {loading ? "Analysing..." : "Compile"}
            </button>
          </div>
        </div>

        {/* Loading display */}
        {loading && (
          <div className="flex-1 min-h-[180px] flex flex-col items-center justify-center p-6 bg-[#F5F5F7] rounded-3xl border border-[#E5E8EB] border-dashed animate-pulse">
            <div className="w-8 h-8 border-2 border-[#E5E8EB] border-t-[#007AFF] rounded-full animate-spin mb-3" />
            <p className="text-xs font-bold text-[#1D1D1F] tracking-tight">
              Synthesizing Correlation Vectors...
            </p>
            <p className="text-[11px] text-[#86868B] text-center max-w-sm mt-1 leading-normal">
              Cloud AI is digesting physical Crude Oil, safe-haven metals, private AI index proxies (OpenAI, Anthropic, xAI), and sovereign tech charts.
            </p>
          </div>
        )}

        {/* Error state */}
        {errorMsg && !loading && (
          <div className="p-4 bg-[#FF3B30]/5 border border-[#FF3B30]/20 rounded-2xl flex items-start gap-2.5 text-[#FF3B30] text-xs">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-[#FF3B30]">Intelligence Compilation Blocked</p>
              <p className="mt-1 font-mono leading-normal text-[11px] opacity-90">{errorMsg}</p>
              <p className="mt-2 text-[10px] opacity-80">
                To enable absolute signal compiling, please ensure a valid <strong className="font-bold">GEMINI_API_KEY</strong> is set in your secrets panel!
              </p>
            </div>
          </div>
        )}

        {/* Formatted analyst report representation */}
        {report && !loading && !errorMsg && (
          <div className="flex-1 bg-[#F5F5F7]/40 border border-[#E5E8EB] p-6 md:p-8 rounded-[24px] max-h-[420px] overflow-y-auto">
            <div className="flex items-center gap-1.5 text-[#34C759] font-bold text-[11px] uppercase tracking-wider font-mono mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] animate-pulse" />
              Latest synthesized analyst report
            </div>
            <div className="prose max-w-none text-[#424245]">
              {renderFormattedReport(report)}
            </div>
          </div>
        )}

        {/* Empty state before report */}
        {!report && !loading && !errorMsg && (
          <div className="flex-1 min-h-[180px] flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#E5E8EB] rounded-3xl bg-[#F5F5F7]/50">
            <Brain size={28} className="text-[#86868B]/40 mb-2" />
            <p className="text-xs font-bold text-[#1D1D1F] uppercase tracking-tight">
              Signal Analysis Report Empty
            </p>
            <p className="text-xs text-[#86868B] max-w-sm mt-1 leading-normal">
              Click &quot;Compile&quot; or tap a preset correlation template to generate a tailored report compiled from active asset index parameters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
