import { describe, it, expect } from "vitest";
import {
  checkLookalikeDomain,
  checkAddressPoisoning,
  analyzeSignMessage,
  usesDurableNonce,
  computeBalanceChanges,
  decodeInstruction,
  detectAuthorityChanges,
  authorityChangeRules,
} from "../detection";

describe("lookalike domains", () => {
  it("flags a typosquat of a known brand", () => {
    expect(checkLookalikeDomain("so1ana.com").lookalikeOf).toBe("solana.com");
    expect(checkLookalikeDomain("jupp.ag").lookalikeOf).toBe("jup.ag");
  });
  it("does not flag the exact brand", () => {
    expect(checkLookalikeDomain("jup.ag").similarity).toBe(1);
    expect(checkLookalikeDomain("jup.ag").lookalikeOf).toBeUndefined();
  });
});

describe("address poisoning", () => {
  it("matches head+tail of a recent counterparty", () => {
    expect(checkAddressPoisoning("ABCDzzzzWXYZ", ["ABCDyyyyWXYZ"])).toBe("ABCDyyyyWXYZ");
  });
  it("returns undefined when nothing matches", () => {
    expect(checkAddressPoisoning("ABCDxxxxWXYZ", ["QQQQyyyyZZZZ"])).toBeUndefined();
  });
});

describe("signMessage / SIWS", () => {
  it("detects SIWS format", () => {
    const r = analyzeSignMessage("example.com wants you to sign in with your Solana account");
    expect(r.isSiws).toBe(true);
    expect(r.domain).toBe("example.com");
  });
  it("flags suspicious authority-granting text", () => {
    expect(analyzeSignMessage("please set authority to me").suspicious).toBe(true);
  });
  it("treats a plain greeting as safe", () => {
    const r = analyzeSignMessage("gm");
    expect(r.isSiws).toBe(false);
    expect(r.suspicious).toBe(false);
  });
});

describe("durable nonce", () => {
  it("detects AdvanceNonceAccount as the first instruction", () => {
    expect(
      usesDurableNonce({ programId: "11111111111111111111111111111111", dataFirstByte: 4, accountCount: 3 })
    ).toBe(true);
  });
  it("is false for a normal transfer", () => {
    expect(
      usesDurableNonce({ programId: "11111111111111111111111111111111", dataFirstByte: 2, accountCount: 2 })
    ).toBe(false);
  });
});

describe("balance diffing", () => {
  it("computes a SOL delta", () => {
    const changes = computeBalanceChanges({
      owner: "me",
      preSol: 2_000_000_000,
      postSol: 1_500_000_000,
      preTokens: [],
      postTokens: [],
    });
    expect(changes).toHaveLength(1);
    expect(changes[0].amount).toBeCloseTo(-0.5);
  });

  it("computes a per-token delta", () => {
    const changes = computeBalanceChanges({
      owner: "me",
      preSol: 1_000_000,
      postSol: 1_000_000,
      preTokens: [{ accountIndex: 0, mint: "USDC", owner: "me", uiAmount: 100, decimals: 6 }],
      postTokens: [{ accountIndex: 0, mint: "USDC", owner: "me", uiAmount: 40, decimals: 6 }],
    });
    const usdc = changes.find((c) => c.mono === "USDC");
    expect(usdc?.amount).toBeCloseTo(-60);
  });
});

describe("instruction decoding", () => {
  it("decodes a Jupiter route by discriminator", () => {
    const d = decodeInstruction({
      programId: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
      discriminator: "e517cb977ae3ad2a",
      accountCount: 12,
    });
    expect(d.name).toBe("Jupiter: route");
  });
  it("falls back to the default verb for an unknown discriminator", () => {
    const d = decodeInstruction({
      programId: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
      discriminator: "ffffffffffffffff",
      accountCount: 12,
    });
    expect(d.name).toBe("Jupiter: swap");
  });
  it("flags SPL Token Approve", () => {
    const d = decodeInstruction({
      programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      dataFirstByte: 4,
      accountCount: 3,
    });
    expect(d.name).toBe("Approve");
    expect(d.flagged).toBe(true);
  });
});

describe("authority changes", () => {
  it("fires R-002 hard-block when the token-account owner changes", () => {
    const pre = [{ account: "ata", mint: "M", owner: "me", delegate: null, closeAuthority: null }];
    const post = [{ account: "ata", mint: "M", owner: "attacker", delegate: null, closeAuthority: null }];
    const changes = detectAuthorityChanges("me", pre, post);
    const rules = authorityChangeRules(changes);
    const r002 = rules.find((r) => r.id === "R-002");
    expect(r002?.hardBlock).toBe(true);
  });
});
