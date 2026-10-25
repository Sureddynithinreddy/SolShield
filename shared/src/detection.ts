import type { BalanceChange, DomainMeta, FiredRule, WalletScanTarget } from "./types";
import { shortAddr, similarity } from "./format";

/* ================================================================== *
 * Deeper detection helpers (PRD section C work).
 *
 * All pure: they take plain, RPC-shaped inputs and return structured
 * results. No web3.js import so the frontend and backend share them.
 * ================================================================== */

/* ---------------------- Balance-change diffing ---------------------- */

export interface TokenBalanceSnapshot {
  /** owner account index in the message (from simulate meta) */
  accountIndex: number;
  mint: string;
  owner?: string;
  uiAmount: number;
  decimals: number;
}

export interface BalanceDiffInput {
  owner: string;
  preSol: number; // lamports
  postSol: number; // lamports
  preTokens: TokenBalanceSnapshot[];
  postTokens: TokenBalanceSnapshot[];
  /** optional symbol lookup by mint */
  symbols?: Record<string, { symbol: string; name: string; usdPerUnit?: number }>;
  solUsd?: number;
}

const LAMPORTS = 1_000_000_000;

/**
 * Computes net SOL + per-token balance changes for the owner from
 * simulateTransaction pre/post balances. Fills the gap the earlier demo
 * left empty.
 */
export function computeBalanceChanges(input: BalanceDiffInput): BalanceChange[] {
  const out: BalanceChange[] = [];

  // SOL delta (ignore dust under 1 lamport).
  const solDelta = (input.postSol - input.preSol) / LAMPORTS;
  if (Math.abs(solDelta) > 1e-9) {
    out.push({
      symbol: "SOL",
      name: "Solana",
      amount: solDelta,
      usd: input.solUsd ? solDelta * input.solUsd : undefined,
    });
  }

  // Token deltas — match pre/post by mint for this owner.
  const mine = (t: TokenBalanceSnapshot) => !t.owner || t.owner === input.owner;
  const preByMint = new Map<string, number>();
  for (const t of input.preTokens.filter(mine)) {
    preByMint.set(t.mint, (preByMint.get(t.mint) ?? 0) + t.uiAmount);
  }
  const postByMint = new Map<string, number>();
  for (const t of input.postTokens.filter(mine)) {
    postByMint.set(t.mint, (postByMint.get(t.mint) ?? 0) + t.uiAmount);
  }

  const mints = new Set([...preByMint.keys(), ...postByMint.keys()]);
  for (const mint of mints) {
    const delta = (postByMint.get(mint) ?? 0) - (preByMint.get(mint) ?? 0);
    if (Math.abs(delta) < 1e-12) continue;
    const meta = input.symbols?.[mint];
    out.push({
      symbol: meta?.symbol ?? `${mint.slice(0, 4)}…`,
      name: meta?.name ?? `Mint ${shortAddr(mint, 4, 4)}`,
      amount: delta,
      usd: meta?.usdPerUnit ? delta * meta.usdPerUnit : undefined,
      mono: mint,
    });
  }

  return out;
}

/* ---------------------- Authority / ownership changes ---------------------- */

export interface TokenAccountState {
  /** the token account address */
  account: string;
  /** mint it holds */
  mint: string;
  /** current owner of the token account */
  owner: string;
  /** delegate, if any */
  delegate?: string | null;
  /** close authority, if any */
  closeAuthority?: string | null;
}

export interface AuthorityChange {
  kind: "owner" | "delegate" | "close-authority" | "account-reassigned";
  account: string;
  mint?: string;
  before?: string | null;
  after?: string | null;
}

/**
 * Compares pre/post token-account states for the user and flags dangerous
 * authority or ownership changes (PRD SIM-3, rule R-002 wallet-authority
 * takeover). A changed owner on your own token account is the clearest
 * drainer signature.
 */
export function detectAuthorityChanges(
  userAddress: string,
  pre: TokenAccountState[],
  post: TokenAccountState[]
): AuthorityChange[] {
  const changes: AuthorityChange[] = [];
  const preByAccount = new Map(pre.map((s) => [s.account, s]));

  for (const p of post) {
    const before = preByAccount.get(p.account);
    if (!before) continue;

    // Owner changed on an account that was ours → takeover.
    if (before.owner === userAddress && p.owner !== userAddress) {
      changes.push({ kind: "owner", account: p.account, mint: p.mint, before: before.owner, after: p.owner });
    }
    // A new delegate was granted.
    if ((before.delegate ?? null) !== (p.delegate ?? null) && p.delegate) {
      changes.push({ kind: "delegate", account: p.account, mint: p.mint, before: before.delegate ?? null, after: p.delegate });
    }
    // Close authority newly set to someone else.
    if ((before.closeAuthority ?? null) !== (p.closeAuthority ?? null) && p.closeAuthority && p.closeAuthority !== userAddress) {
      changes.push({ kind: "close-authority", account: p.account, mint: p.mint, before: before.closeAuthority ?? null, after: p.closeAuthority });
    }
  }
  return changes;
}

