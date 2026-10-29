import { useEffect, useState } from "react";
import { Card, Divider, Toggle } from "@/components/ui";
import { SeverityTag } from "@/components/Badges";
import { ReportForm } from "@/components/ReportForm";
import { useSettings, type SaveState } from "@/lib/useSettings";
import { fetchRulePack, type RuleDef, type UserListEntry, type UserRuleEntry } from "@/lib/api";
import { cx } from "@/lib/format";
import {
  Settings,
  ShieldCheck,
  Lock,
  Code,
  Plus,
  Trash,
  Check,
  Globe,
  Wallet,
  Fingerprint,
  Eye,
  AlertTriangle,
  Users,
  Spinner,
} from "@/components/icons";

type Tab = "general" | "lists" | "rules" | "privacy" | "community";
type Strictness = "relaxed" | "balanced" | "strict";

const tabs: { id: Tab; label: string; icon: JSX.Element }[] = [
  { id: "general", label: "General", icon: <Settings width={16} height={16} /> },
  { id: "lists", label: "Allow & block", icon: <ShieldCheck width={16} height={16} /> },
  { id: "rules", label: "Rules", icon: <Code width={16} height={16} /> },
  { id: "community", label: "Community", icon: <Users width={16} height={16} /> },
  { id: "privacy", label: "Privacy", icon: <Lock width={16} height={16} /> },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("general");
  const settings = useSettings();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan/20 to-violet/20 text-cyan ring-1 ring-white/10">
            <Settings width={22} height={22} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Settings</h1>
            <p className="mt-0.5 text-sm text-slate-400">
              Tune protection, manage lists and control your privacy.
            </p>
          </div>
        </div>
        <SaveBadge persists={settings.persists} state={settings.saveState} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cx(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition focus-ring",
              tab === t.id
                ? "bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(34,211,238,0.25)]"
                : "text-slate-400 hover:bg-white/[0.03]"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <GeneralTab
          strictness={settings.settings.strictness}
          onStrictness={settings.setStrictness}
        />
      )}
      {tab === "lists" && (
        <ListsTab lists={settings.settings.lists} loading={settings.loading} onChange={settings.setLists} />
      )}
      {tab === "rules" && (
        <RulesTab rules={settings.settings.rules} loading={settings.loading} onChange={settings.setRules} />
      )}
      {tab === "community" && <CommunityTab />}
      {tab === "privacy" && <PrivacyTab />}
    </div>
  );
}

function SaveBadge({ persists, state }: { persists: boolean; state: SaveState }) {
  if (!persists) {
    return (
      <span className="chip border-white/10 bg-white/5 text-[0.62rem] text-slate-400">
        Connect a wallet to sync settings
      </span>
    );
  }
  const map: Record<SaveState, { cls: string; label: string }> = {
    idle: { cls: "border-white/10 bg-white/5 text-slate-400", label: "Synced to your wallet" },
    saving: { cls: "border-cyan/40 bg-cyan/10 text-cyan", label: "Saving…" },
    saved: { cls: "border-safe/40 bg-safe/10 text-safe", label: "Saved" },
    error: { cls: "border-danger/40 bg-danger/10 text-danger", label: "Save failed" },
    local: { cls: "border-white/10 bg-white/5 text-slate-400", label: "Local only" },
  };
  const m = map[state];
  return <span className={cx("chip text-[0.62rem]", m.cls)}>{m.label}</span>;
}

/* ------------------------------ Community ------------------------------ */

function CommunityTab() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <ReportForm />
      <Card className="bg-gradient-to-br from-ink-850/80 to-ink-900/60">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <AlertTriangle width={16} height={16} className="text-caution" />
          How community intel works
        </div>
        <Divider className="my-3" />
        <ul className="space-y-2.5 text-xs text-slate-400">
          {[
            "Anyone can report a scam address or dApp domain.",
            "Once enough users report the same entry, it's auto-confirmed.",
            "Confirmed reports are merged into the shared threat intel.",
            "From then on, every scan flags that address or domain for everyone.",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <Check width={14} height={14} className="mt-0.5 shrink-0 text-safe" />
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[0.68rem] leading-relaxed text-slate-500">
          This is the off-chain half of the PRD's reputation registry. The on-chain,
          stake-and-slash version is a later phase.
        </p>
      </Card>
    </div>
  );
}

