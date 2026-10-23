import { useState } from "react";
import { submitReport, backendConfigured } from "@/lib/api";
import { Card, Divider } from "./ui";
import { cx } from "@/lib/format";
import { AlertTriangle, Check, Globe, Wallet, Spinner } from "./icons";

/**
 * Community scam-reporting form. Submits an address or domain to the backend;
 * reports that reach the confirmation threshold are promoted into the shared
 * threat intel (PRD section 8.3, off-chain reputation).
 */
export function ReportForm({ defaultValue = "" }: { defaultValue?: string }) {
  const hasBackend = backendConfigured();
  const [kind, setKind] = useState<"address" | "domain">("address");
  const [value, setValue] = useState(defaultValue);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setResult(null);
    if (!value.trim()) {
      setError("Enter the address or domain to report.");
      return;
    }
    setBusy(true);
    const res = await submitReport({ kind, value: value.trim(), reason: reason.trim() });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Report failed.");
      return;
    }
    setResult(
      res.status === "confirmed"
        ? "Confirmed by the community — added to the blocklist."
        : `Report received (${res.confirmations} so far). It's added once confirmed by more users.`
    );
    setValue("");
    setReason("");
  };

  return (
    <Card>
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <AlertTriangle width={16} height={16} className="text-caution" />
        Report a scam
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Flag a malicious address or dApp domain. Confirmed community reports feed SolShield's
        threat intel for everyone.
      </p>
      <Divider className="my-3" />

      {!hasBackend ? (
        <p className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-slate-500 ring-1 ring-white/10">
          Reporting needs the backend. Set <span className="mono">VITE_API_URL</span> to enable it.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-1.5">
            {(["address", "domain"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition focus-ring",
                  kind === k
                    ? "bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(34,211,238,0.25)]"
                    : "text-slate-400 hover:bg-white/[0.03]"
                )}
              >
                {k === "address" ? <Wallet width={14} height={14} /> : <Globe width={14} height={14} />}
                {k === "address" ? "Address" : "Domain"}
              </button>
            ))}
          </div>

          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={kind === "address" ? "Wallet or program address…" : "scam-site.example…"}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus-ring"
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What happened? (optional)"
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus-ring"
          />

          {error && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-rose-200 ring-1 ring-danger/20">{error}</p>
          )}
          {result && (
            <p className="flex items-center gap-2 rounded-lg bg-safe/10 px-3 py-2 text-xs text-emerald-200 ring-1 ring-safe/20">
              <Check width={14} height={14} /> {result}
            </p>
          )}

          <button className="btn-primary w-full" onClick={submit} disabled={busy}>
            {busy ? (
              <>
                <Spinner width={16} height={16} /> Submitting…
              </>
            ) : (
              "Submit report"
            )}
          </button>
        </div>
      )}
    </Card>
  );
}
