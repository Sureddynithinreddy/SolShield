import { useEffect, useRef } from "react";
import { Check, Globe, Lock, Shield } from "./icons";
import { Divider } from "./ui";

const rows = [
  { icon: <Shield width={15} height={15} />, label: "Reputation", value: "98 / 100", good: true },
  { icon: <Lock width={15} height={15} />, label: "SSL certificate", value: "Valid", good: true },
  { icon: <Globe width={15} height={15} />, label: "Domain age", value: "4 years", good: true },
  { icon: <Check width={15} height={15} />, label: "Phishing lists", value: "Not listed", good: true },
];

export function SiteReputationPopup({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Site reputation"
      className="glass animate-scale-in absolute right-0 top-11 z-50 w-72 p-4"
    >
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-safe/15 text-safe">
          <Globe width={18} height={18} />
        </span>
        <div>
          <div className="text-sm font-semibold text-white">jup.ag</div>
          <div className="text-xs text-safe">Verified dApp · Trusted</div>
        </div>
      </div>
      <Divider className="my-3" />
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-2 text-slate-400">
              {r.icon}
              {r.label}
            </span>
            <span className={r.good ? "text-safe" : "text-caution"}>{r.value}</span>
          </div>
        ))}
      </div>
      <Divider className="my-3" />
      <p className="text-xs leading-relaxed text-slate-500">
        SolShield checks every site you connect to against phishing lists, domain age and
        lookalike detection before any transaction is signed.
      </p>
    </div>
  );
}