/* ------------------------------- General ------------------------------- */

const strictnessInfo: Record<Strictness, { label: string; desc: string }> = {
  relaxed: { label: "Relaxed", desc: "Only warns on confirmed-malicious activity." },
  balanced: { label: "Balanced", desc: "Recommended mix of protection and friction." },
  strict: { label: "Strict", desc: "Blocks anything unusual. Dangerous verdicts can't be overridden." },
};

function GeneralTab({
  strictness,
  onStrictness,
}: {
  strictness: Strictness;
  onStrictness: (s: Strictness) => void;
}) {
  const [overrideAllowed, setOverrideAllowed] = useState(true);
  const [outflowThreshold, setOutflowThreshold] = useState(5);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h3 className="text-sm font-semibold text-white">Protection level</h3>
        <p className="mt-1 text-xs text-slate-400">Controls how aggressively SolShield blocks.</p>
        <div className="mt-4 space-y-2">
          {(Object.keys(strictnessInfo) as Strictness[]).map((s) => {
            const active = strictness === s;
            return (
              <button
                key={s}
                onClick={() => onStrictness(s)}
                className={cx(
                  "flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition focus-ring",
                  active ? "border-cyan/50 bg-cyan/[0.06]" : "border-white/10 bg-white/[0.02] hover:border-white/20"
                )}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{strictnessInfo[s].label}</span>
                    {s === "balanced" && (
                      <span className="chip border-cyan/40 bg-cyan/10 text-[0.62rem] text-cyan">Recommended</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">{strictnessInfo[s].desc}</p>
                </div>
                <span
                  className={cx(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-full border",
                    active ? "border-cyan bg-cyan text-ink-950" : "border-white/20"
                  )}
                >
                  {active && <Check width={12} height={12} />}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="space-y-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Allow overriding Dangerous verdicts</h3>
              <p className="mt-1 text-xs text-slate-400">
                When on, you can sign a blocked transaction via a two-step confirm.
              </p>
            </div>
            <Toggle checked={overrideAllowed} onChange={setOverrideAllowed} label="Allow override" />
          </div>
          {strictness === "strict" && (
            <p className="mt-3 rounded-lg bg-caution/10 px-3 py-2 text-xs text-caution ring-1 ring-caution/20">
              Strict mode forces this off — Dangerous verdicts cannot be overridden.
            </p>
          )}
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-white">Large outflow threshold</h3>
          <p className="mt-1 text-xs text-slate-400">
            Warn when a transaction sends more than this amount to an unknown wallet.
          </p>
          <div className="mt-4 flex items-center gap-4">
            <input
              type="range"
              min={1}
              max={50}
              value={outflowThreshold}
              onChange={(e) => setOutflowThreshold(Number(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan"
            />
            <span className="mono w-20 rounded-md bg-black/30 px-2 py-1 text-center text-sm text-cyan ring-1 ring-white/5">
              {outflowThreshold} SOL
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* -------------------------------- Lists -------------------------------- */

const kindIcon: Record<string, JSX.Element> = {
  domain: <Globe width={14} height={14} />,
  program: <Code width={14} height={14} />,
  address: <Wallet width={14} height={14} />,
};

function ListsTab({
  lists,
  loading,
  onChange,
}: {
  lists: UserListEntry[];
  loading: boolean;
  onChange: (lists: UserListEntry[]) => void;
}) {
  const allow = lists.filter((e) => e.type === "allow");
  const block = lists.filter((e) => e.type === "block");

  const addEntry = (entry: UserListEntry) => onChange([entry, ...lists]);
  const removeAt = (entry: UserListEntry) =>
    onChange(lists.filter((e) => !(e.value === entry.value && e.type === entry.type)));

  if (loading) return <LoadingCard />;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ListCard title="Allowlist" accent="safe" type="allow" entries={allow} onAdd={addEntry} onRemove={removeAt} />
      <ListCard title="Blocklist" accent="danger" type="block" entries={block} onAdd={addEntry} onRemove={removeAt} />
    </div>
  );
}

function ListCard({
  title,
  accent,
  type,
  entries,
  onAdd,
  onRemove,
}: {
  title: string;
  accent: "safe" | "danger";
  type: "allow" | "block";
  entries: UserListEntry[];
  onAdd: (entry: UserListEntry) => void;
  onRemove: (entry: UserListEntry) => void;
}) {
  const [value, setValue] = useState("");

  const add = () => {
    const v = value.trim();
    if (!v) return;
    const kind: UserListEntry["kind"] = v.includes(".") ? "domain" : v.length > 30 ? "address" : "program";
    onAdd({ value: v, label: "Added by you", kind, type });
    setValue("");
  };

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <span className={cx("h-2.5 w-2.5 rounded-full", accent === "safe" ? "bg-safe" : "bg-danger")} />
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <span className="chip border-white/10 bg-white/5 text-[0.62rem] text-slate-400">{entries.length}</span>
        </div>
      </div>
      <Divider />
      <div className="flex gap-2 p-4">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Domain, program ID or address…"
          className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus-ring"
        />
        <button onClick={add} className="btn-ghost px-3" aria-label={`Add to ${title}`}>
          <Plus width={16} height={16} />
        </button>
      </div>
      <div className="max-h-80 space-y-1.5 overflow-y-auto px-4 pb-4">
        {entries.length === 0 && (
          <p className="px-1 py-2 text-xs text-slate-500">No entries yet. Add a domain, program ID or address above.</p>
        )}
        {entries.map((e, i) => (
          <div
            key={e.value + i}
            className="group flex items-center justify-between gap-2 rounded-lg bg-black/20 px-3 py-2 ring-1 ring-white/5"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-slate-500">{kindIcon[e.kind]}</span>
              <div className="min-w-0">
                <div className="mono truncate text-xs text-slate-200">{e.value}</div>
                <div className="text-[0.62rem] text-slate-500">{e.label}</div>
              </div>
            </div>
            <button
              onClick={() => onRemove(e)}
              className="shrink-0 rounded-md p-1 text-slate-600 opacity-0 transition hover:bg-white/10 hover:text-danger focus-ring group-hover:opacity-100"
              aria-label="Remove"
            >
              <Trash width={14} height={14} />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* -------------------------------- Rules -------------------------------- */

function RulesTab({
  rules,
  loading,
  onChange,
}: {
  rules: UserRuleEntry[];
  loading: boolean;
  onChange: (rules: UserRuleEntry[]) => void;
}) {
  const [text, setText] = useState("");
  const [pack, setPack] = useState<{ version: string; rules: RuleDef[] } | null>(null);
  const [packLoading, setPackLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchRulePack()
      .then((p) => !cancelled && setPack(p))
      .finally(() => !cancelled && setPackLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (id: string) =>
    onChange(rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));

  const add = () => {
    const t = text.trim();
    if (!t) return;
    onChange([{ id: `u${Date.now()}`, text: t, enabled: true, severity: "medium" }, ...rules]);
    setText("");
  };

  const remove = (id: string) => onChange(rules.filter((r) => r.id !== id));

  if (loading) return <LoadingCard />;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-0">
        <div className="p-4">
          <h3 className="text-sm font-semibold text-white">Your rules</h3>
          <p className="mt-1 text-xs text-slate-400">Custom rules run on top of the built-in pack.</p>
        </div>
        <Divider />
        <div className="flex gap-2 p-4">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="e.g. Block transfers above 10 SOL to new wallets"
            className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus-ring"
          />
          <button onClick={add} className="btn-ghost px-3" aria-label="Add rule">
            <Plus width={16} height={16} />
          </button>
        </div>
        <div className="space-y-1.5 px-4 pb-4">
          {rules.length === 0 && (
            <p className="px-1 py-2 text-xs text-slate-500">No custom rules yet.</p>
          )}
          {rules.map((r) => (
            <div
              key={r.id}
              className="group flex items-center justify-between gap-3 rounded-lg bg-black/20 px-3 py-2.5 ring-1 ring-white/5"
            >
              <div className="flex items-center gap-2.5">
                <Toggle checked={r.enabled} onChange={() => toggle(r.id)} label={r.text} />
                <span className={cx("text-sm", r.enabled ? "text-slate-200" : "text-slate-500 line-through")}>
                  {r.text}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <SeverityTag severity={r.severity} />
                <button
                  onClick={() => remove(r.id)}
                  className="rounded-md p-1 text-slate-600 opacity-0 transition hover:bg-white/10 hover:text-danger focus-ring group-hover:opacity-100"
                  aria-label="Remove rule"
                >
                  <Trash width={13} height={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-0">
        <div className="p-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">Built-in rule pack</h3>
            {pack && (
              <span className="chip border-cyan/30 bg-cyan/10 text-[0.62rem] text-cyan">
                signed · v{pack.version}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Verified before use. Every verdict lists the rules that fired.
          </p>
        </div>
        <Divider />
        {packLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-400">
            <Spinner width={14} height={14} className="text-cyan" /> Loading rule pack…
          </div>
        ) : !pack ? (
          <p className="px-4 py-6 text-xs text-slate-500">
            The built-in rule pack is served by the backend. Set <span className="mono">VITE_API_URL</span> to view it.
          </p>
        ) : (
          <div className="max-h-96 space-y-1 overflow-y-auto px-4 py-3">
            {pack.rules.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="mono shrink-0 text-slate-600">{r.id}</span>
                  <span className="truncate text-slate-300" title={r.description}>{r.title}</span>
                </span>
                <SeverityTag severity={r.severity} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function LoadingCard() {
  return (
    <Card className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
      <Spinner width={16} height={16} className="text-cyan" /> Loading your settings…
    </Card>
  );
}

/* ------------------------------- Privacy ------------------------------- */

function PrivacyTab() {
  const [telemetry, setTelemetry] = useState(true);
  const [hashAddr, setHashAddr] = useState(true);
  const [localHistory, setLocalHistory] = useState(true);
  const [failSafe, setFailSafe] = useState(true);

  const toggles = [
    {
      icon: <Eye width={16} height={16} />,
      title: "Anonymous telemetry",
      desc: "Share verdicts & rules fired to improve detection. Opt-in.",
      v: telemetry,
      set: setTelemetry,
    },
    {
      icon: <Fingerprint width={16} height={16} />,
      title: "Hash wallet addresses in analytics",
      desc: "Addresses are never stored in plain text.",
      v: hashAddr,
      set: setHashAddr,
    },
    {
      icon: <Lock width={16} height={16} />,
      title: "Keep local transaction history",
      desc: "Stored only on this device. Clearing is instant.",
      v: localHistory,
      set: setLocalHistory,
    },
    {
      icon: <ShieldCheck width={16} height={16} />,
      title: "Fail-safe local mode",
      desc: "If the backend is unreachable, run local rules and warn you.",
      v: failSafe,
      set: setFailSafe,
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card className="space-y-1">
        {toggles.map((t, i) => (
          <div key={t.title}>
            <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-cyan">{t.icon}</span>
                <div>
                  <h3 className="text-sm font-semibold text-white">{t.title}</h3>
                  <p className="mt-0.5 text-xs text-slate-400">{t.desc}</p>
                </div>
              </div>
              <Toggle checked={t.v} onChange={t.set} label={t.title} />
            </label>
            {i < toggles.length - 1 && <Divider />}
          </div>
        ))}
      </Card>

      <Card className="bg-gradient-to-br from-ink-850/80 to-ink-900/60">
        <div className="flex items-center gap-2 text-safe">
          <Lock width={18} height={18} />
          <h3 className="text-sm font-semibold">Non-custodial by design</h3>
        </div>
        <Divider className="my-3" />
        <ul className="space-y-2.5 text-xs text-slate-400">
          {[
            "Private keys & seed phrases never leave your device.",
            "Only the unsigned transaction and domain are sent for scanning.",
            "No signatures are ever transmitted.",
            "GDPR / CCPA-aligned data handling.",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <Check width={14} height={14} className="mt-0.5 shrink-0 text-safe" />
              {t}
            </li>
          ))}
        </ul>
        <button className="btn-danger mt-5 w-full">
          <Trash width={15} height={15} />
          Clear all local data
        </button>
      </Card>
    </div>
  );
}
