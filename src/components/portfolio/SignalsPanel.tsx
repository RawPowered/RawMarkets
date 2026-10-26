import React from "react";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import type { PortfolioSignal } from "../../types";

interface SignalsPanelProps {
  signals: PortfolioSignal[];
  maxItems?: number;
}

function severityStyles(severity: PortfolioSignal["severity"]) {
  switch (severity) {
    case "critical":
      return {
        border: "border-rose-200",
        bg: "bg-rose-50",
        icon: ShieldAlert,
        iconClass: "text-rose-600",
        badge: "bg-rose-100 text-rose-800",
      };
    case "warn":
      return {
        border: "border-amber-200",
        bg: "bg-amber-50",
        icon: AlertTriangle,
        iconClass: "text-amber-600",
        badge: "bg-amber-100 text-amber-800",
      };
    default:
      return {
        border: "border-[#E5E8EB]",
        bg: "bg-[#F5F5F7]",
        icon: Info,
        iconClass: "text-[#007AFF]",
        badge: "bg-[#F0F7FF] text-[#007AFF]",
      };
  }
}

export default function SignalsPanel({
  signals,
  maxItems = 8,
}: SignalsPanelProps) {
  const shown = signals.slice(0, maxItems);

  if (shown.length === 0) {
    return (
      <div className="bg-white border border-[#E5E8EB] rounded-[28px] p-6">
        <h3 className="text-sm font-bold text-[#1D1D1F]">Action signals</h3>
        <p className="text-xs text-[#86868B] mt-2">
          No alerts — portfolio within barbell and risk guardrails.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E5E8EB] rounded-[28px] p-6 space-y-3">
      <h3 className="text-sm font-bold text-[#1D1D1F]">Action signals</h3>
      <ul className="space-y-2">
        {shown.map((s, i) => {
          const st = severityStyles(s.severity);
          const Icon = st.icon;
          return (
            <li
              key={`${s.code}-${s.holdingId ?? "p"}-${i}`}
              className={`flex gap-3 p-3 rounded-2xl border ${st.border} ${st.bg}`}
            >
              <Icon size={16} className={`shrink-0 mt-0.5 ${st.iconClass}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-[#1D1D1F]">{s.title}</span>
                  <span
                    className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${st.badge}`}
                  >
                    {s.action}
                  </span>
                </div>
                <p className="text-[11px] text-[#424245] mt-1 leading-relaxed">
                  {s.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
