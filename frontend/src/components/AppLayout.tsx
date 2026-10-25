import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Logo } from "./Logo";
import { cx } from "@/lib/format";
import { Activity, Scan, History, Settings, Globe, Menu, X, Lock } from "./icons";
import { SiteReputationPopup } from "./SiteReputationPopup";
import { ConnectWalletButton } from "@/wallet/ConnectWalletButton";

const nav = [
  { to: "/app", label: "Command Center", icon: <Activity width={18} height={18} />, end: true },
  { to: "/app/signing", label: "Live Signing", icon: <Scan width={18} height={18} /> },
  { to: "/app/portfolio", label: "Approvals", icon: <Lock width={18} height={18} /> },
  { to: "/app/history", label: "History & Insights", icon: <History width={18} height={18} /> },
  { to: "/app/settings", label: "Settings", icon: <Settings width={18} height={18} /> },
];

export default function AppLayout() {
  const [repOpen, setRepOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const loc = useLocation();

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Logo to="/app" />

          <nav className="ml-6 hidden items-center gap-1 md:flex">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cx(
                    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition focus-ring",
                    isActive
                      ? "bg-white/[0.06] text-white shadow-[inset_0_0_0_1px_rgba(34,211,238,0.25)]"
                      : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200"
                  )
                }
              >
                {n.icon}
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {/* Site reputation badge (toolbar) */}
            <div className="relative">
              <button
                onClick={() => setRepOpen((v) => !v)}
                className="chip border-safe/40 bg-safe/10 text-safe focus-ring"
                aria-haspopup="dialog"
                aria-expanded={repOpen}
              >
                <Globe width={14} height={14} />
                <span className="hidden sm:inline">jup.ag</span>
                <span className="font-semibold">98</span>
              </button>
              {repOpen && <SiteReputationPopup onClose={() => setRepOpen(false)} />}
            </div>

            <ConnectWalletButton compact />

            <button
              className="btn-ghost px-2 md:hidden"
              onClick={() => setMobileNav((v) => !v)}
              aria-label="Toggle navigation"
            >
              {mobileNav ? <X width={18} height={18} /> : <Menu width={18} height={18} />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileNav && (
          <nav className="border-t border-white/[0.06] px-4 py-2 md:hidden">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={() => setMobileNav(false)}
                className={({ isActive }) =>
                  cx(
                    "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium",
                    isActive ? "bg-white/[0.06] text-white" : "text-slate-400"
                  )
                }
              >
                {n.icon}
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main id="main" key={loc.pathname} className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
