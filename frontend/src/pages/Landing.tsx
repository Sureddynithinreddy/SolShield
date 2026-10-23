import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { ConnectWalletButton } from "@/wallet/ConnectWalletButton";
import { Card } from "@/components/ui";
import { VerdictPill } from "@/components/Badges";
import { RiskGauge } from "@/components/RiskGauge";
import {
  ArrowRight,
  Scan,
  Layers,
  Wallet,
  Coin,
  Activity,
  Gauge,
  ShieldCheck,
  Code,
  Users,
  Zap,
  Lock,
  Globe,
  ArrowUpRight,
  ArrowDownLeft,
} from "@/components/icons";
import { cx } from "@/lib/format";

/* ---------- small building blocks ---------- */

function NavBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-slate-400 md:flex">
          <a href="#how" className="hover:text-slate-200">How it works</a>
          <a href="#scanners" className="hover:text-slate-200">Protection</a>
          <a href="#personas" className="hover:text-slate-200">Who it's for</a>
          <a href="#metrics" className="hover:text-slate-200">Impact</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/app" className="btn-ghost hidden sm:inline-flex">
            Open demo
          </Link>
          <ConnectWalletButton compact />
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]" />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
        <div className="animate-fade-up">
          <span className="chip border-cyan/30 bg-cyan/10 text-cyan">
            <Lock width={13} height={13} />
            Non-custodial · Solana Mainnet &amp; Devnet
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl">
            Read every transaction
            <br />
            <span className="text-gradient">before you sign it.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-400">
            SolShield is a security firewall that sits between a Solana dApp and your wallet.
            It decodes, scans and simulates every signing request, then gives you a clear{" "}
            <span className="text-safe">Allow</span> or <span className="text-danger">Block</span>{" "}
            decision in under 1.5 seconds.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/onboarding" className="btn-primary px-5 py-2.5 text-base">
              Add to browser — free
              <ArrowRight width={18} height={18} />
            </Link>
            <Link to="/app/signing" className="btn-ghost px-5 py-2.5 text-base">
              <Scan width={18} height={18} />
              Try the live demo
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck width={14} height={14} className="text-safe" />
              Never touches your keys
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap width={14} height={14} className="text-cyan" />
              p95 scan under 1.5s
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Globe width={14} height={14} className="text-violet-soft" />
              Chrome · Brave · Edge
            </span>
          </div>
        </div>

        {/* Hero preview: a mini signing overlay */}
        <div className="animate-scale-in">
          <HeroOverlayPreview />
        </div>
      </div>
    </section>
  );
}

function HeroOverlayPreview() {
  return (
    <div className="glass glow relative mx-auto max-w-md p-5 shadow-glow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-danger/15 text-xl">🎁</span>
          <div>
            <div className="text-sm font-semibold text-white">Solana Airdrop Claim</div>
            <div className="mono text-danger">solana-airdrop-claim.net</div>
          </div>
        </div>
        <VerdictPill verdict="dangerous" />
      </div>

      <div className="mt-4 flex items-center justify-center">
        <RiskGauge score={97} size={200} />
      </div>

      <p className="mt-2 rounded-lg bg-danger/10 px-3 py-2.5 text-center text-sm text-rose-200 ring-1 ring-danger/20">
        This site is trying to take control of your USDC and sweep all your SOL to a confirmed
        drainer wallet.
      </p>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2 text-sm">
          <span className="inline-flex items-center gap-2 text-slate-300">
            <ArrowUpRight width={15} height={15} className="text-danger" />
            You send
          </span>
          <span className="font-semibold text-danger">18.42 SOL + 2,450 USDC</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2 text-sm">
          <span className="inline-flex items-center gap-2 text-slate-300">
            <ArrowDownLeft width={15} height={15} className="text-slate-500" />
            You receive
          </span>
          <span className="font-semibold text-slate-400">Nothing</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="btn-ghost">Reject</button>
        <button className="btn-danger opacity-60" disabled>
          Blocked
        </button>
      </div>
    </div>
  );
}

/* ---------- How it works (architecture pipeline) ---------- */

const pipeline = [
  { icon: <Wallet width={18} height={18} />, title: "Intercept", desc: "Wraps your wallet provider and holds every signing request." },
  { icon: <Code width={18} height={18} />, title: "Decode", desc: "Parses legacy & v0 transactions into plain-language intent." },
  { icon: <Layers width={18} height={18} />, title: "Scan", desc: "Program, wallet and token scanners run in parallel." },
  { icon: <Activity width={18} height={18} />, title: "Simulate", desc: "Dry-runs the transaction to compute real balance changes." },
  { icon: <Gauge width={18} height={18} />, title: "Score", desc: "A rule engine aggregates findings into a 0–100 risk score." },
  { icon: <ShieldCheck width={18} height={18} />, title: "Decide", desc: "You get a clear Allow or Block before anything is signed." },
];

