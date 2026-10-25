import { useState } from "react";
import { Card, StatCard, Divider } from "@/components/ui";
import { cx, shortAddr } from "@/lib/format";
import {
  adminGetReports,
  adminReportAction,
  backendConfigured,
  type AdminReport,
} from "@/lib/api";
import {
  Settings,
  ShieldCheck,
  AlertTriangle,
  Check,
  X,
  Lock,
  Globe,
  Wallet,
  Spinner,
} from "@/components/icons";

type Status = "locked" | "loading" | "ready" | "error";

export default function Admin() {
  const hasBackend = backendConfigured();
  const [adminKey, setAdminKey] = useState("");
  const [status, setStatus] = useState<Status>("locked");
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [counts, setCounts] = useState<{ pending: number; confirmed: number; rejected: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyValue, setBusyValue] = useState<string | null>(null);

  const load = async () => {
    if (!adminKey.trim()) {
      setError("Enter the admin key.");
      return;
    }
    setStatus("loading");
    setError(null);
    const res = await adminGetReports(adminKey.trim());
    if (!res.ok) {
      setStatus("error");
      setError(res.error ?? "Failed to load.");
      return;
    }
    setReports(res.reports);
    setCounts(res.counts ?? null);
    setStatus("ready");
  };

  const act = async (r: AdminReport, action: "confirm" | "reject") => {
    setBusyValue(r.value);
    const res = await adminReportAction(adminKey.trim(), { kind: r.kind, value: r.value, action });
    setBusyValue(null);
    if (res.ok) await load();
    else setError(res.error ?? "Action failed.");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan/20 to-violet/20 text-cyan ring-1 ring-white/10">
          <Settings width={22} height={22} />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Admin · Report Review</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Review community scam reports. Confirming one promotes it into the shared threat intel.
          </p>
        </div>
      </div>

      {!hasBackend ? (
        <Card className="py-12 text-center text-sm text-slate-400">
          The admin console needs the backend. Set <span className="mono">VITE_API_URL</span> to enable it.
        </Card>
      ) : status === "locked" || status === "error" ? (
        <Card className="mx-auto max-w-md">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Lock width={16} height={16} className="text-cyan" />
            Admin access
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Enter the backend <span className="mono">ADMIN_KEY</span>. It's sent only as a header and
            never stored.
          </p>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Admin key"
            className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus-ring"
          />
          {error && (
            <p className="mt-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-rose-200 ring-1 ring-danger/20">
              {error}
            </p>
          )}
          <button className="btn-primary mt-3 w-full" onClick={load}>
            Unlock
          </button>
        </Card>
      ) : status === "loading" ? (
        <Card className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
          <Spinner width={16} height={16} className="text-cyan" /> Loading reports…
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Pending" value={counts?.pending ?? 0} accent="caution" sub="Awaiting review" icon={<AlertTriangle width={18} height={18} />} />
            <StatCard label="Confirmed" value={counts?.confirmed ?? 0} accent="danger" sub="In threat intel" icon={<ShieldCheck width={18} height={18} />} />
            <StatCard label="Rejected" value={counts?.rejected ?? 0} accent="safe" sub="Dismissed" icon={<X width={18} height={18} />} />
          </div>

          <Card className="p-0">
            <div className="flex items-center justify-between p-5">
              <h3 className="text-sm font-semibold text-white">Reports</h3>
              <button onClick={load} className="text-xs text-cyan hover:underline">Refresh</button>
            </div>
            <Divider />
            {reports.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-slate-500">No reports yet.</div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {reports.map((r) => (
                  <div key={`${r.kind}:${r.value}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.05] text-slate-400 ring-1 ring-white/10">
                        {r.kind === "domain" ? <Globe width={16} height={16} /> : <Wallet width={16} height={16} />}
                      </span>
                      <div className="min-w-0">
                        <div className="mono truncate text-sm text-slate-200">
                          {r.kind === "domain" ? r.value : shortAddr(r.value, 6, 6)}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-slate-400">{r.reason || "No reason given"}</div>
                        <div className="mt-1 flex items-center gap-2 text-[0.62rem] text-slate-500">
                          <StatusChip status={r.status} />
                          <span>{r.confirmations} report{r.confirmations === 1 ? "" : "s"}</span>
                        </div>
                      </div>
                    </div>
                    {r.status === "pending" ? (
                      <div className="flex gap-2">
                        <button
                          className="btn-danger px-3 py-1.5 text-xs"
                          disabled={busyValue === r.value}
                          onClick={() => act(r, "confirm")}
                        >
                          {busyValue === r.value ? <Spinner width={13} height={13} /> : <Check width={13} height={13} />}
                          Confirm
                        </button>
                        <button
                          className="btn-ghost px-3 py-1.5 text-xs"
                          disabled={busyValue === r.value}
                          onClick={() => act(r, "reject")}
                        >
                          <X width={13} height={13} /> Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">Resolved</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: AdminReport["status"] }) {
  const map = {
    pending: "border-caution/40 bg-caution/10 text-caution",
    confirmed: "border-danger/40 bg-danger/10 text-danger",
    rejected: "border-slate-500/40 bg-slate-500/10 text-slate-400",
  }[status];
  return <span className={cx("chip text-[0.6rem] capitalize", map)}>{status}</span>;
}
