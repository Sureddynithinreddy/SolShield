import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { cx } from "@/lib/format";
import type { Strictness } from "@/lib/types";
import {
  ShieldCheck,
  Scan,
  Lock,
  ArrowRight,
  Check,
  Wallet,
  Eye,
  Fingerprint,
} from "@/components/icons";

const steps = ["Welcome", "How it works", "Strictness", "Privacy", "Ready"] as const;

const strictnessOptions: {
  id: Strictness;
  title: string;
  tag: string;
  desc: string;
  bullets: string[];
}[] = [
  {
    id: "relaxed",
    title: "Relaxed",
    tag: "Fewer prompts",
    desc: "Only warns on confirmed-malicious activity. Best if you mostly use trusted dApps.",
    bullets: ["Hard-blocks confirmed drainers", "Minimal interruptions", "Dangerous verdicts are overridable"],
  },
  {
    id: "balanced",
    title: "Balanced",
    tag: "Recommended",
    desc: "The right mix of protection and friction for everyday Solana users.",
    bullets: ["All P0 scam detections on", "Two-step confirm for Dangerous", "Low false-positive rate"],
  },
  {
    id: "strict",
    title: "Strict",
    tag: "Maximum safety",
    desc: "Blocks anything unusual. Best for treasuries and high-value wallets.",
    bullets: ["Dangerous verdicts cannot be overridden", "Warns on new programs & tokens", "Blocks all unlimited delegates"],
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [strictness, setStrictness] = useState<Strictness>("balanced");
  const [telemetry, setTelemetry] = useState(true);
  const navigate = useNavigate();

  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(60%_50%_at_50%_0%,black,transparent)]" />
      <div className="mx-auto flex max-w-2xl flex-col px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between">
          <Logo />
          <button
            onClick={() => navigate("/app")}
            className="text-sm text-slate-500 hover:text-slate-300 focus-ring rounded px-2 py-1"
          >
            Skip
          </button>
        </div>

        {/* Progress */}
        <div className="mt-8 flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex-1">
              <div
                className={cx(
                  "h-1 rounded-full transition-all",
                  i <= step ? "bg-gradient-to-r from-cyan to-violet" : "bg-white/10"
                )}
              />
              <span
                className={cx(
                  "mt-1.5 hidden text-[0.68rem] sm:block",
                  i === step ? "text-slate-200" : "text-slate-600"
                )}
              >
                {s}
              </span>
            </div>
          ))}
        </div>

        <div className="glass mt-6 p-6 sm:p-8">
          {step === 0 && <Welcome />}
          {step === 1 && <HowItWorks />}
          {step === 2 && (
            <StrictnessStep value={strictness} onChange={setStrictness} />
          )}
          {step === 3 && <Privacy telemetry={telemetry} setTelemetry={setTelemetry} />}
          {step === 4 && <Ready strictness={strictness} />}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={back}
            disabled={step === 0}
            className="btn-ghost disabled:opacity-0"
          >
            Back
          </button>
          {step < steps.length - 1 ? (
            <button onClick={next} className="btn-primary">
              Continue
              <ArrowRight width={16} height={16} />
            </button>
          ) : (
            <button onClick={() => navigate("/app")} className="btn-primary">
              Enter SolShield
              <ArrowRight width={16} height={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="text-center">
      <h1 className="text-2xl font-extrabold tracking-tight text-white">{title}</h1>
      <p className="mt-2 text-slate-400">{sub}</p>
    </div>
  );
}

function Welcome() {
  return (
    <div className="animate-fade-up">
      <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-cyan/20 to-violet/20 text-cyan ring-1 ring-white/10 shadow-glow">
        <ShieldCheck width={32} height={32} />
      </div>
      <StepHeader
        title="Welcome to SolShield"
        sub="Your personal security firewall for Solana. Let's set you up in under a minute."
      />
      <ul className="mx-auto mt-6 max-w-sm space-y-3">
        {[
          "Reads every transaction before you sign",
          "Blocks drainers, scams and malicious approvals",
          "Never touches your keys or funds",
        ].map((t) => (
          <li key={t} className="flex items-center gap-3 text-sm text-slate-300">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-safe/15 text-safe">
              <Check width={14} height={14} />
            </span>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

function HowItWorks() {
  const rows = [
    { icon: <Wallet width={18} height={18} />, t: "A dApp asks your wallet to sign", d: "SolShield quietly intercepts the request." },
    { icon: <Scan width={18} height={18} />, t: "We scan & simulate it", d: "Programs, wallets, tokens and the real outcome — in under 1.5s." },
    { icon: <ShieldCheck width={18} height={18} />, t: "You get a clear verdict", d: "Safe, Caution or Dangerous, with the reasons why." },
  ];
  return (
    <div className="animate-fade-up">
      <StepHeader title="How it works" sub="Three steps stand between a dApp and your signature." />
      <div className="mt-6 space-y-3">
        {rows.map((r, i) => (
          <div key={r.t} className="glass-soft flex items-start gap-4 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan/20 to-violet/20 text-cyan ring-1 ring-white/10">
              {r.icon}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="mono text-slate-600">0{i + 1}</span>
                <h3 className="font-semibold text-white">{r.t}</h3>
              </div>
              <p className="mt-0.5 text-sm text-slate-400">{r.d}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StrictnessStep({
  value,
  onChange,
}: {
  value: Strictness;
  onChange: (v: Strictness) => void;
}) {
  return (
    <div className="animate-fade-up">
      <StepHeader
        title="Choose your protection level"
        sub="You can change this any time in Settings."
      />
      <div className="mt-6 space-y-3">
        {strictnessOptions.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              className={cx(
                "w-full rounded-xl border p-4 text-left transition focus-ring",
                active
                  ? "border-cyan/50 bg-cyan/[0.06] shadow-glow"
                  : "border-white/10 bg-white/[0.02] hover:border-white/20"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{o.title}</span>
                  <span
                    className={cx(
                      "chip text-[0.68rem]",
                      o.id === "balanced"
                        ? "border-cyan/40 bg-cyan/10 text-cyan"
                        : "border-white/10 bg-white/5 text-slate-400"
                    )}
                  >
                    {o.tag}
                  </span>
                </div>
                <span
                  className={cx(
                    "grid h-5 w-5 place-items-center rounded-full border",
                    active ? "border-cyan bg-cyan text-ink-950" : "border-white/20"
                  )}
                >
                  {active && <Check width={12} height={12} />}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-slate-400">{o.desc}</p>
              {active && (
                <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {o.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-xs text-slate-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Privacy({
  telemetry,
  setTelemetry,
}: {
  telemetry: boolean;
  setTelemetry: (v: boolean) => void;
}) {
  return (
    <div className="animate-fade-up">
      <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.04] text-cyan ring-1 ring-white/10">
        <Lock width={26} height={26} />
      </div>
      <StepHeader
        title="Your privacy, by design"
        sub="SolShield is non-custodial and sends the minimum needed to keep you safe."
      />
      <div className="mt-6 space-y-3">
        {[
          { icon: <Fingerprint width={18} height={18} />, t: "Keys never leave your device", d: "No private keys, seed phrases or signatures are ever sent." },
          { icon: <Eye width={18} height={18} />, t: "Minimal data", d: "Only the unsigned transaction and the site domain are scanned." },
        ].map((r) => (
          <div key={r.t} className="glass-soft flex items-start gap-3 p-4">
            <span className="mt-0.5 text-safe">{r.icon}</span>
            <div>
              <h3 className="font-semibold text-white">{r.t}</h3>
              <p className="mt-0.5 text-sm text-slate-400">{r.d}</p>
            </div>
          </div>
        ))}
        <label className="glass-soft flex cursor-pointer items-center justify-between p-4">
          <div>
            <h3 className="font-semibold text-white">Share anonymous telemetry</h3>
            <p className="mt-0.5 text-sm text-slate-400">
              Opt in to help improve detection. Wallet addresses are hashed.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={telemetry}
            onClick={() => setTelemetry(!telemetry)}
            className={cx(
              "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition",
              telemetry ? "bg-gradient-to-r from-cyan to-violet" : "bg-white/10"
            )}
          >
            <span
              className={cx(
                "inline-block h-4 w-4 transform rounded-full bg-white transition",
                telemetry ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </label>
      </div>
    </div>
  );
}

function Ready({ strictness }: { strictness: Strictness }) {
  return (
    <div className="animate-fade-up text-center">
      <div className="relative mx-auto mb-6 h-20 w-20">
        <span className="absolute inset-0 animate-pulse-ring rounded-full bg-safe/40" />
        <span className="relative grid h-20 w-20 place-items-center rounded-full bg-safe/15 text-safe ring-1 ring-safe/40">
          <ShieldCheck width={40} height={40} />
        </span>
      </div>
      <StepHeader
        title="You're protected"
        sub="SolShield is now watching every signing request on supported Solana wallets."
      />
      <div className="mx-auto mt-6 flex max-w-sm flex-col gap-2">
        <div className="glass-soft flex items-center justify-between p-3 text-sm">
          <span className="text-slate-400">Protection level</span>
          <span className="font-semibold capitalize text-white">{strictness}</span>
        </div>
        <div className="glass-soft flex items-center justify-between p-3 text-sm">
          <span className="text-slate-400">Status</span>
          <span className="chip border-safe/40 bg-safe/10 text-safe">Active</span>
        </div>
      </div>
    </div>
  );
}
