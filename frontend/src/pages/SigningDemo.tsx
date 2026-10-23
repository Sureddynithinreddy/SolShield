import { useEffect, useRef, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { scenarios } from "@/lib/mock";
import type { TxScenario } from "@/lib/types";
import { SigningOverlay } from "@/components/SigningOverlay";
import { Card, Divider } from "@/components/ui";
import { VerdictPill } from "@/components/Badges";
import { ConnectWalletButton } from "@/wallet/ConnectWalletButton";
import { cx, shortAddr } from "@/lib/format";
import { analyzeTransaction } from "@/lib/analyzeTx";
import { activeCluster } from "@/lib/solana";
import {
  Scan,
  Wallet,
  Code,
  Coin,
  Activity,
  Check,
  Spinner,
  Globe,
  ShieldCheck,
  X,
  Zap,
} from "@/components/icons";

type Phase = "idle" | "scanning" | "overlay" | "result";
type Mode = "examples" | "real";

const scanSteps = [
  { icon: <Code width={14} height={14} />, label: "Decoding transaction" },
  { icon: <Code width={14} height={14} />, label: "Program scanner" },
  { icon: <Wallet width={14} height={14} />, label: "Wallet scanner" },
  { icon: <Coin width={14} height={14} />, label: "Token scanner" },
  { icon: <Activity width={14} height={14} />, label: "Simulating outcome" },
  { icon: <ShieldCheck width={14} height={14} />, label: "Scoring & verdict" },
];

export default function SigningDemo() {
  const { connected, publicKey, wallet } = useWallet();
  const [mode, setMode] = useState<Mode>("examples");
  const signerLabel =
    connected && publicKey ? shortAddr(publicKey.toBase58(), 4, 4) : "Demo wallet (7Hm4…xQ2v)";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeading
          icon={<Scan width={22} height={22} />}
          title="Transaction Scanner"
          sub="Run a curated example, or paste a real Solana transaction to scan it live."
        />
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="label-cap">Signer</div>
            <div className="mono text-sm text-slate-200">
              {wallet?.adapter.name ? `${wallet.adapter.name} · ` : ""}
              {signerLabel}
            </div>
          </div>
          <ConnectWalletButton compact />
        </div>
      </div>

      {/* Mode toggle */}
      <div className="mt-5 flex flex-wrap gap-1.5">
        <ModeTab active={mode === "examples"} onClick={() => setMode("examples")}>
          <ShieldCheck width={15} height={15} /> Example scenarios
        </ModeTab>
        <ModeTab active={mode === "real"} onClick={() => setMode("real")}>
          <Zap width={15} height={15} /> Scan a real transaction
        </ModeTab>
      </div>

      {mode === "examples" ? <ExamplesMode /> : <RealScanMode />}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition focus-ring",
        active
          ? "bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(34,211,238,0.25)]"
          : "text-slate-400 hover:bg-white/[0.03]"
      )}
    >
      {children}
    </button>
  );
}

/* ============================ Examples mode ============================ */

