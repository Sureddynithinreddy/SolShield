import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import type { TxScenario } from "@/lib/types";
import { SigningOverlay } from "@/components/SigningOverlay";
import { Card, Divider } from "@/components/ui";
import { VerdictPill } from "@/components/Badges";
import { ConnectWalletButton } from "@/wallet/ConnectWalletButton";
import { cx, shortAddr } from "@/lib/format";
import { scanTransaction, backendConfigured } from "@/lib/api";
import { activeCluster } from "@/lib/solana";
import { Scan, Check, Spinner, ShieldCheck, X, Zap } from "@/components/icons";

export default function SigningDemo() {
  const { connected, publicKey, wallet } = useWallet();
  const signerLabel =
    connected && publicKey ? shortAddr(publicKey.toBase58(), 4, 4) : "No wallet connected";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeading
          icon={<Scan width={22} height={22} />}
          title="Transaction Scanner"
          sub="Paste a real unsigned Solana transaction and SolShield scans it live before you sign."
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

      <RealScanMode />
    </div>
  );
}

function RealScanMode() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<TxScenario | null>(null);
  const [source, setSource] = useState<"backend" | "local" | null>(null);
  const [fellBack, setFellBack] = useState(false);
  const [decision, setDecision] = useState<"allowed" | "blocked" | "overrode" | null>(null);
  const hasBackend = backendConfigured();

  const run = async () => {
    setError(null);
    setScenario(null);
    setSource(null);
    setFellBack(false);
    setDecision(null);
    if (!input.trim()) {
      setError("Paste a base64-encoded unsigned transaction first.");
      return;
    }
    setBusy(true);
    try {
      const res = await scanTransaction(connection, input, {
        origin: undefined,
        signer: publicKey?.toBase58(),
      });
      if (!res.ok || !res.scenario) {
        setError(res.error ?? "Analysis failed.");
      } else {
        setScenario(res.scenario);
        setSource(res.source);
        setFellBack(!!res.fellBack);
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck width={16} height={16} className="text-safe" />
              What's real here
            </div>
            <span
              className={cx(
                "chip text-[0.6rem]",
                hasBackend
                  ? "border-cyan/40 bg-cyan/10 text-cyan"
                  : "border-white/10 bg-white/5 text-slate-400"
              )}
            >
              {hasBackend ? "Backend engine + intel" : "Local engine"}
            </span>
          </div>
          <Divider className="my-3" />
          <ul className="space-y-2 text-xs text-slate-400">
            {[
              "Transaction decoded (legacy + v0, ALTs resolved)",
              `simulateTransaction runs against ${activeCluster()} via RPC`,
              "Program upgrade authority read live from the ProgramData account",
              "Token mint / freeze authority + Token-2022 extensions read from chain",
              hasBackend
                ? "Drainer / sanctioned / phishing / lookalike checks via backend threat intel"
                : "Structural wallet checks only (no backend intel configured)",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <Check width={14} height={14} className="mt-0.5 shrink-0 text-safe" />
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.68rem] leading-relaxed text-slate-500">
            {hasBackend
              ? "If the backend is unreachable, SolShield falls back to the in-browser scanner automatically. Nothing is signed or sent."
              : "Set VITE_API_URL to run scans through the backend with full drainer/phishing intel. Nothing is signed or sent."}
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
          <div className="flex flex-col items-center gap-2">
            {source && (
              <span
                className={cx(
                  "chip text-[0.62rem]",
                  source === "backend"
                    ? "border-cyan/40 bg-cyan/10 text-cyan"
                    : "border-caution/40 bg-caution/10 text-caution"
                )}
              >
                {source === "backend"
                  ? "Scanned by backend (full threat intel)"
                  : fellBack
                  ? "Backend unreachable — local fail-safe scan"
                  : "Scanned by local engine"}
              </span>
            )}
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
