import { useMemo, useState } from "react";
import { Card, StatCard } from "@/components/ui";
import { cx, shortAddr } from "@/lib/format";
import { useWalletData } from "@/lib/useWalletData";
import { ConnectWalletButton } from "@/wallet/ConnectWalletButton";
import { explorerTxUrl, relativeTime, type TxHistoryItem } from "@/lib/solana";
import {
  History,
  ShieldCheck,
  Activity,
  ExternalLink,
  Check,
  X,
  Wallet,
  Spinner,
} from "@/components/icons";

type Filter = "all" | "success" | "failed";

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "success", label: "Success" },
  { id: "failed", label: "Failed" },
];

export default function HistoryPage() {
  const { connected, history, status, refresh } = useWalletData();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return history.filter((h) => {
      const matchFilter =
        filter === "all" || (filter === "failed" ? h.err : !h.err);
      const q = query.trim().toLowerCase();
      const matchQuery =
        !q ||
        h.signature.toLowerCase().includes(q) ||
        h.programs.some((p) => p.toLowerCase().includes(q));
      return matchFilter && matchQuery;
    });
  }, [history, filter, query]);

  const failed = history.filter((h) => h.err).length;
  const succeeded = history.length - failed;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan/20 to-violet/20 text-cyan ring-1 ring-white/10">
            <History width={22} height={22} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">History &amp; Insights</h1>
            <p className="mt-0.5 text-sm text-slate-400">
              Your real recent transactions, read live from the Solana network.
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
            <h3 className="text-lg font-bold text-white">Connect to see your history</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">
              SolShield pulls your recent signatures straight from the chain — no server in between.
            </p>
          </div>
          <ConnectWalletButton />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Transactions"
              value={status === "loading" ? "…" : history.length}
              sub="Most recent"
              icon={<Activity width={18} height={18} />}
            />
            <StatCard
              label="Succeeded"
              value={status === "loading" ? "…" : succeeded}
              accent="safe"
              sub="Confirmed on-chain"
              icon={<ShieldCheck width={18} height={18} />}
            />
            <StatCard
              label="Failed"
              value={status === "loading" ? "…" : failed}
              accent="danger"
              sub="Reverted / errored"
              icon={<X width={18} height={18} />}
            />
          </div>

          <Card className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex flex-wrap gap-1.5">
                {filters.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className={cx(
                      "rounded-lg px-3 py-1.5 text-sm font-medium transition focus-ring",
                      filter === f.id
                        ? "bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(34,211,238,0.25)]"
                        : "text-slate-400 hover:bg-white/[0.03]"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search signature or program…"
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus-ring sm:w-72"
              />
            </div>

            {status === "loading" ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
                <Spinner width={16} height={16} className="text-cyan" /> Loading your transactions…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-y border-white/[0.06] text-left label-cap">
                      <th className="px-5 py-3 font-semibold">Time</th>
                      <th className="px-5 py-3 font-semibold">Signature</th>
                      <th className="px-5 py-3 font-semibold">Programs</th>
                      <th className="px-5 py-3 font-semibold">Fee</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((h) => (
                      <tr key={h.signature} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                        <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                          {relativeTime(h.blockTime)}
                        </td>
                        <td className="px-5 py-3">
                          <span className="mono text-slate-300">{shortAddr(h.signature, 6, 6)}</span>
                        </td>
                        <td className="px-5 py-3 text-slate-400">
                          {h.programs.length ? h.programs.join(", ") : "—"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 tabular-nums text-slate-400">
                          {h.feeSol != null ? `${h.feeSol.toFixed(6)} SOL` : "—"}
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
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                          No transactions match your filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3 text-xs text-slate-500">
              <span>
                Showing {filtered.length} of {history.length} transactions
              </span>
              <div className="flex items-center gap-4">
                <button onClick={refresh} className="text-cyan hover:underline">
                  Refresh
                </button>
                <button
                  onClick={() => exportHistory(history)}
                  className="inline-flex items-center gap-1.5 text-cyan hover:underline"
                >
                  <ExternalLink width={13} height={13} />
                  Export (JSON)
                </button>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function exportHistory(history: TxHistoryItem[]) {
  const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "solshield-history.json";
  a.click();
  URL.revokeObjectURL(url);
}
