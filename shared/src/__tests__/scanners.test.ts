import { describe, it, expect } from "vitest";
import {
  evaluateProgramScanner,
  evaluateWalletScanner,
  evaluateTokenScanner,
} from "../scanners";
import type { ProgramMeta, TokenMeta, WalletScanTarget, DomainMeta } from "../types";

describe("Program Scanner", () => {
  it("fires R-004 (high) for a brand-new fund-receiving program", () => {
    const programs: ProgramMeta[] = [
      {
        programId: "New111",
        name: "NewProg",
        core: false,
        verified: false,
        deployedDaysAgo: 2,
        upgradeAuthority: "single-unknown",
        receivesFunds: true,
      },
    ];
    const { firedRules } = evaluateProgramScanner(programs);
    const r004 = firedRules.find((r) => r.id === "R-004");
    expect(r004?.severity).toBe("high");
    expect(firedRules.some((r) => r.id === "R-PRG-3")).toBe(true);
  });

  it("fires R-004 (medium) for a young unverified program (5 days)", () => {
    const { firedRules } = evaluateProgramScanner([
      {
        programId: "Y",
        name: "Young",
        core: false,
        verified: false,
        deployedDaysAgo: 5,
        upgradeAuthority: "single-unknown",
        receivesFunds: true,
      },
    ]);
    expect(firedRules.find((r) => r.id === "R-004")?.severity).toBe("medium");
  });

  it("stays quiet for verified core programs", () => {
    const { firedRules } = evaluateProgramScanner([
      {
        programId: "11111111111111111111111111111111",
        name: "System",
        core: true,
        verified: true,
        deployedDaysAgo: null,
        upgradeAuthority: "immutable",
        receivesFunds: false,
      },
    ]);
    expect(firedRules).toHaveLength(0);
  });
});

describe("Wallet Scanner", () => {
  const cleanDomain: DomainMeta = {
    domain: "jup.ag",
    ageDays: 1000,
    ssl: true,
    onPhishingList: false,
    reputation: 98,
  };

  it("hard-blocks a confirmed drainer (R-001)", () => {
    const targets: WalletScanTarget[] = [
      { address: "drainer1", role: "Recipient", drainer: true, drainerThefts: 240 },
    ];
    const { firedRules } = evaluateWalletScanner(targets, cleanDomain);
    const r001 = firedRules.find((r) => r.id === "R-001");
    expect(r001?.hardBlock).toBe(true);
    expect(r001?.severity).toBe("critical");
  });

  it("fires R-007 for a phishing domain", () => {
    const { firedRules } = evaluateWalletScanner([], { ...cleanDomain, onPhishingList: true });
    expect(firedRules.some((r) => r.id === "R-007")).toBe(true);
  });

  it("fires R-008 for address poisoning", () => {
    const { firedRules } = evaluateWalletScanner(
      [{ address: "x", role: "Recipient", poisoningLookalikeOf: "y" }],
      cleanDomain
    );
    expect(firedRules.some((r) => r.id === "R-008")).toBe(true);
  });
});

describe("Token Scanner", () => {
  it("fires R-003 for an unlimited delegate to an unknown address", () => {
    const tokens: TokenMeta[] = [
      {
        mint: "M",
        symbol: "USDC",
        name: "USD Coin",
        mintAuthorityActive: true,
        freezeAuthorityActive: false,
        verifiedListed: true,
        delegateApproval: { amount: "unlimited", to: "bad", knownDelegate: false, worstCaseUsd: 2450 },
      },
    ];
    const { firedRules } = evaluateTokenScanner(tokens);
    expect(firedRules.some((r) => r.id === "R-003")).toBe(true);
  });

  it("fires R-005 for an active freeze authority", () => {
    const { firedRules } = evaluateTokenScanner([
      { mint: "M", symbol: "T", name: "T", mintAuthorityActive: true, freezeAuthorityActive: true, isNft: true },
    ]);
    expect(firedRules.some((r) => r.id === "R-005")).toBe(true);
  });

  it("fires R-006 for a Token-2022 permanent delegate", () => {
    const { firedRules } = evaluateTokenScanner([
      {
        mint: "M",
        symbol: "T",
        name: "T",
        mintAuthorityActive: false,
        freezeAuthorityActive: false,
        token2022Extensions: ["permanent-delegate"],
      },
    ]);
    expect(firedRules.some((r) => r.id === "R-006")).toBe(true);
  });
});