/** Turns authority changes into fired rules (R-002 takeover is critical/hard-block). */
export function authorityChangeRules(changes: AuthorityChange[]): FiredRule[] {
  const rules: FiredRule[] = [];
  const ownerChange = changes.find((c) => c.kind === "owner");
  if (ownerChange) {
    rules.push({
      id: "R-002",
      title: "Wallet authority takeover",
      severity: "critical",
      hardBlock: true,
      explanation: `Simulation shows the owner of your token account ${shortAddr(ownerChange.account, 4, 4)} is reassigned to ${shortAddr(ownerChange.after ?? "", 4, 4)}. This hands control of your tokens to someone else.`,
      recommendedAction: "Hard block. Never sign a transaction that changes who owns your accounts.",
    });
  }
  const closeAuth = changes.find((c) => c.kind === "close-authority");
  if (closeAuth) {
    rules.push({
      id: "R-SIM-3",
      title: "Close authority granted",
      severity: "high",
      explanation: `A close authority on your token account ${shortAddr(closeAuth.account, 4, 4)} is being set to another address, letting them close it and reclaim the rent.`,
      recommendedAction: "Review carefully — this is unusual for routine transactions.",
    });
  }
  return rules;
}

/* ---------------------- Instruction decoding ---------------------- */

export interface RawInstruction {
  programId: string;
  /** first data byte — enough for System/SPL Token tag dispatch */
  dataFirstByte?: number;
  /** hex of the first 8 data bytes — the Anchor discriminator for IDL programs */
  discriminator?: string;
  accountCount: number;
}

export interface DecodedInstruction {
  name: string;
  summary: string;
  /** flag if this instruction grants authority / delegate / reassigns ownership */
  flagged?: boolean;
}

const SYSTEM = "11111111111111111111111111111111";
const SPL_TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const ATA = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const COMPUTE_BUDGET = "ComputeBudget111111111111111111111111111111";
const MEMO = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

// System program instruction discriminators (u32 LE, but first byte is enough
// to disambiguate the common ones).
const SYSTEM_IX: Record<number, { name: string; flagged?: boolean }> = {
  0: { name: "CreateAccount" },
  1: { name: "Assign", flagged: true },
  2: { name: "Transfer" },
  8: { name: "Allocate" },
};

// SPL Token instruction tags (single byte).
const TOKEN_IX: Record<number, { name: string; flagged?: boolean }> = {
  3: { name: "Transfer" },
  4: { name: "Approve", flagged: true },
  5: { name: "Revoke" },
  6: { name: "SetAuthority", flagged: true },
  7: { name: "MintTo" },
  8: { name: "Burn" },
  9: { name: "CloseAccount", flagged: true },
  10: { name: "FreezeAccount", flagged: true },
  12: { name: "TransferChecked" },
  13: { name: "ApproveChecked", flagged: true },
};

/**
 * Known DeFi / NFT programs. Each has a friendly name and (optionally) an
 * Anchor-discriminator → instruction-name map. Anchor discriminators are the
 * first 8 bytes of sha256("global:<ix_name>"); we match on their hex.
 */
interface KnownProgram {
  name: string;
  /** hex discriminator (16 chars) → human instruction name */
  discriminators?: Record<string, string>;
  /** default verb when the discriminator is unknown */
  defaultVerb?: string;
}

export const KNOWN_PROGRAMS: Record<string, KnownProgram> = {
  JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4: {
    name: "Jupiter",
    defaultVerb: "swap",
    discriminators: {
      // sha256("global:route")[:8], sha256("global:shared_accounts_route")[:8]
      e517cb977ae3ad2a: "route",
      c1209b3341d69c81: "shared_accounts_route",
      "0d8a8c2f9d2b6e5f": "exact_out_route",
    },
  },
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": {
    name: "Raydium AMM v4",
    defaultVerb: "swap",
    discriminators: { "09": "swap" },
  },
  whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc: {
    name: "Orca Whirlpools",
    defaultVerb: "swap",
    discriminators: {
      f8c69e91e17587c8: "swap",
      "2e9cf3760dcdfbb2": "two_hop_swap",
    },
  },
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P": {
    name: "pump.fun",
    defaultVerb: "trade",
    discriminators: { "66063d1201daebea": "buy", "33e685a4017f83ad": "sell" },
  },
  TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN: { name: "Tensor", defaultVerb: "trade" },
  M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K: { name: "Magic Eden v2", defaultVerb: "trade" },
};

