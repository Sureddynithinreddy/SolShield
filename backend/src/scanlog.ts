import type { TxScenario } from "@shared/types";
import { db, type ScanDoc } from "./db.js";
import { sha256 } from "./hash.js";

/**
 * Persists a completed scan to Mongo (privacy-preserving). No-op if the DB
 * is not connected, so the scan endpoint works with or without persistence.
 */
export async function recordScan(
  scenario: TxScenario,
  opts: { origin?: string; signer?: string; cacheHit?: boolean } = {}
): Promise<void> {
  if (!db.connected) return;

  const outflowUsd = scenario.balanceChanges
    .filter((b) => (b.usd ?? 0) < 0)
    .reduce((sum, b) => sum + Math.abs(b.usd ?? 0), 0);

  const doc: ScanDoc = {
    createdAt: new Date(),
    origin: opts.origin ?? scenario.dappDomain ?? null,
    signerHash: sha256(opts.signer),
    verdict: scenario.verdict,
    score: scenario.score,
    ruleIds: scenario.firedRules.map((r) => r.id),
    hardBlock: scenario.firedRules.some((r) => r.hardBlock),
    outflowUsd,
    scanMs: scenario.scanMs,
    source: scenario.scanSource ?? "backend",
    cacheHit: !!opts.cacheHit,
  };

  try {
    await db.scans.insertOne(doc);
  } catch {
    /* best-effort; never fail a scan because logging failed */
  }
}
