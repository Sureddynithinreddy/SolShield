import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  getSettings,
  saveSettings,
  backendConfigured,
  type UserSettings,
  type UserListEntry,
  type UserRuleEntry,
} from "./api";

const EMPTY: UserSettings = { strictness: "balanced", lists: [], rules: [] };

export type SaveState = "idle" | "saving" | "saved" | "error" | "local";

export interface SettingsController {
  settings: UserSettings;
  loading: boolean;
  /** true when changes persist to the backend (wallet connected + backend up) */
  persists: boolean;
  saveState: SaveState;
  setStrictness: (s: UserSettings["strictness"]) => void;
  setLists: (lists: UserListEntry[]) => void;
  setRules: (rules: UserRuleEntry[]) => void;
}

/**
 * Loads the connected wallet's settings from the backend and persists changes
 * (debounced). Falls back to in-memory only when there's no backend or no
 * connected wallet — never fabricated data, just empty defaults.
 */
export function useSettings(): SettingsController {
  const { publicKey, connected } = useWallet();
  const owner = connected && publicKey ? publicKey.toBase58() : null;
  const hasBackend = backendConfigured();
  const persists = !!owner && hasBackend;

  const [settings, setSettings] = useState<UserSettings>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>(persists ? "idle" : "local");
  const saveTimer = useRef<number | null>(null);
  const dirty = useRef(false);

  // Load when the owner changes.
  useEffect(() => {
    if (!persists || !owner) {
      setSettings(EMPTY);
      setSaveState(hasBackend ? "idle" : "local");
      return;
    }
    let cancelled = false;
    setLoading(true);
    getSettings(owner)
      .then((res) => {
        if (cancelled) return;
        setSettings(res?.settings ?? EMPTY);
        setSaveState("idle");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [owner, persists, hasBackend]);

  // Debounced persist on change.
  const persist = useCallback(
    (next: UserSettings) => {
      if (!persists || !owner) {
        setSaveState("local");
        return;
      }
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      setSaveState("saving");
      saveTimer.current = window.setTimeout(async () => {
        const res = await saveSettings(owner, next);
        setSaveState(res.ok ? "saved" : "error");
        if (res.ok) window.setTimeout(() => setSaveState("idle"), 1500);
      }, 600);
    },
    [owner, persists]
  );

  const mutate = useCallback(
    (patch: Partial<UserSettings>) => {
      dirty.current = true;
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  return {
    settings,
    loading,
    persists,
    saveState,
    setStrictness: (s) => mutate({ strictness: s }),
    setLists: (lists) => mutate({ lists }),
    setRules: (rules) => mutate({ rules }),
  };
}