export function decodeInstruction(ix: RawInstruction): DecodedInstruction {
  const b = ix.dataFirstByte;
  switch (ix.programId) {
    case SYSTEM: {
      const m = b !== undefined ? SYSTEM_IX[b] : undefined;
      return {
        name: m?.name ?? "System instruction",
        summary: m?.name === "Transfer" ? "Transfer SOL" : m?.name === "Assign" ? "Reassign account ownership" : `System program · touches ${ix.accountCount} accounts`,
        flagged: m?.flagged,
      };
    }
    case SPL_TOKEN:
    case TOKEN_2022: {
      const m = b !== undefined ? TOKEN_IX[b] : undefined;
      const label = ix.programId === TOKEN_2022 ? "Token-2022" : "SPL Token";
      return {
        name: m?.name ?? `${label} instruction`,
        summary:
          m?.name === "Approve" || m?.name === "ApproveChecked"
            ? "Grant a spending delegate"
            : m?.name === "SetAuthority"
            ? "Change a token authority"
            : m?.name === "CloseAccount"
            ? "Close a token account"
            : m?.name === "FreezeAccount"
            ? "Freeze a token account"
            : `${label} · touches ${ix.accountCount} accounts`,
        flagged: m?.flagged,
      };
    }
    case ATA:
      return { name: "CreateAssociatedTokenAccount", summary: "Create an associated token account" };
    case COMPUTE_BUDGET:
      return { name: "ComputeBudget", summary: "Set compute unit limit / price" };
    case MEMO:
      return { name: "Memo", summary: "Attach a memo note" };
    default: {
      const known = KNOWN_PROGRAMS[ix.programId];
      if (known) {
        const disc = ix.discriminator?.toLowerCase();
        const ixName = disc ? known.discriminators?.[disc] : undefined;
        const verb = ixName ?? known.defaultVerb ?? "interact";
        return {
          name: `${known.name}: ${verb}`,
          summary: `${known.name} ${verb} · touches ${ix.accountCount} accounts`,
        };
      }
      return {
        name: "Unrecognized instruction",
        summary: `Custom program · touches ${ix.accountCount} accounts`,
      };
    }
  }
}

/* ---------------------- Lookalike domain check ---------------------- */

/** Known legitimate dApp domains used for typosquatting detection. */
export const KNOWN_DAPP_DOMAINS = [
  "jup.ag",
  "raydium.io",
  "orca.so",
  "tensor.trade",
  "magiceden.io",
  "phantom.app",
  "solflare.com",
  "backpack.app",
  "marinade.finance",
  "kamino.finance",
  "drift.trade",
  "solana.com",
  "pump.fun",
];

export interface DomainCheck {
  lookalikeOf?: string;
  similarity: number;
}

/** Returns the closest known brand if the domain is a likely typosquat. */
export function checkLookalikeDomain(domain: string, known = KNOWN_DAPP_DOMAINS): DomainCheck {
  const host = domain.toLowerCase().replace(/^www\./, "");
  if (known.includes(host)) return { similarity: 1 };

  // Compare the registrable label (strip TLD) against known labels.
  const label = host.split(".").slice(-2, -1)[0] ?? host;
  let best = { lookalikeOf: undefined as string | undefined, similarity: 0 };
  for (const k of known) {
    const kLabel = k.split(".").slice(-2, -1)[0] ?? k;
    const sim = similarity(label, kLabel);
    if (sim > best.similarity) best = { lookalikeOf: k, similarity: sim };
  }
  // 0.72..0.999 is the suspicious band (very close but not identical).
  if (best.similarity >= 0.72 && best.similarity < 1) {
    return { lookalikeOf: best.lookalikeOf, similarity: best.similarity };
  }
  return { similarity: best.similarity };
}

/* ---------------------- Address poisoning ---------------------- */

/**
 * Flags a destination that mimics the first+last characters of a recent
 * counterparty but is not identical (R-008).
 */
export function checkAddressPoisoning(
  destination: string,
  recentCounterparties: string[],
  edge = 4
): string | undefined {
  const dHead = destination.slice(0, edge);
  const dTail = destination.slice(-edge);
  for (const c of recentCounterparties) {
    if (c === destination) continue;
    if (c.slice(0, edge) === dHead && c.slice(-edge) === dTail) return c;
  }
  return undefined;
}

/* ---------------------- Standing delegate approvals (portfolio) ---------------------- */

export interface DelegateApprovalAccount {
  /** token account address */
  account: string;
  mint: string;
  /** friendly token symbol if known */
  symbol?: string;
  /** the delegate that can move your tokens */
  delegate: string;
  /** amount the delegate is approved for (ui units) */
  delegatedAmount: number;
  /** the account's total balance (ui units) */
  balance: number;
  /** delegate is on the allow/known list */
  knownDelegate?: boolean;
}

