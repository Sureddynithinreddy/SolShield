import type { ReactNode } from "react";
import type { Severity, Verdict } from "@/lib/types";
import { severityMeta, verdictMeta } from "@/lib/theme";
import { cx } from "@/lib/format";
import { ShieldCheck, ShieldAlert, AlertTriangle } from "./icons";

export function VerdictPill({ verdict, size = "md" }: { verdict: Verdict; size?: "sm" | "md" | "lg" }) {
  const m = verdictMeta[verdict];
  const Icon = verdict === "safe" ? ShieldCheck : verdict === "caution" ? AlertTriangle : ShieldAlert;
  const sizing =
    size === "lg"
      ? "px-4 py-1.5 text-sm"
      : size === "sm"
      ? "px-2 py-0.5 text-[0.7rem]"
      : "px-3 py-1 text-xs";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full font-semibold ring-1",
        m.bg,
        m.text,
        m.ring,
        sizing
      )}
    >
      <Icon width={size === "lg" ? 16 : 13} height={size === "lg" ? 16 : 13} />
      {m.label}
    </span>
  );
}

export function SeverityTag({ severity }: { severity: Severity }) {
  const m = severityMeta[severity];
  return <span className={cx("chip", m.chip)}>{m.label}</span>;
}

export function Chip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cx("chip border-white/10 bg-white/[0.03] text-slate-300", className)}>{children}</span>;
}