function ExamplesMode() {
  const { connected, publicKey } = useWallet();
  const [selected, setSelected] = useState<TxScenario>(scenarios[2]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [scanIdx, setScanIdx] = useState(0);
  const [decision, setDecision] = useState<"allowed" | "blocked" | "overrode" | null>(null);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => () => clearTimers(), []);

  const startScan = () => {
    clearTimers();
    setDecision(null);
    setScanIdx(0);
    setPhase("scanning");
    const per = 230;
    scanSteps.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => setScanIdx(i + 1), per * (i + 1)));
    });
    timers.current.push(window.setTimeout(() => setPhase("overlay"), per * scanSteps.length + 250));
  };

  const reset = () => {
    clearTimers();
    setPhase("idle");
    setDecision(null);
    setScanIdx(0);
  };

  const onDecision = (d: "allowed" | "blocked" | "overrode") => {
    setDecision(d);
    setPhase("result");
  };

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-3">
        <span className="label-cap">
          Example scenarios <span className="text-slate-600">· illustrative</span>
        </span>
        {scenarios.map((s) => {
          const active = selected.id === s.id;
          return (
            <button
              key={s.id}
              onClick={() => {
                setSelected(s);
                reset();
              }}
              className={cx(
                "w-full rounded-xl border p-4 text-left transition focus-ring",
                active
                  ? "border-cyan/50 bg-cyan/[0.06] shadow-glow"
                  : "border-white/10 bg-white/[0.02] hover:border-white/20"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="text-lg">{s.dappFavicon}</span>
                  <span className="text-sm font-semibold text-white">{s.dappName}</span>
                </span>
                <VerdictPill verdict={s.verdict} size="sm" />
              </div>
              <div className="mono mt-1 text-slate-500">{s.dappDomain}</div>
            </button>
          );
        })}

        <Card className="mt-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Globe width={16} height={16} className="text-cyan" />
            How to read it
          </div>
          <Divider className="my-3" />
          <ul className="space-y-2 text-xs text-slate-400">
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-safe" /> 0–29 Safe — Allow
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-caution" /> 30–59 Caution — confirm
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-danger" /> 60–100 Dangerous — Block
            </li>
          </ul>
        </Card>
      </div>

      <div className="relative">
        <BrowserFrame domain={selected.dappDomain}>
          <div className="relative grid min-h-[460px] place-items-center bg-gradient-to-br from-ink-900 to-ink-850 p-6">
            <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
            <div className="relative text-center">
              <div className="mb-4 text-5xl">{selected.dappFavicon}</div>
              <h3 className="text-xl font-bold text-white">{selected.dappName}</h3>
              <p className="mt-1 text-sm text-slate-400">
                {selected.verdict === "dangerous"
                  ? "Claim your exclusive airdrop now!"
                  : selected.verdict === "caution"
                  ? "Mint your GlowPass — limited supply"
                  : "Swap tokens at the best rate"}
              </p>
              {phase === "idle" && (
                <button className="btn-primary mt-6" onClick={startScan}>
                  <Wallet width={16} height={16} />
                  {selected.requestType === "signMessage" ? "Sign message" : "Request signature"}
                </button>
              )}
              {phase !== "idle" && (
                <button className="btn-ghost mt-6" onClick={reset}>
                  Reset demo
                </button>
              )}
            </div>

            {phase === "scanning" && (
              <div className="absolute inset-0 z-10 grid place-items-center bg-ink-950/70 backdrop-blur-sm">
                <ScanProgress idx={scanIdx} />
              </div>
            )}

            {phase === "overlay" && (
              <div className="absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-ink-950/70 p-4 backdrop-blur-sm">
                <SigningOverlay
                  scenario={selected}
                  onDecision={onDecision}
                  onClose={reset}
                  signerAddress={connected && publicKey ? publicKey.toBase58() : undefined}
                />
              </div>
            )}

            {phase === "result" && decision && (
              <div className="absolute inset-0 z-20 grid place-items-center bg-ink-950/80 p-4 backdrop-blur-sm">
                <ResultCard decision={decision} scenario={selected} onReset={reset} />
              </div>
            )}
          </div>
        </BrowserFrame>
      </div>
    </div>
  );
}

/* ============================ Real scan mode ============================ */

