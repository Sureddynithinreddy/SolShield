import type { Connection } from "@solana/web3.js";
import type { TxScenario } from "./types";
import { analyzeTransaction } from "./analyzeTx";

/* ------------------------------------------------------------------ *
 * Scan client — backend-first with local fail-safe fallback.
 *
 * Mirrors the PRD's degraded-mode design: if the backend is configured
 * and reachable, the scan runs there (with full threat intel). Otherwise
 * it falls back to the in-browser analyzer so the user is never left
 * unprotected.
 * ------------------------------------------------------------------ */

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export interface ScanOutcome {
  ok: boolean;
  error?: string;
  scenario?: TxScenario;
  /** which engine produced the result */
  source: "backend" | "local";
  /** set when the backend was tried but failed and we fell back */
  fellBack?: boolean;
}

export function backendConfigured(): boolean {
  return API_URL.length > 0;
}

async function backendHealthy(signal?: AbortSignal): Promise<boolean> {
  if (!API_URL) return false;
  try {
    const res = await fetch(`${API_URL}/api/health`, { signal });
    if (!res.ok) return false;
    const j = await res.json();
    return j?.status === "ok" || j?.status === "degraded";
  } catch {
    return false;
  }
}

async function backendScan(
  base64: string,
  origin?: string,
  signer?: string
): Promise<TxScenario | null> {
  const res = await fetch(`${API_URL}/api/scan`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transaction: base64, origin, signer }),
  });
  if (!res.ok) return null;
  const j = await res.json();
  if (!j?.ok || !j?.scenario) return null;
  return j.scenario as TxScenario;
}

/**
 * Scan a transaction: try the backend first (if configured + healthy),
 * otherwise run the local engine. Falls back to local on any backend error.
 */
export async function scanTransaction(
  conn: Connection,
  base64: string,
  opts: { origin?: string; signer?: string } = {}
): Promise<ScanOutcome> {
  if (backendConfigured()) {
    const healthy = await backendHealthy();
    if (healthy) {
      try {
        const scenario = await backendScan(base64, opts.origin, opts.signer);
        if (scenario) return { ok: true, scenario, source: "backend" };
      } catch {
        /* fall through to local */
      }
    }
    // Backend configured but unavailable/failed → fail-safe local scan.
    const local = await analyzeTransaction(conn, base64, opts.signer);
    return {
      ok: local.ok,
      error: local.error,
      scenario: local.scenario,
      source: "local",
      fellBack: true,
    };
  }

  // No backend configured → local engine only.
  const local = await analyzeTransaction(conn, base64, opts.signer);
  return { ok: local.ok, error: local.error, scenario: local.scenario, source: "local" };
}

export interface BackendStats {
  available: boolean;
  scansTotal: number;
  scansToday: number;
  blocked: number;
  valueProtectedUsd: number;
  threatBreakdown: { label: string; count: number; color: string }[];
  trend: { d: string; safe: number; caution: number; dangerous: number }[];
}

/** Fleet-wide analytics from the backend (null if no backend / unavailable). */
export async function fetchStats(): Promise<BackendStats | null> {
  if (!API_URL) return null;
  try {
    const res = await fetch(`${API_URL}/api/stats`);
    if (!res.ok) return null;
    const j = await res.json();
    if (!j?.ok || !j?.available) return null;
    return j as BackendStats;
  } catch {
    return null;
  }
}

/** Domain reputation via the backend (returns null if unavailable). */
export async function fetchDomainReputation(domain: string): Promise<{
  verdict: "trusted" | "unknown" | "dangerous";
  reputation: number;
  onPhishingList: boolean;
  lookalikeOf?: string;
} | null> {
  if (!API_URL) return null;
  try {
    const res = await fetch(`${API_URL}/api/reputation?domain=${encodeURIComponent(domain)}`);
    if (!res.ok) return null;
    const j = await res.json();
    if (!j?.ok) return null;
    return {
      verdict: j.verdict,
      reputation: j.reputation,
      onPhishingList: j.onPhishingList,
      lookalikeOf: j.lookalikeOf,
    };
  } catch {
    return null;
  }
}
