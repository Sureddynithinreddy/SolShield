import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Card, StatCard, Divider } from "@/components/ui";
import { ConnectWalletButton } from "@/wallet/ConnectWalletButton";
import { cx, shortAddr } from "@/lib/format";
import { getDelegatedApprovals } from "@/lib/solana";
import { activeCluster, explorerAddrUrl } from "@/lib/solana";
import { assessApprovals, type ApprovalAssessment } from "@shared/detection";
import {
  ShieldCheck,
  AlertTriangle,
  Coin,
  Wallet,
  Spinner,
  ExternalLink,
  Lock,
  Check,
} from "@/components/icons";

type Status = "idle" | "loading" | "ready" | "error";

export default function Portfolio() {
  const { connection } = useConnection();
  const { connected, publicKey } = useWallet();
  const [status, setStatus] = useState<Status>("idle");
  const [approvals, setApprovals] = useState<ApprovalAssessment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!connected || !publicKey) {
      setStatus("idle");
      setApprovals([]);
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setError(null);
    getDelegatedApprovals(connection, publicKey)
      .then((accs) => {
        if (cancelled) return;
        const assessed = assessApprovals(
          accs.map((a) => ({
            account: a.account,
            mint: a.mint,
            delegate: a.delegate,
            delegatedAmount: a.delegatedAmount,
            balance: a.balance,
            knownDelegate: false,
          }))
        );
        setApprovals(assessed);
        setStatus("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to scan approvals");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [connection, publicKey, connected, tick]);

  const high = approvals.filter((a) => a.risk === "high").length;
  const medium = approvals.filter((a) => a.risk === "medium").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan/20 to-violet/20 text-cyan ring-1 ring-white/10">
            <Lock width={22} height={22} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Approval Monitor</h1>
            <p className="mt-0.5 text-sm text-slate-400">
              Standing token approvals that let other addresses move your funds — the lingering-approval drainer vector.
            </p>
          </div>
        </div>
        <ConnectWalletButton compact />
      </div>

      {!connected ? (
        <Card className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-cyan/20 to-violet/20 text-cyan ring-1 ring-white/10">
            <Wallet width={30} height={30} />
          </span>
          <div>
            <h3 className="text-lg font-bold text-white">Connect to scan your approvals</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">
              SolShield reads your token accounts directly from the chain and flags any active
              delegate permissions. Read-only — nothing is signed.
            </p>
          </div>
          <ConnectWalletButton />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Active Approvals"
              value={status === "loading" ? "…" : approvals.length}
              sub="Delegated token accounts"
              icon={<Coin width={18} height={18} />}
            />
            <StatCard
              label="High Risk"
              value={status === "loading" ? "…" : high}
              accent="danger"
              sub="Unknown unlimited delegates"
              icon={<AlertTriangle width={18} height={18} />}
            />
            <StatCard
              label="Needs Review"
              value={status === "loading" ? "…" : medium}
              accent="caution"
              sub="Medium-risk approvals"
              icon={<ShieldCheck width={18} height={18} />}
            />
          </div>

          <Card className="p-0">
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-2 text-white">
                <ShieldCheck width={18} height={18} className="text-cyan" />
                <h3 className="text-sm font-semibold">Standing approvals on {activeCluster()}</h3>
              </div>
              <button onClick={() => setTick((t) => t + 1)} className="text-xs text-cyan hover:underline">
                Rescan
              </button>
            </div>
            <Divider />

            {status === "loading" ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
                <Spinner width={16} height={16} className="text-cyan" /> Scanning your token accounts…
              </div>
            ) : error ? (
              <div className="px-5 py-10 text-center text-sm text-danger">{error}</div>
            ) : approvals.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-safe/15 text-safe ring-1 ring-safe/30">
                  <Check width={22} height={22} />
                </span>
                <h4 className="font-semibold text-white">No active approvals</h4>
                <p className="max-w-sm text-sm text-slate-400">
                  None of your token accounts currently delegate spending authority to another
                  address. That's the safe state.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {approvals.map((a) => (
                  <ApprovalRow key={a.account} a={a} />
                ))}
              </div>
            )}
          </Card>

          <Card className="bg-gradient-to-br from-ink-850/80 to-ink-900/60">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <AlertTriangle width={16} height={16} className="text-caution" />
              How to revoke an approval
            </div>
            <Divider className="my-3" />
            <p className="text-xs leading-relaxed text-slate-400">
              Revoking sends an on-chain <span className="mono">Revoke</span> instruction on the
              token account, which clears the delegate. You can do this from your wallet (Phantom
              and Solflare expose a "Revoke" action per token) or any approvals manager. SolShield
              surfaces the risk here; the revoke itself is a signed transaction you approve in your
              wallet.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}

function ApprovalRow({ a }: { a: ApprovalAssessment }) {
  const riskMeta = {
    high: { cls: "border-danger/40 bg-danger/10 text-danger", label: "High risk" },
    medium: { cls: "border-caution/40 bg-caution/10 text-caution", label: "Review" },
    low: { cls: "border-safe/40 bg-safe/10 text-safe", label: "Low" },
  }[a.risk];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.05] text-slate-400 ring-1 ring-white/10">
          <Coin width={16} height={16} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <a
              href={explorerAddrUrl(a.mint)}
              target="_blank"
              rel="noreferrer"
              className="mono text-sm text-slate-200 hover:text-cyan"
            >
              {shortAddr(a.mint, 4, 4)}
            </a>
            {a.unlimited && (
              <span className="chip border-danger/30 bg-danger/5 text-[0.6rem] text-rose-200">
                full balance
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-slate-400">{a.reason}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[0.68rem] text-slate-500">
            delegate:
            <a
              href={explorerAddrUrl(a.delegate)}
              target="_blank"
              rel="noreferrer"
              className="mono hover:text-cyan"
            >
              {shortAddr(a.delegate, 4, 4)}
            </a>
            <ExternalLink width={10} height={10} />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-sm font-semibold tabular-nums text-slate-200">
            {a.unlimited ? "ALL" : a.delegatedAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </div>
          <div className="text-[0.62rem] text-slate-500">approved</div>
        </div>
        <span className={cx("chip", riskMeta.cls)}>{riskMeta.label}</span>
      </div>
    </div>
  );
}
