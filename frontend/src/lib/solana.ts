import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  type ParsedAccountData,
} from "@solana/web3.js";
import type { ProgramMeta, TokenMeta } from "./types";

/* ------------------------------------------------------------------ *
 * Real Solana RPC data layer.
 *
 * Every function here reads live chain data (read-only) and maps it into
 * the app's domain types. All calls are defensive: on RPC error or rate
 * limit they resolve to a safe empty/default value so the UI never crashes.
 * ------------------------------------------------------------------ */

export interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  rawAmount: string;
  /** true if owned by the Token-2022 program */
  token2022: boolean;
}

export interface WalletSnapshot {
  solBalance: number;
  tokens: TokenBalance[];
}

export interface TxHistoryItem {
  signature: string;
  blockTime: number | null;
  slot: number;
  err: boolean;
  /** fee in SOL, if available */
  feeSol: number | null;
  /** short program names touched, best-effort */
  programs: string[];
}

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const BPF_LOADER_UPGRADEABLE = "BPFLoaderUpgradeab1e11111111111111111111111";

/** Known program labels so decoded instructions read in plain language. */
export const PROGRAM_LABELS: Record<string, string> = {
  "11111111111111111111111111111111": "System Program",
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: "SPL Token",
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: "Token-2022",
  ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: "Associated Token Account",
  ComputeBudget111111111111111111111111111111: "Compute Budget",
  MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr: "Memo",
  JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4: "Jupiter v6",
  whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc: "Orca Whirlpools",
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "Raydium AMM v4",
};

const CORE_PROGRAMS = new Set([
  "11111111111111111111111111111111",
  TOKEN_PROGRAM,
  TOKEN_2022_PROGRAM,
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  "ComputeBudget111111111111111111111111111111",
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
  "Sysvar1111111111111111111111111111111111111",
]);

export function labelForProgram(id: string): string {
  return PROGRAM_LABELS[id] ?? `${id.slice(0, 4)}…${id.slice(-4)}`;
}