function RealScanMode() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<TxScenario | null>(null);
  const [decision, setDecision] = useState<"allowed" | "blocked" | "overrode" | null>(null);

  const run = async () => {
    setError(null);
    setScenario(null);
    setDecision(null);
    if (!input.trim()) {
      setError("Paste a base64-encoded unsigned transaction first.");
      return;
    }
    setBusy(true);
    try {
      const res = await analyzeTransaction(connection, input, publicKey?.toBase58());
      if (!res.ok || !res.scenario) {
        setError(res.error ?? "Analysis failed.");
      } else {
        setScenario(res.scenario);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
      {/* Input side */}
      <div className="space-y-4">
        <Card>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Zap width={16} height={16} className="text-cyan" />
            Paste an unsigned transaction
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Base64-encoded, unsigned (legacy or v0). SolShield decodes it, simulates it on{" "}
            {activeCluster()}, reads the real program &amp; token metadata, and runs the live scanners.
          </p>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            placeholder="AQAB...base64 transaction..."
            className="mt-3 h-40 w-full resize-none rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus-ring"
          />
          {error && (
            <div className="mt-2 flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-rose-200 ring-1 ring-danger/20">
              <X width={14} height={14} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}
          <button className="btn-primary mt-3 w-full" onClick={run} disabled={busy}>
            {busy ? (
              <>
                <Spinner width={16} height={16} /> Scanning…
              </>
            ) : (
              <>
                <Scan width={16} height={16} /> Scan transaction
              </>
            )}
          </button>
        </Card>

        <Card className="bg-gradient-to-br from-ink-850/80 to-ink-900/60">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldCheck width={16} height={16} className="text-safe" />
            What's real here
          </div>
          <Divider className="my-3" />
          <ul className="space-y-2 text-xs text-slate-400">
            {[
              "Transaction is decoded on your device (legacy + v0, ALTs resolved)",
              `simulateTransaction runs against ${activeCluster()} via RPC`,
              "Program upgrade authority read live from the ProgramData account",
              "Token mint / freeze authority + Token-2022 extensions read from chain",
              "Scanners (Program / Token) run on that real metadata",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <Check width={14} height={14} className="mt-0.5 shrink-0 text-safe" />
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.68rem] leading-relaxed text-slate-500">
            Drainer and phishing blocklists need the SolShield backend intel feeds, so the Wallet
            Scanner here only evaluates structural facts (fee payer, self). Nothing is signed or sent.
          </p>
        </Card>
      </div>

      {/* Result side */}
      <div className="relative min-h-[460px]">
        {!scenario && !busy && (
          <div className="glass flex h-full min-h-[460px] flex-col items-center justify-center gap-3 p-8 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.04] text-slate-500 ring-1 ring-white/10">
              <Scan width={26} height={26} />
            </span>
            <p className="max-w-xs text-sm text-slate-400">
              The live verdict and scanner breakdown will appear here once you scan a transaction.
            </p>
          </div>
        )}
        {busy && (
          <div className="glass grid h-full min-h-[460px] place-items-center p-8">
            <div className="flex flex-col items-center gap-3 text-sm text-slate-300">
              <Spinner width={24} height={24} className="text-cyan" />
              Decoding, simulating and scanning…
            </div>
          </div>
        )}
        {scenario && !decision && (
          <div className="flex justify-center">
            <SigningOverlay
              scenario={scenario}
              onDecision={(d) => setDecision(d)}
              signerAddress={publicKey?.toBase58()}
            />
          </div>
        )}
        {scenario && decision && (
          <div className="grid h-full min-h-[460px] place-items-center">
            <ResultCard decision={decision} scenario={scenario} onReset={() => setDecision(null)} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ shared pieces ============================ */

function BrowserFrame({ domain, children }: { domain: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-900 shadow-card">
      <div className="flex items-center gap-3 border-b border-white/[0.06] bg-ink-850 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-danger/70" />
          <span className="h-3 w-3 rounded-full bg-caution/70" />
          <span className="h-3 w-3 rounded-full bg-safe/70" />
        </div>
        <div className="mono flex flex-1 items-center gap-2 rounded-md bg-black/30 px-3 py-1 text-xs text-slate-400">
          <Globe width={12} height={12} />
          https://{domain}
        </div>
        <span className="chip border-cyan/30 bg-cyan/10 text-[0.62rem] text-cyan">
          <ShieldCheck width={11} height={11} />
          SolShield on
        </span>
      </div>
      {children}
    </div>
  );
}

function ScanProgress({ idx }: { idx: number }) {
  return (
    <div className="glass w-72 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <Spinner width={16} height={16} className="text-cyan" />
        Analyzing transaction…
      </div>
      <div className="mt-4 space-y-2">
        {scanSteps.map((s, i) => {
          const done = i < idx;
          const active = i === idx;
          return (
            <div
              key={s.label}
              className={cx(
                "flex items-center gap-2.5 text-xs transition",
                done ? "text-safe" : active ? "text-slate-200" : "text-slate-600"
              )}
            >
              <span
                className={cx(
                  "grid h-5 w-5 place-items-center rounded-full ring-1",
                  done
                    ? "bg-safe/15 text-safe ring-safe/40"
                    : active
                    ? "bg-cyan/15 text-cyan ring-cyan/40"
                    : "ring-white/10"
                )}
              >
                {done ? <Check width={12} height={12} /> : active ? <Spinner width={12} height={12} /> : s.icon}
              </span>
              {s.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResultCard({
  decision,
  scenario,
  onReset,
}: {
  decision: "allowed" | "blocked" | "overrode";
  scenario: TxScenario;
  onReset: () => void;
}) {
  const map = {
    allowed: {
      icon: <Check width={32} height={32} />,
      color: "text-safe",
      ring: "ring-safe/40 bg-safe/15",
      title: "Signature forwarded",
      desc: "SolShield passed the request to your wallet. The wallet's own approval screen follows.",
    },
    blocked: {
      icon: <ShieldCheck width={32} height={32} />,
      color: "text-cyan",
      ring: "ring-cyan/40 bg-cyan/15",
      title: "Transaction blocked",
      desc: "The dApp received a user-rejected error. Nothing was signed and your funds are safe.",
    },
    overrode: {
      icon: <X width={32} height={32} />,
      color: "text-danger",
      ring: "ring-danger/40 bg-danger/15",
      title: "Override — proceed with caution",
      desc: "You chose to sign a Dangerous transaction. In Strict mode this would have been impossible.",
    },
  }[decision];

  return (
    <div className="glass animate-scale-in w-full max-w-sm p-6 text-center">
      <div className={cx("mx-auto grid h-16 w-16 place-items-center rounded-full ring-1", map.ring, map.color)}>
        {map.icon}
      </div>
      <h3 className="mt-4 text-lg font-bold text-white">{map.title}</h3>
      <p className="mt-1.5 text-sm text-slate-400">{map.desc}</p>
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
        <span>{scenario.dappName}</span>·<VerdictPill verdict={scenario.verdict} size="sm" />
      </div>
      <button className="btn-primary mt-5 w-full" onClick={onReset}>
        Scan another
      </button>
    </div>
  );
}

function PageHeading({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan/20 to-violet/20 text-cyan ring-1 ring-white/10">
        {icon}
      </span>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">{title}</h1>
        <p className="mt-0.5 text-sm text-slate-400">{sub}</p>
      </div>
    </div>
  );
}
