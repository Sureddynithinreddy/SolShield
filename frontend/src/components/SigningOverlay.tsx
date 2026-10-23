import { useEffect, useMemo, useRef, useState } from "react";
import type { TxScenario } from "@/lib/types";
import { verdictMeta } from "@/lib/theme";
import { assembleScan } from "@/lib/securityChecks";
import { cx, shortAddr, signed, usd } from "@/lib/format";
import { VerdictPill, SeverityTag } from "./Badges";
import { RiskGauge } from "./RiskGauge";
import { AddressMono } from "./ui";
import {
  ArrowUpRight,
  ArrowDownLeft,
  ChevronDown,
  Lock,
  Code,
  Wallet,
  Coin,
  Activity,
  AlertTriangle,
  X,
  Zap,
} from "./icons";

const scannerIcon: Record<string, JSX.Element> = {
  program: <Code width={15} height={15} />,
  wallet: <Wallet width={15} height={15} />,
  token: <Coin width={15} height={15} />,
  simulator: <Activity width={15} height={15} />,
};

const statusDot: Record<string, string> = {
  ok: "bg-safe",
  warn: "bg-caution",
  bad: "bg-danger",
  info: "bg-slate-500",
};

export function SigningOverlay({
  scenario,
  onDecision,
  onClose,
  signerAddress,
}: {
  scenario: TxScenario;
  onDecision: (d: "allowed" | "blocked" | "overrode") => void;
  onClose?: () => void;
  /** The connected wallet address, if any. Shown as the transaction signer. */
  signerAddress?: string;
}) {
  const [showTech, setShowTech] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Live scan: the Program Scanner panel and its rules are computed here,
  // not read from static scenario data.
  const { scanners, firedRules } = useMemo(() => assembleScan(scenario), [scenario]);
  const m = verdictMeta[scenario.verdict];
  const isDanger = scenario.verdict === "dangerous";
  const hardBlocked = firedRules.some((r) => r.hardBlock);

  // Focus the dialog on mount and close on Escape (if closable).
  useEffect(() => {
    dialogRef.current?.focus();
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Transaction review — verdict ${scenario.verdict}`}
      tabIndex={-1}
      className={cx("glass animate-scale-in w-full max-w-md overflow-hidden ring-1 focus:outline-none", m.ring)}
    >
      {/* Verdict header strip */}
      <div className={cx("relative px-5 pt-5", m.bg)}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-black/30 text-xl ring-1 ring-white/10">
              {scenario.dappFavicon}
            </span>
            <div>
              <div className="text-sm font-semibold text-white">{scenario.dappName}</div>
              <div className={cx("mono", isDanger ? "text-danger" : "text-slate-400")}>
                {scenario.dappDomain}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <VerdictPill verdict={scenario.verdict} />
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-md p-1 text-slate-500 hover:bg-white/10 hover:text-slate-300 focus-ring"
              >
                <X width={16} height={16} />
              </button>
            )}
          </div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 pb-1 text-[0.68rem] text-slate-500">
          <span className="mono">{scenario.requestType}</span>
          <span className="inline-flex items-center gap-1">
            <Zap width={11} height={11} /> scanned in {scenario.scanMs}ms
          </span>
          <span className="capitalize">confidence: {scenario.confidence}</span>
          {signerAddress && (
            <span className="inline-flex items-center gap-1">
              signer: <span className="mono text-slate-400">{shortAddr(signerAddress, 4, 4)}</span>
            </span>
          )}
        </div>
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-5 pb-5">
        {/* Gauge */}
        <div className="flex justify-center pt-2">
          <RiskGauge score={scenario.score} size={190} />
        </div>

        {/* Plain-language summary */}
        <p
          className={cx(
            "mt-1 rounded-xl px-3.5 py-3 text-center text-sm leading-relaxed ring-1",
            isDanger
              ? "bg-danger/10 text-rose-100 ring-danger/20"
              : scenario.verdict === "caution"
              ? "bg-caution/10 text-amber-100 ring-caution/20"
              : "bg-safe/10 text-emerald-100 ring-safe/20"
          )}
        >
          {scenario.summary}
        </p>

        {/* You send / You receive */}
        <SectionTitle>Balance changes</SectionTitle>
        <div className="space-y-1.5">
          {scenario.balanceChanges.map((b) => {
            const outgoing = b.amount < 0;
            return (
              <div
                key={b.symbol}
                className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2.5"
              >
                <span className="inline-flex items-center gap-2 text-sm text-slate-300">
                  {outgoing ? (
                    <ArrowUpRight width={15} height={15} className="text-danger" />
                  ) : (
                    <ArrowDownLeft width={15} height={15} className="text-safe" />
                  )}
                  <span className="font-medium text-white">{b.symbol}</span>
                  <span className="text-xs text-slate-500">{b.name}</span>
                </span>
                <span
                  className={cx(
                    "text-right text-sm font-semibold tabular-nums",
                    outgoing ? "text-danger" : "text-safe"
                  )}
                >
                  {signed(b.amount)} {b.symbol}
                  {b.usd !== undefined && (
                    <span className="ml-1 block text-[0.68rem] font-normal text-slate-500">
                      {usd(b.usd)}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* Permissions */}
        <SectionTitle>Permissions requested</SectionTitle>
        <div className="space-y-1.5">
          {scenario.permissions.map((p) => (
            <div
              key={p.label}
              className={cx(
                "flex items-start gap-2.5 rounded-lg px-3 py-2.5 ring-1",
                p.severity === "critical" || p.severity === "high"
                  ? "bg-danger/5 ring-danger/20"
                  : "bg-black/20 ring-white/5"
              )}
            >
              <Lock
                width={15}
                height={15}
                className={cx("mt-0.5 shrink-0", p.severity === "critical" ? "text-danger" : "text-slate-400")}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-white">{p.label}</span>
                  <SeverityTag severity={p.severity} />
                </div>
                <p className="mt-0.5 text-xs text-slate-400">{p.detail}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Top reasons (rules fired) */}
        <SectionTitle>Why this verdict</SectionTitle>
        <div className="space-y-1.5">
          {firedRules.map((r) => (
            <div key={r.id} className="rounded-lg bg-black/20 px-3 py-2.5 ring-1 ring-white/5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-white">
                  {r.hardBlock && <AlertTriangle width={14} height={14} className="text-danger" />}
                  {r.title}
                </span>
                <span className="flex items-center gap-1.5">
                  {r.hardBlock && (
                    <span className="chip border-danger/40 bg-danger/15 text-[0.62rem] text-danger">
                      Hard block
                    </span>
                  )}
                  <SeverityTag severity={r.severity} />
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{r.explanation}</p>
              <p className="mt-1 text-[0.68rem] text-slate-500">
                <span className="mono text-slate-600">{r.id}</span> · {r.recommendedAction}
              </p>
            </div>
          ))}
        </div>

        {/* Expandable technical details */}
        <button
          onClick={() => setShowTech((v) => !v)}
          className="mt-4 flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 text-sm text-slate-300 hover:bg-white/[0.05] focus-ring"
          aria-expanded={showTech}
        >
          <span>Technical details</span>
          <ChevronDown
            width={16}
            height={16}
            className={cx("transition-transform", showTech && "rotate-180")}
          />
        </button>

        {showTech && (
          <div className="animate-fade-up mt-2 space-y-3">
            {/* Scanner panels */}
            {scanners.map((panel) => (
              <div key={panel.key} className="glass-soft p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <span className="text-cyan">{scannerIcon[panel.key]}</span>
                  {panel.title}
                </div>
                <div className="space-y-1">
                  {panel.findings.map((f) => (
                    <div key={f.label} className="flex items-start justify-between gap-3 text-xs">
                      <span className="inline-flex items-center gap-2 text-slate-400">
                        <span className={cx("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", statusDot[f.status])} />
                        {f.label}
                      </span>
                      <span
                        className={cx(
                          "text-right",
                          f.status === "bad" ? "text-danger" : f.status === "warn" ? "text-caution" : f.status === "ok" ? "text-safe" : "text-slate-400"
                        )}
                      >
                        {f.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Raw instructions */}
            <div className="glass-soft p-3">
              <div className="mb-2 text-xs font-semibold text-slate-200">
                Instructions ({scenario.instructions.length})
              </div>
              <div className="space-y-2">
                {scenario.instructions.map((ins) => (
                  <div
                    key={ins.index}
                    className={cx(
                      "rounded-md border px-2.5 py-2",
                      ins.flagged ? "border-danger/30 bg-danger/5" : "border-white/5 bg-black/20"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-white">
                        #{ins.index} {ins.program} · {ins.name}
                      </span>
                      {ins.flagged && (
                        <span className="chip border-danger/40 bg-danger/15 text-[0.6rem] text-danger">
                          flagged
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[0.7rem] text-slate-400">{ins.summary}</p>
                    <AddressMono value={ins.programId} className="mt-1 inline-block text-[0.62rem]" />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between px-1 text-[0.68rem] text-slate-500">
              <span>Network fee</span>
              <span className="mono">{scenario.feeSol} SOL</span>
            </div>
          </div>
        )}
      </div>

      {/* Decision footer */}
      <div className="border-t border-white/[0.06] bg-ink-900/60 p-4">
        {isDanger && confirmStep ? (
          <div className="animate-fade-up">
            <p className="mb-2 text-center text-xs text-rose-200">
              {hardBlocked
                ? "This is a hard-blocked transaction. Overriding is strongly discouraged."
                : "Are you absolutely sure? This action may be irreversible."}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-ghost" onClick={() => setConfirmStep(false)}>
                Keep me safe
              </button>
              <button
                className="btn-danger"
                onClick={() => onDecision("overrode")}
              >
                Sign anyway
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              className={cx(isDanger ? "btn-primary" : "btn-ghost")}
              onClick={() => onDecision("blocked")}
            >
              Reject
            </button>
            {isDanger ? (
              <button className="btn-ghost text-slate-400" onClick={() => setConfirmStep(true)}>
                Override…
              </button>
            ) : (
              <button className="btn-primary" onClick={() => onDecision("allowed")}>
                {scenario.verdict === "caution" ? "Proceed anyway" : "Proceed"}
              </button>
            )}
          </div>
        )}
        <p className="mt-2 text-center text-[0.64rem] text-slate-600">
          SolShield relays your choice to the wallet. On Proceed, the wallet's own approval follows.
        </p>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="label-cap mb-2 mt-4">{children}</div>;
}
