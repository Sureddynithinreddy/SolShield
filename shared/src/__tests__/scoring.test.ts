import { describe, it, expect } from "vitest";
import { verdictFromScore, scoreFromRules, sortRulesBySeverity, dedupeRules } from "../scoring";
import type { FiredRule } from "../types";

const rule = (id: string, severity: FiredRule["severity"], hardBlock = false): FiredRule => ({
  id,
  title: id,
  severity,
  explanation: "",
  recommendedAction: "",
  hardBlock,
});

describe("scoring", () => {
  it("maps scores to verdicts per the PRD bands", () => {
    expect(verdictFromScore(0)).toBe("safe");
    expect(verdictFromScore(29)).toBe("safe");
    expect(verdictFromScore(30)).toBe("caution");
    expect(verdictFromScore(59)).toBe("caution");
    expect(verdictFromScore(60)).toBe("dangerous");
    expect(verdictFromScore(100)).toBe("dangerous");
  });

  it("forces dangerous + >=90 on a hard-block rule", () => {
    const { score, verdict } = scoreFromRules([rule("R-001", "critical", true)]);
    expect(verdict).toBe("dangerous");
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it("weights severity (a single high is caution-range)", () => {
    const { score, verdict } = scoreFromRules([rule("x", "high")]);
    expect(score).toBe(28); // 14 * 2
    expect(verdict).toBe("safe");
  });

  it("sorts rules critical-first and dedupes by id", () => {
    const sorted = sortRulesBySeverity([rule("a", "low"), rule("b", "critical"), rule("c", "medium")]);
    expect(sorted.map((r) => r.id)).toEqual(["b", "c", "a"]);
    expect(dedupeRules([rule("a", "low"), rule("a", "high")])).toHaveLength(1);
  });
});
