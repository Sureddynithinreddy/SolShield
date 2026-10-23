import type { ReactNode } from "react";
import { cx, shortAddr } from "@/lib/format";

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return <Tag className={cx("glass p-5", className)}>{children}</Tag>;
}

export function SectionLabel({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-slate-200">
      {icon && <span className="text-cyan">{icon}</span>}
      <h3 className="text-sm font-semibold tracking-wide">{children}</h3>
    </div>
  );
}

export function AddressMono({
  value,
  full = false,
  className,
}: {
  value: string;
  full?: boolean;
  className?: string;
}) {
  return (
    <span
      title={value}
      className={cx(
        "mono rounded-md bg-black/30 px-1.5 py-0.5 text-slate-300 ring-1 ring-white/5",
        className
      )}
    >
      {full ? value : shortAddr(value, 6, 6)}
    </span>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent = "cyan",
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: "cyan" | "violet" | "safe" | "danger" | "caution";
  icon?: ReactNode;
}) {
  const accentText =
    accent === "violet"
      ? "text-violet-soft"
      : accent === "safe"
      ? "text-safe"
      : accent === "danger"
      ? "text-danger"
      : accent === "caution"
      ? "text-caution"
      : "text-cyan";
  return (
    <div className="glass relative overflow-hidden p-5">
      <div className="flex items-start justify-between">
        <span className="label-cap">{label}</span>
        {icon && <span className={cx("opacity-80", accentText)}>{icon}</span>}
      </div>
      <div className={cx("mt-3 text-3xl font-extrabold tracking-tight", accentText)}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cx("h-px w-full bg-white/[0.06]", className)} />;
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus-ring",
        checked ? "bg-gradient-to-r from-cyan to-violet" : "bg-white/10"
      )}
    >
      <span
        className={cx(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}
