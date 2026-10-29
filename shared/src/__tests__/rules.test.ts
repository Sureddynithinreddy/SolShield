import { describe, it, expect } from "vitest";
import { RULE_REGISTRY, RULE_PACK_VERSION } from "../rules";

describe("rule registry", () => {
  it("has a version", () => {
    expect(RULE_PACK_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("has unique rule ids", () => {
    const ids = RULE_REGISTRY.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every rule has required fields and a valid severity/source", () => {
    const sev = new Set(["info", "low", "medium", "high", "critical"]);
    const src = new Set(["program", "wallet", "token", "simulator"]);
    for (const r of RULE_REGISTRY) {
      expect(r.id).toBeTruthy();
      expect(r.title).toBeTruthy();
      expect(r.description).toBeTruthy();
      expect(sev.has(r.severity)).toBe(true);
      expect(src.has(r.source)).toBe(true);
    }
  });

  it("catalogs the core rules the scanners fire", () => {
    const ids = new Set(RULE_REGISTRY.map((r) => r.id));
    for (const id of ["R-001", "R-002", "R-003", "R-004", "R-005", "R-007", "R-008"]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("marks R-001 and R-002 as hard blocks", () => {
    expect(RULE_REGISTRY.find((r) => r.id === "R-001")?.hardBlock).toBe(true);
    expect(RULE_REGISTRY.find((r) => r.id === "R-002")?.hardBlock).toBe(true);
  });
});
