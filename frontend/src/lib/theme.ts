import type { Severity, Verdict } from "./types";

// Single source of truth for score→verdict mapping lives in shared.
export { verdictFromScore } from "@shared/scoring";

export const verdictMeta: Record<
  Verdict,
  { label: string; color: string; text: string; ring: string; bg: string; glow: string }
> = {
  safe: {
    label: "Safe",
    color: "#34d399",
    text: "text-safe",
    ring: "ring-safe/40",
    bg: "bg-safe/10",
    glow: "shadow-[0_0_40px_-8px_rgba(52,211,153,0.6)]",
  },
  caution: {
    label: "Caution",
    color: "#fbbf24",
    text: "text-caution",
    ring: "ring-caution/40",
    bg: "bg-caution/10",
    glow: "shadow-[0_0_40px_-8px_rgba(251,191,36,0.6)]",
  },
  dangerous: {
    label: "Dangerous",
    color: "#f43f5e",
    text: "text-danger",
    ring: "ring-danger/40",
    bg: "bg-danger/10",
    glow: "shadow-[0_0_40px_-8px_rgba(244,63,94,0.6)]",
  },
};

export const severityMeta: Record<
  Severity,
  { label: string; color: string; chip: string; multiplier: number }
> = {
  info: { label: "Info", color: "#94a3b8", chip: "border-slate-500/40 text-slate-300 bg-slate-500/10", multiplier: 0 },
  low: { label: "Low", color: "#38bdf8", chip: "border-sky-500/40 text-sky-300 bg-sky-500/10", multiplier: 0.5 },
  medium: { label: "Medium", color: "#fbbf24", chip: "border-caution/40 text-caution bg-caution/10", multiplier: 1 },
  high: { label: "High", color: "#fb923c", chip: "border-orange-500/40 text-orange-300 bg-orange-500/10", multiplier: 2 },
  critical: { label: "Critical", color: "#f43f5e", chip: "border-danger/40 text-danger bg-danger/10", multiplier: 4 },
};

export const statusColor: Record<string, string> = {
  ok: "text-safe",
  warn: "text-caution",
  bad: "text-danger",
  info: "text-slate-400",
};