/** SOL balance for a wallet. */
export async function getSolBalance(conn: Connection, owner: PublicKey): Promise<number> {
  try {
    const lamports = await conn.getBalance(owner);
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

/** Parsed SPL + Token-2022 balances for a wallet. */
export async function getTokenBalances(conn: Connection, owner: PublicKey): Promise<TokenBalance[]> {
  const out: TokenBalance[] = [];
  for (const [programId, token2022] of [
    [TOKEN_PROGRAM, false],
    [TOKEN_2022_PROGRAM, true],
  ] as const) {
    try {
      const res = await conn.getParsedTokenAccountsByOwner(owner, {
        programId: new PublicKey(programId),
      });
      for (const { account } of res.value) {
        const info = (account.data as ParsedAccountData).parsed?.info;
        const amt = info?.tokenAmount;
        if (!amt) continue;
        const ui = Number(amt.uiAmount ?? 0);
        if (ui === 0) continue; // skip empty accounts
        out.push({
          mint: info.mint,
          amount: ui,
          decimals: amt.decimals,
          rawAmount: amt.amount,
          token2022,
        });
      }
    } catch {
      /* ignore this program's accounts on error */
    }
  }
  return out.sort((a, b) => b.amount - a.amount);
}

export interface DelegatedAccount {
  account: string;
  mint: string;
  delegate: string;
  delegatedAmount: number;
  balance: number;
}

/**
 * Lists the wallet's token accounts that currently have an active delegate
 * approval (a standing permission for someone else to move those tokens).
 */
export async function getDelegatedApprovals(
  conn: Connection,
  owner: PublicKey
): Promise<DelegatedAccount[]> {
  const out: DelegatedAccount[] = [];
  for (const programId of [TOKEN_PROGRAM, TOKEN_2022_PROGRAM]) {
    try {
      const res = await conn.getParsedTokenAccountsByOwner(owner, {
        programId: new PublicKey(programId),
      });
      for (const { pubkey, account } of res.value) {
        const info = (account.data as ParsedAccountData).parsed?.info;
        const delegate: string | undefined = info?.delegate;
        const delegatedAmount = Number(info?.delegatedAmount?.uiAmount ?? 0);
        if (!delegate || delegatedAmount <= 0) continue;
        out.push({
          account: pubkey.toBase58(),
          mint: info.mint,
          delegate,
          delegatedAmount,
          balance: Number(info?.tokenAmount?.uiAmount ?? 0),
        });
      }
    } catch {
      /* ignore this program on error */
    }
  }
  return out;
}

export async function getWalletSnapshot(conn: Connection, owner: PublicKey): Promise<WalletSnapshot> {
  const [solBalance, tokens] = await Promise.all([
    getSolBalance(conn, owner),
    getTokenBalances(conn, owner),
  ]);
  return { solBalance, tokens };
}

/** Recent transaction history for a wallet (best-effort program labels). */
export async function getRecentHistory(
  conn: Connection,
  owner: PublicKey,
  limit = 12
): Promise<TxHistoryItem[]> {
  try {
    const sigs = await conn.getSignaturesForAddress(owner, { limit });
    // Fetch parsed details in parallel but cap concurrency implicitly via Promise.all.
    const detailed = await Promise.all(
      sigs.map(async (s) => {
        let programs: string[] = [];
        let feeSol: number | null = null;
        try {
          const tx = await conn.getParsedTransaction(s.signature, {
            maxSupportedTransactionVersion: 0,
          });
          if (tx) {
            feeSol = tx.meta?.fee != null ? tx.meta.fee / LAMPORTS_PER_SOL : null;
            const ids = new Set<string>();
            for (const ix of tx.transaction.message.instructions) {
              ids.add(ix.programId.toBase58());
            }
            programs = [...ids].map(labelForProgram).slice(0, 3);
          }
        } catch {
          /* parsed fetch is best-effort */
        }
        return {
          signature: s.signature,
          blockTime: s.blockTime ?? null,
          slot: s.slot,
          err: s.err != null,
          feeSol,
          programs,
        } satisfies TxHistoryItem;
      })
    );
    return detailed;
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ *
 * Live metadata mappers — feed the real scanners.
 * ------------------------------------------------------------------ */

/**
 * Resolve real token-mint metadata into a TokenMeta for the Token Scanner.
 * Reads mint/freeze authority and Token-2022 extensions directly from chain.
 */
export async function getMintInfo(conn: Connection, mint: string): Promise<TokenMeta | null> {
  try {
    const pk = new PublicKey(mint);
    const acc = await conn.getParsedAccountInfo(pk);
    const value = acc.value;
    if (!value || !("parsed" in (value.data as ParsedAccountData))) return null;

    const data = value.data as ParsedAccountData;
    const info = data.parsed?.info ?? {};
    const isToken2022 = value.owner.toBase58() === TOKEN_2022_PROGRAM;

    const extensions: TokenMeta["token2022Extensions"] = [];
    if (Array.isArray(info.extensions)) {
      for (const ext of info.extensions) {
        switch (ext.extension) {
          case "permanentDelegate":
            extensions.push("permanent-delegate");
            break;
          case "transferHook":
            extensions.push("transfer-hook");
            break;
          case "transferFeeConfig":
            extensions.push("transfer-fee");
            break;
          case "nonTransferable":
            extensions.push("non-transferable");
            break;
          case "defaultAccountState":
            if (ext.state?.accountState === "frozen") extensions.push("default-frozen");
            break;
        }
      }
    }

    const decimals = Number(info.decimals ?? 0);
    return {
      mint,
      symbol: `${mint.slice(0, 4)}…`,
      name: `${isToken2022 ? "Token-2022" : "SPL"} mint ${mint.slice(0, 4)}…${mint.slice(-4)}`,
      mintAuthorityActive: info.mintAuthority != null,
      freezeAuthorityActive: info.freezeAuthority != null,
      isNft: decimals === 0,
      token2022Extensions: extensions.length ? extensions : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve real program metadata into a ProgramMeta for the Program Scanner.
 * Reads executable/owner and (for upgradeable programs) the upgrade authority
 * from the ProgramData account.
 */
export async function getProgramInfo(conn: Connection, programId: string): Promise<ProgramMeta | null> {
  try {
    const pk = new PublicKey(programId);
    const core = CORE_PROGRAMS.has(programId);
    if (core) {
      return {
        programId,
        name: labelForProgram(programId),
        core: true,
        verified: true,
        deployedDaysAgo: null,
        upgradeAuthority: "immutable",
        receivesFunds: false,
      };
    }

    const acc = await conn.getParsedAccountInfo(pk);
    const value = acc.value;
    let upgradeAuthority: ProgramMeta["upgradeAuthority"] = "none";

    // Upgradeable BPF programs point to a ProgramData account holding the authority.
    if (value && value.owner.toBase58() === BPF_LOADER_UPGRADEABLE) {
      const data = value.data as ParsedAccountData;
      const programDataAddr = data?.parsed?.info?.programData;
      if (programDataAddr) {
        try {
          const pd = await conn.getParsedAccountInfo(new PublicKey(programDataAddr));
          const pdData = pd.value?.data as ParsedAccountData | undefined;
          const authority = pdData?.parsed?.info?.authority;
          upgradeAuthority = authority ? "single-unknown" : "immutable";
        } catch {
          upgradeAuthority = "single-unknown";
        }
      }
    } else if (value && !value.executable) {
      // Not executable — treat as unknown.
      upgradeAuthority = "none";
    } else {
      upgradeAuthority = "immutable"; // non-upgradeable loader
    }

    return {
      programId,
      name: labelForProgram(programId),
      core: false,
      verified: programId in PROGRAM_LABELS, // labelled = known/allowlisted
      deployedDaysAgo: null, // deploy slot age requires extra lookups; left null
      upgradeAuthority,
      receivesFunds: true,
    };
  } catch {
    return null;
  }
}

/**
 * Active cluster, derived from VITE_SOLANA_CLUSTER (explicit) or inferred
 * from the RPC URL. Drives the explorer-link suffix so links resolve on the
 * same network the app is reading from.
 */
export function activeCluster(): "mainnet-beta" | "devnet" | "testnet" {
  const explicit = import.meta.env.VITE_SOLANA_CLUSTER;
  if (explicit === "devnet" || explicit === "testnet" || explicit === "mainnet-beta") {
    return explicit;
  }
  const rpc = (import.meta.env.VITE_SOLANA_RPC || "").toLowerCase();
  if (rpc.includes("devnet")) return "devnet";
  if (rpc.includes("testnet")) return "testnet";
  return "mainnet-beta";
}

function clusterSuffix(): string {
  const c = activeCluster();
  return c === "mainnet-beta" ? "" : `?cluster=${c}`;
}

export function explorerTxUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}${clusterSuffix()}`;
}

export function explorerAddrUrl(address: string): string {
  return `https://solscan.io/account/${address}${clusterSuffix()}`;
}

export function relativeTime(blockTime: number | null): string {
  if (!blockTime) return "—";
  const secs = Math.floor(Date.now() / 1000) - blockTime;
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)} min ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)} hr ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}
