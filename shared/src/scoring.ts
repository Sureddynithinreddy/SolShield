import type { FiredRule, Severity, Verdict } from "./types";

/** Severity multipliers from the PRD scoring model (section 5.8). */
export const severityMultiplier: Record<Severity, number> = {
  info: 0,
  low: 0.5,
  medium: 1,
  high: 2,
  critical: 4,
};

export const severitySortOrder: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export function verdictFromScore(score: number): Verdict {
  if (score <= 29) return "safe";
  if (score <= 59) return "caution";
  return "dangerous";
}

/**
 * Score = min(100, Σ(weight × severity_multiplier)) with hard-block override.
 * Mirrors the PRD's scoring formula.
 */
export function scoreFromRules(rules: FiredRule[], weight = 14): { score: number; verdict: Verdict } {
  const raw = rules.reduce((s, r) => s + weight * severityMultiplier[r.severity], 0);
  const hardBlock = rules.some((r) => r.hardBlock);
  let score = Math.min(100, Math.round(raw));
  if (hardBlock) score = Math.max(score, 90);
  const verdict: Verdict = hardBlock ? "dangerous" : verdictFromScore(score);
  return { score, verdict };
}

export function sortRulesBySeverity(rules: FiredRule[]): FiredRule[] {
  return [...rules].sort((a, b) => severitySortOrder[a.severity] - severitySortOrder[b.severity]);
}

export function dedupeRules(rules: FiredRule[]): FiredRule[] {
  const byId = new Map<string, FiredRule>();
  for (const r of rules) if (!byId.has(r.id)) byId.set(r.id, r);
  return [...byId.values()];
}