export type ApprovalRisk = "high" | "medium" | "low";

export interface ApprovalAssessment extends DelegateApprovalAccount {
  risk: ApprovalRisk;
  reason: string;
  /** approved for the entire balance (or effectively unlimited) */
  unlimited: boolean;
}

/**
 * Assesses a standing token delegate approval. The worst case is an unknown
 * delegate approved for your full balance — the classic lingering-approval
 * drainer vector (portfolio-wide approval monitoring, PRD Pro tier).
 */
export function assessApproval(a: DelegateApprovalAccount): ApprovalAssessment {
  const unlimited = a.delegatedAmount >= a.balance && a.balance > 0;
  let risk: ApprovalRisk;
  let reason: string;

  if (a.knownDelegate) {
    risk = unlimited ? "medium" : "low";
    reason = unlimited
      ? "Full-balance approval to a known protocol. Revoke if you no longer use it."
      : "Limited approval to a known protocol.";
  } else if (unlimited) {
    risk = "high";
    reason = "An unknown address can move your entire balance of this token. Revoke now.";
  } else if (a.delegatedAmount > 0) {
    risk = "medium";
    reason = "An unknown address holds a spending approval on this token.";
  } else {
    risk = "low";
    reason = "No active approval.";
  }

  return { ...a, risk, reason, unlimited };
}

export function assessApprovals(accounts: DelegateApprovalAccount[]): ApprovalAssessment[] {
  const order: Record<ApprovalRisk, number> = { high: 0, medium: 1, low: 2 };
  return accounts
    .map(assessApproval)
    .sort((x, y) => order[x.risk] - order[y.risk]);
}

/* ---------------------- signMessage / SIWS ---------------------- */

export interface MessageAnalysis {
  isSiws: boolean;
  suspicious: boolean;
  reason?: string;
  domain?: string;
}

const SUSPICIOUS_MESSAGE_PATTERNS = [
  /set\s*authority/i,
  /approve/i,
  /seed\s*phrase/i,
  /private\s*key/i,
  /drain/i,
  /transfer\s+all/i,
];

/**
 * Parses a signMessage payload. Detects Sign-In With Solana (SIWS) format and
 * flags raw messages containing authority-granting or credential-phishing text.
 */
export function analyzeSignMessage(message: string): MessageAnalysis {
  const text = message.trim();
  // SIWS messages start with "<domain> wants you to sign in with your Solana account"
  const siwsMatch = text.match(/^(\S+) wants you to sign in with your Solana account/i);
  if (siwsMatch) {
    return { isSiws: true, suspicious: false, domain: siwsMatch[1] };
  }

  for (const re of SUSPICIOUS_MESSAGE_PATTERNS) {
    if (re.test(text)) {
      return {
        isSiws: false,
        suspicious: true,
        reason: `Message contains sensitive phrasing ("${(text.match(re) ?? [""])[0]}"). Signing it may authorize an action.`,
      };
    }
  }
  return { isSiws: false, suspicious: false };
}

/* ---------------------- Durable nonce ---------------------- */

/**
 * A transaction uses a durable nonce when its first instruction is
 * System AdvanceNonceAccount (tag 4). These can be signed now and submitted
 * much later, which is riskier (R-009).
 */
export function usesDurableNonce(firstIx?: RawInstruction): boolean {
  return !!firstIx && firstIx.programId === SYSTEM && firstIx.dataFirstByte === 4;
}

/* ---------------------- Builders for the Wallet/Domain scanners ---------------------- */

/** Builds a DomainMeta from raw signals + a lookalike check. */
export function buildDomainMeta(opts: {
  domain: string;
  ageDays?: number;
  ssl?: boolean;
  onPhishingList?: boolean;
  reputation?: number;
}): DomainMeta {
  const look = checkLookalikeDomain(opts.domain);
  return {
    domain: opts.domain,
    ageDays: opts.ageDays ?? 9999,
    ssl: opts.ssl ?? true,
    onPhishingList: opts.onPhishingList ?? false,
    lookalikeOf: look.lookalikeOf,
    reputation: opts.reputation ?? (look.lookalikeOf ? 10 : opts.onPhishingList ? 0 : 80),
  };
}

/** Applies a poisoning check to a target against recent counterparties. */
export function withPoisoningCheck(
  target: WalletScanTarget,
  recentCounterparties: string[]
): WalletScanTarget {
  const match = checkAddressPoisoning(target.address, recentCounterparties);
  return match ? { ...target, poisoningLookalikeOf: match } : target;
}
