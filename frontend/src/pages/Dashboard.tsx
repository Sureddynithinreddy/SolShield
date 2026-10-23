import { Link } from "react-router-dom";
import { scanTrend, threatBreakdown } from "@/lib/mock";
import { StatCard, Card, Divider } from "@/components/ui";
import { cx, shortAddr } from "@/lib/format";
import { useWalletData } from "@/lib/useWalletData";
import { ConnectWalletButton } from "@/wallet/ConnectWalletButton";
import { activeCluster, explorerAddrUrl, explorerTxUrl, relativeTime } from "@/lib/solana";
import {
  Activity,
  ShieldCheck,
  AlertTriangle,
  Scan,
  ArrowRight,
  Globe,
  Wallet,
  Coin,
  Spinner,
  ExternalLink,
  Check,
  X,
} from "@/components/icons";

export default function Dashboard() {
  const data = useWalletData();
  const { connected, address, snapshot, history, status } = data;

  const tokenCount = snapshot?.tokens.length ?? 0;
  const solBalance = snapshot?.solBalance ?? 0;
  const txCount = history.length;
  const failedCount = history.filter((h) => h.err).length;

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="label-cap text-cyan">Command Center</span>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
            Protection overview
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            {connected && address ? (
              <>
                Live data for{" "}
                <a
                  href={explorerAddrUrl(address)}
                  target="_blank"
                  rel="noreferrer"
                  className="mono text-slate-300 hover:text-cyan"
                >
                  {shortAddr(address, 4, 4)}
                </a>{" "}
                on Solana {activeCluster()}.
              </>
            ) : (
              "Connect a wallet to see your real balances and on-chain activity."
            )}
          </p>
        </div>
        <Link to="/app/signing" className="btn-primary">
          <Scan width={16} height={16} />
          Scan a transaction
        </Link>
      </div>

      {!connected ? (
        <NotConnected />
      ) : (
        <>
          {/* Top stats — real wallet data */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="SOL Balance"
              value={
                status === "loading" ? (
                  <Spinner width={22} height={22} />
                ) : (
                  `${solBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
                )
              }
              sub="Native SOL"
              accent="cyan"
              icon={<Wallet width={18} height={18} />}
            />
            <StatCard
              label="Token Accounts"
              value={status === "loading" ? "…" : tokenCount}
              sub="Non-zero SPL / Token-2022"
              accent="violet"
              icon={<Coin width={18} height={18} />}
            />
            <StatCard
              label="Recent Txns"
              value={status === "loading" ? "…" : txCount}
              sub={`${failedCount} failed`}
              accent="safe"
              icon={<Activity width={18} height={18} />}
            />
            <StatCard
              label="Protection"
              value={<span className="text-safe">Active</span>}
              sub="Firewall watching signs"
              accent="safe"
              icon={<ShieldCheck width={18} height={18} />}
            />
          </div>

          {/* Your assets — real balances */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2 p-0">
              <div className="flex items-center justify-between p-5">
                <div className="flex items-center gap-2 text-white">
                  <Coin width={18} height={18} className="text-cyan" />
                  <h3 className="text-sm font-semibold">Your assets</h3>
                </div>
                <button
                  onClick={data.refresh}
                  className="inline-flex items-center gap-1 text-xs text-cyan hover:underline"
                >
                  Refresh
                </button>
              </div>
              <Divider />
              <AssetList
                loading={status === "loading"}
                solBalance={solBalance}
                tokens={snapshot?.tokens ?? []}
              />
            </Card>

            {/* Threat intel — labeled sample (no public backend to source from) */}
            <Card>
              <div className="mb-1 flex items-center gap-2 text-white">
                <AlertTriangle width={18} height={18} className="text-caution" />
                <h3 className="text-sm font-semibold">Threat intel</h3>
              </div>
              <SampleTag />
              <div className="mt-3 space-y-3">
                {threatBreakdown.map((t) => {
                  const max = Math.max(...threatBreakdown.map((x) => x.count));
                  return (
                    <div key={t.label}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300">{t.label}</span>
                        <span className="mono text-slate-400">{t.count}</span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(t.count / max) * 100}%`,
                            background: t.color,
                            boxShadow: `0 0 10px ${t.color}80`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Scanner health (live engines) + sample activity chart */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <Activity width={18} height={18} className="text-cyan" />
                  <h3 className="text-sm font-semibold">Scan activity · 14 days</h3>
                </div>
                <Legend />
              </div>
              <SampleTag />
              <div className="mt-3">
                <ScanChart />
              </div>
            </Card>

            <Card>
              <div className="mb-3 flex items-center gap-2 text-white">
                <ShieldCheck width={18} height={18} className="text-safe" />
                <h3 className="text-sm font-semibold">Scanner status</h3>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: "Program Scanner", ok: true },
                  { label: "Wallet Scanner", ok: true },
                  { label: "Token Scanner", ok: true },
                  { label: `RPC (${activeCluster()})`, ok: status !== "error" },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{s.label}</span>
                    <span
                      className={cx(
                        "chip text-[0.62rem]",
                        s.ok ? "border-safe/40 bg-safe/10 text-safe" : "border-danger/40 bg-danger/10 text-danger"
                      )}
                    >
                      {s.ok ? "Operational" : "Degraded"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Recent on-chain activity — real signatures */}
          <Card className="p-0">
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-2 text-white">
                <Globe width={18} height={18} className="text-cyan" />
                <h3 className="text-sm font-semibold">Recent on-chain activity</h3>
              </div>
              <Link
                to="/app/history"
                className="inline-flex items-center gap-1 text-xs text-cyan hover:underline"
              >
                View all <ArrowRight width={14} height={14} />
              </Link>
            </div>
            <RecentActivity loading={status === "loading"} history={history.slice(0, 6)} />
          </Card>
        </>
      )}
    </div>
  );
}

function NotConnected() {
  return (
    <Card className="flex flex-col items-center gap-4 py-16 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-cyan/20 to-violet/20 text-cyan ring-1 ring-white/10">
        <Wallet width={30} height={30} />
      </span>
      <div>
        <h3 className="text-lg font-bold text-white">Connect your wallet</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">
          SolShield reads your live SOL balance, token holdings and recent transactions
          directly from the Solana network. Nothing is sent anywhere — it's read-only.
        </p>
      </div>
      <ConnectWalletButton />
    </Card>
  );
}

function AssetList({
  loading,
  solBalance,
  tokens,
}: {
  loading: boolean;
  solBalance: number;
  tokens: { mint: string; amount: number; token2022: boolean }[];
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
        <Spinner width={16} height={16} className="text-cyan" /> Loading balances…
      </div>
    );
  }
  return (
    <div className="divide-y divide-white/[0.04]">
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-cyan to-violet text-ink-950 text-xs font-bold">
            SOL
          </span>
          <div>
            <div className="font-medium text-white">Solana</div>
            <div className="text-[0.68rem] text-slate-500">Native</div>
          </div>
        </div>
        <span className="font-semibold tabular-nums text-slate-200">
          {solBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })} SOL
        </span>
      </div>
      {tokens.length === 0 ? (
        <div className="px-5 py-4 text-sm text-slate-500">No SPL token balances found.</div>
      ) : (
        tokens.slice(0, 8).map((t) => (
          <div key={t.mint} className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.05] text-slate-400 ring-1 ring-white/10">
                <Coin width={15} height={15} />
              </span>
              <div>
                <a
                  href={explorerAddrUrl(t.mint)}
                  target="_blank"
                  rel="noreferrer"
                  className="mono text-sm text-slate-200 hover:text-cyan"
                >
                  {shortAddr(t.mint, 4, 4)}
                </a>
                <div className="text-[0.68rem] text-slate-500">
                  {t.token2022 ? "Token-2022" : "SPL Token"}
                </div>
              </div>
            </div>
            <span className="font-semibold tabular-nums text-slate-200">
              {t.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

function RecentActivity({
  loading,
  history,
}: {
  loading: boolean;
  history: import("@/lib/solana").TxHistoryItem[];
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
        <Spinner width={16} height={16} className="text-cyan" /> Loading activity…
      </div>
    );
  }
  if (history.length === 0) {
    return <div className="px-5 py-8 text-center text-sm text-slate-500">No recent transactions.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-y border-white/[0.06] text-left label-cap">
            <th className="px-5 py-3 font-semibold">Time</th>
            <th className="px-5 py-3 font-semibold">Signature</th>
            <th className="px-5 py-3 font-semibold">Programs</th>
            <th className="px-5 py-3 font-semibold">Status</th>
            <th className="px-5 py-3 font-semibold"></th>
          </tr>
        </thead>
        <tbody>
          {history.map((h) => (
            <tr key={h.signature} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
              <td className="whitespace-nowrap px-5 py-3 text-slate-500">{relativeTime(h.blockTime)}</td>
              <td className="px-5 py-3">
                <span className="mono text-slate-300">{shortAddr(h.signature, 6, 6)}</span>
              </td>
              <td className="px-5 py-3 text-slate-400">
                {h.programs.length ? h.programs.join(", ") : "—"}
              </td>
              <td className="px-5 py-3">
                {h.err ? (
                  <span className="chip border-danger/40 bg-danger/10 text-danger">
                    <X width={11} height={11} /> Failed
                  </span>
                ) : (
                  <span className="chip border-safe/40 bg-safe/10 text-safe">
                    <Check width={11} height={11} /> Success
                  </span>
                )}
              </td>
              <td className="px-5 py-3 text-right">
                <a
                  href={explorerTxUrl(h.signature)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-cyan hover:underline"
                >
                  <ExternalLink width={12} height={12} /> View
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SampleTag() {
  return (
    <span className="chip border-white/10 bg-white/[0.03] text-[0.6rem] text-slate-500">
      Sample data
    </span>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-[0.68rem] text-slate-400">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-safe" /> Safe
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-caution" /> Caution
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-danger" /> Dangerous
      </span>
    </div>
  );
}

function ScanChart() {
  const max = Math.max(...scanTrend.map((d) => d.safe + d.caution + d.dangerous));
  return (
    <div className="flex h-48 items-end gap-1.5">
      {scanTrend.map((d) => {
        const total = d.safe + d.caution + d.dangerous;
        const h = (total / max) * 100;
        return (
          <div key={d.d} className="group relative flex flex-1 flex-col justify-end" style={{ height: "100%" }}>
            <div
              className="flex w-full flex-col overflow-hidden rounded-md transition-all"
              style={{ height: `${h}%` }}
            >
              <div style={{ height: `${(d.dangerous / total) * 100}%`, background: "#f43f5e" }} />
              <div style={{ height: `${(d.caution / total) * 100}%`, background: "#fbbf24" }} />
              <div style={{ height: `${(d.safe / total) * 100}%`, background: "#34d399" }} />
            </div>
            <div className="pointer-events-none absolute -top-1 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-white/10 bg-ink-800 px-2 py-1 text-[0.62rem] text-slate-200 shadow-lg group-hover:block">
              {total} scans · <span className="text-danger">{d.dangerous} blocked</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
