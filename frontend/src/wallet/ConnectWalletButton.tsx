import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { cx, shortAddr } from "@/lib/format";
import { Wallet, ChevronDown, Copy, X, Check } from "@/components/icons";

/**
 * SolShield-themed wallet connect button.
 * Wraps wallet-adapter's modal + useWallet so it matches the app theme
 * instead of the default WalletMultiButton styling.
 */
export function ConnectWalletButton({ compact = false }: { compact?: boolean }) {
  const { publicKey, connected, connecting, disconnect, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const address = publicKey?.toBase58() ?? "";

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const copy = useCallback(() => {
    if (!address) return;
    navigator.clipboard?.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [address]);

  if (!connected) {
    return (
      <button
        onClick={() => setVisible(true)}
        disabled={connecting}
        className={cx("btn-primary", compact && "px-3")}
      >
        <Wallet width={16} height={16} />
        {connecting ? "Connecting…" : compact ? "Connect" : "Connect wallet"}
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-2.5 text-sm transition hover:bg-white/[0.07] focus-ring"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        {wallet?.adapter.icon ? (
          <img src={wallet.adapter.icon} alt="" className="h-6 w-6 rounded-full" />
        ) : (
          <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-cyan to-violet text-ink-950">
            <Wallet width={13} height={13} />
          </span>
        )}
        <span className="mono text-slate-200">{shortAddr(address, 4, 4)}</span>
        <ChevronDown width={14} height={14} className="text-slate-500" />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="glass animate-scale-in absolute right-0 top-11 z-50 w-64 p-3"
        >
          <div className="flex items-center gap-2 px-1">
            {wallet?.adapter.icon && (
              <img src={wallet.adapter.icon} alt="" className="h-8 w-8 rounded-full" />
            )}
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">
                {wallet?.adapter.name ?? "Wallet"}
              </div>
              <div className="mono truncate text-xs text-slate-500">{shortAddr(address, 6, 6)}</div>
            </div>
          </div>

          <div className="mt-3 space-y-1">
            <button
              onClick={copy}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-300 hover:bg-white/[0.06] focus-ring"
            >
              {copied ? (
                <Check width={15} height={15} className="text-safe" />
              ) : (
                <Copy width={15} height={15} />
              )}
              {copied ? "Copied" : "Copy address"}
            </button>
            <button
              onClick={() => {
                setVisible(true);
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-300 hover:bg-white/[0.06] focus-ring"
            >
              <Wallet width={15} height={15} />
              Change wallet
            </button>
            <button
              onClick={() => {
                disconnect();
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-danger hover:bg-danger/10 focus-ring"
            >
              <X width={15} height={15} />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
