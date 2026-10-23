import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  getRecentHistory,
  getWalletSnapshot,
  type TxHistoryItem,
  type WalletSnapshot,
} from "./solana";

type Status = "idle" | "loading" | "ready" | "error";

export interface LiveWalletData {
  status: Status;
  connected: boolean;
  address: string | null;
  snapshot: WalletSnapshot | null;
  history: TxHistoryItem[];
  error: string | null;
  refresh: () => void;
}

/**
 * Fetches real on-chain data for the connected wallet: SOL + token balances
 * and recent transaction history. Returns idle when no wallet is connected.
 */
export function useWalletData(): LiveWalletData {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [status, setStatus] = useState<Status>("idle");
  const [snapshot, setSnapshot] = useState<WalletSnapshot | null>(null);
  const [history, setHistory] = useState<TxHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const address = publicKey?.toBase58() ?? null;

  useEffect(() => {
    if (!connected || !publicKey) {
      setStatus("idle");
      setSnapshot(null);
      setHistory([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setError(null);

    (async () => {
      try {
        const [snap, hist] = await Promise.all([
          getWalletSnapshot(connection, publicKey),
          getRecentHistory(connection, publicKey),
        ]);
        if (cancelled) return;
        setSnapshot(snap);
        setHistory(hist);
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load wallet data");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connection, publicKey, connected, tick]);

  return {
    status,
    connected,
    address,
    snapshot,
    history,
    error,
    refresh: () => setTick((t) => t + 1),
  };
}