function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHeader
        eyebrow="The pipeline"
        title="Six steps between a dApp and your signature"
        sub="Every request flows through the same security pipeline, from interception to a final verdict."
      />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pipeline.map((p, i) => (
          <Card key={p.title} className="group relative">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan/20 to-violet/20 text-cyan ring-1 ring-white/10">
                {p.icon}
              </span>
              <span className="mono text-slate-600">0{i + 1}</span>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">{p.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-400">{p.desc}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ---------- Scanners / protection ---------- */

const scanners = [
  {
    icon: <Code width={20} height={20} />,
    title: "Program Scanner",
    accent: "from-cyan/20 to-cyan/5",
    points: ["Allowlist & blocklist checks", "Upgrade authority analysis", "Flags programs under 72h old", "Verified-build status"],
  },
  {
    icon: <Wallet width={20} height={20} />,
    title: "Wallet Scanner",
    accent: "from-violet/20 to-violet/5",
    points: ["Confirmed drainer lists", "Address-poisoning detection", "Lookalike domain checks", "Malicious wallet clustering"],
  },
  {
    icon: <Coin width={20} height={20} />,
    title: "Token Scanner",
    accent: "from-emerald-500/20 to-emerald-500/5",
    points: ["Mint & freeze authority", "Token-2022 extension abuse", "Unlimited delegate approvals", "Impersonation tokens"],
  },
  {
    icon: <Activity width={20} height={20} />,
    title: "Simulator",
    accent: "from-amber-500/20 to-amber-500/5",
    points: ["Real net balance changes", "Authority & ownership diffs", "Intent vs. actual comparison", "Worst-case exposure"],
  },
];

function Scanners() {
  return (
    <section id="scanners" className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHeader
        eyebrow="Layered detection"
        title="Four scanners, one verdict"
        sub="Lists, heuristics and live simulation combine to catch the major classes of Solana scams."
      />
      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {scanners.map((s) => (
          <Card key={s.title}>
            <div className="flex items-center gap-3">
              <span className={cx("grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br text-white ring-1 ring-white/10", s.accent)}>
                {s.icon}
              </span>
              <h3 className="text-lg font-semibold text-white">{s.title}</h3>
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-y-2 gap-x-4">
              {s.points.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                  {p}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ---------- Threats covered ---------- */

const threats = [
  "Wallet drainers", "Unlimited delegate approvals", "Account authority takeover",
  "Fake airdrop phishing", "Address poisoning", "Rug-pull & honeypot tokens",
  "Token-2022 abuse", "Lookalike dApps", "Blind-signing attacks", "Durable-nonce traps",
];

function Threats() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Card className="bg-gradient-to-br from-ink-850/80 to-ink-900/60">
        <SectionHeader
          align="left"
          eyebrow="Threat model"
          title="What SolShield blocks"
          sub="A single signature can be irreversible. These are the attacks we stop before it happens."
        />
        <div className="mt-6 flex flex-wrap gap-2">
          {threats.map((t) => (
            <span key={t} className="chip border-danger/25 bg-danger/5 text-rose-200">
              {t}
            </span>
          ))}
        </div>
      </Card>
    </section>
  );
}

/* ---------- Personas ---------- */

const personas = [
  { icon: "🧑‍💻", role: "Retail trader", need: "A simple 'safe or not' answer, no jargon." },
  { icon: "📈", role: "DeFi power user", need: "Detailed simulation, custom rules, low friction." },
  { icon: "🏛️", role: "DAO / treasury signer", need: "Strict policy enforcement and an audit trail." },
  { icon: "🌱", role: "New user", need: "Education and hard protection from obvious scams." },
  { icon: "🔬", role: "Security researcher", need: "API access and full rule transparency." },
];

function Personas() {
  return (
    <section id="personas" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHeader eyebrow="Who it's for" title="Built for everyone who signs" />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {personas.map((p) => (
          <Card key={p.role} className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-2xl ring-1 ring-white/10">
              {p.icon}
            </span>
            <div>
              <div className="flex items-center gap-2 text-white">
                <Users width={15} height={15} className="text-violet-soft" />
                <h3 className="font-semibold">{p.role}</h3>
              </div>
              <p className="mt-1 text-sm text-slate-400">{p.need}</p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ---------- Metrics ---------- */

const metrics = [
  { value: "≥95%", label: "Drainer detection rate" },
  { value: "<2%", label: "False-positive rate" },
  { value: "<1.5s", label: "p95 scan latency" },
  { value: "$0", label: "Keys or funds held" },
];

function Metrics() {
  return (
    <section id="metrics" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHeader eyebrow="Targets" title="Protection you can measure" />
      <div className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label} className="text-center">
            <div className="text-4xl font-extrabold tracking-tight text-gradient">{m.value}</div>
            <div className="mt-2 text-sm text-slate-400">{m.label}</div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="glass relative overflow-hidden p-10 text-center shadow-glow-violet">
        <div className="pointer-events-none absolute inset-0 bg-radial-glow" />
        <h2 className="relative text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          No one should lose funds because they
          <br className="hidden sm:block" /> couldn't read what they were signing.
        </h2>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/onboarding" className="btn-primary px-6 py-3 text-base">
            Get SolShield free
            <ArrowRight width={18} height={18} />
          </Link>
          <Link to="/app" className="btn-ghost px-6 py-3 text-base">
            Explore the dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 text-sm text-slate-500 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2">
          <Logo compact />
          <span className="text-slate-400">SolShield</span>
          <span className="mono rounded bg-white/5 px-1.5 py-0.5 text-slate-500">v1.0 demo</span>
        </div>
        <p className="text-center">
          A Web3 security firewall for Solana. Non-custodial. This is a frontend demo with mock data.
        </p>
      </div>
    </footer>
  );
}

/* ---------- shared ---------- */

function SectionHeader({
  eyebrow,
  title,
  sub,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={cx(align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl")}>
      <span className="label-cap text-cyan">{eyebrow}</span>
      <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{title}</h2>
      {sub && <p className="mt-3 text-slate-400">{sub}</p>}
    </div>
  );
}

export default function Landing() {
  return (
    <div>
      <NavBar />
      <Hero />
      <HowItWorks />
      <Scanners />
      <Threats />
      <Personas />
      <Metrics />
      <CTA />
      <Footer />
    </div>
  );
}
