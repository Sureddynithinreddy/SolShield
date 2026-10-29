import { useEffect, useRef, useState } from "react";
import { Check, Globe, Lock, Shield, AlertTriangle, Spinner } from "./icons";
import { Divider } from "./ui";
import { fetchDomainReputation, backendConfigured } from "@/lib/api";
import { cx } from "@/lib/format";

interface RepResult {
  verdict: "trusted" | "unknown" | "dangerous";
  reputation: number;
  onPhishingList: boolean;
  lookalikeOf?: string;
}

/**
 * Live domain reputation checker. The web app has no "current dApp", so this
 * lets the user check any domain against the backend's real phishing +
 * lookalike intel (/api/reputation) — no hardcoded values.
 */
export function SiteReputationPopup({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [domain, setDomain] = useState("");
  const [result, setResult] = useState<RepResult | null>(null);
  const [checked, setChecked] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasBackend = backendConfigured();

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [onClose]);

  const check = async () => {
    const d = domain.trim();
    if (!d) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const rep = await fetchDomainReputation(d);
    setLoading(false);
    if (!rep) {
      setError(hasBackend ? "Couldn't reach the reputation service." : "Set VITE_API_URL to enable domain checks.");
      return;
    }
    setResult(rep);
    setChecked(d.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, ""));
  };

  const verdictMeta =
    result?.verdict === "dangerous"
      ? { color: "text-danger", bg: "bg-danger/15", label: "Dangerous", Icon: AlertTriangle }
      : result?.verdict === "trusted"
      ? { color: "text-safe", bg: "bg-safe/15", label: "Trusted", Icon: Shield }
      : { color: "text-caution", bg: "bg-caution/15", label: "Unknown", Icon: Globe };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Domain reputation check"
      className="glass animate-scale-in absolute right-0 top-11 z-50 w-80 p-4"
    >
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-cyan/15 text-cyan">
          <Globe width={18} height={18} />
        </span>
        <div>
          <div className="text-sm font-semibold text-white">Domain reputation</div>
          <div className="text-xs text-slate-400">Check any dApp domain against live intel</div>
        </div>
      </div>

      <Divider className="my-3" />

      <div className="flex gap-2">
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && check()}
          placeholder="example.com"
          className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus-ring"
        />
        <button onClick={check} className="btn-primary px-3" disabled={loading} aria-label="Check domain">
          {loading ? <Spinner width={15} height={15} /> : <Check width={15} height={15} />}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs text-rose-200 ring-1 ring-danger/20">
          {error}
        </p>
      )}

      {result && checked && (
        <div className="mt-3">
          <div className={cx("flex items-center justify-between rounded-lg px-3 py-2", verdictMeta.bg)}>
            <span className="inline-flex items-center gap-2 text-sm font-medium text-white">
              <verdictMeta.Icon width={15} height={15} className={verdictMeta.color} />
              <span className="mono">{checked}</span>
            </span>
            <span className={cx("text-sm font-bold", verdictMeta.color)}>{verdictMeta.label}</span>
          </div>
          <div className="mt-2 space-y-1.5">
            <Row label="Reputation" value={`${result.reputation} / 100`} good={result.reputation >= 60} />
            <Row
              label="Phishing list"
              value={result.onPhishingList ? "Listed" : "Not listed"}
              good={!result.onPhishingList}
            />
            <Row
              label="Lookalike"
              value={result.lookalikeOf ? `Mimics ${result.lookalikeOf}` : "No match"}
              good={!result.lookalikeOf}
            />
          </div>
        </div>
      )}

      <Divider className="my-3" />
      <p className="flex items-center gap-1.5 text-[0.68rem] leading-relaxed text-slate-500">
        <Lock width={11} height={11} />
        Checked against the backend's phishing lists and lookalike detection.
      </p>
    </div>
  );
}

function Row({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={good ? "text-safe" : "text-caution"}>{value}</span>
    </div>
  );
}
