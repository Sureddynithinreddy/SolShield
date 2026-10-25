import {
  Connection,
  PublicKey,
  type ParsedAccountData,
} from "@solana/web3.js";
import type { ProgramMeta, TokenMeta } from "@shared/types";
import { intel } from "./intel/store.js";

const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const BPF_LOADER_UPGRADEABLE = "BPFLoaderUpgradeab1e11111111111111111111111";

export const PROGRAM_LABELS: Record<string, string> = {
  "11111111111111111111111111111111": "System Program",
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: "SPL Token",
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: "Token-2022",
  ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: "Associated Token Account",
  ComputeBudget111111111111111111111111111111: "Compute Budget",
  MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr: "Memo",
};

const CORE_PROGRAMS = new Set(Object.keys(PROGRAM_LABELS));

export function labelForProgram(id: string): string {
  return intel.programAllow(id)?.name ?? PROGRAM_LABELS[id] ?? `${id.slice(0, 4)}…${id.slice(-4)}`;
}

/** Cache deploy-age per program (slot → days) so we don't re-query every scan. */
const deployAgeCache = new Map<string, { daysAgo: number | null; at: number }>();
const DEPLOY_AGE_TTL = 6 * 60 * 60 * 1000; // 6h

/**
 * Resolve how many days ago a program was last deployed, from its
 * ProgramData account's last-deploy slot via getBlockTime. Returns null when
 * it can't be determined (non-upgradeable, RPC error, missing block time).
 */
export async function resolveDeployedDaysAgo(
  conn: Connection,
  lastDeploySlot: number | null | undefined
): Promise<number | null> {
  if (lastDeploySlot == null) return null;
  try {
    const blockTime = await conn.getBlockTime(lastDeploySlot);
    if (blockTime == null) return null;
    const days = (Date.now() / 1000 - blockTime) / 86_400;
    return Math.max(0, Math.round(days));
  } catch {
    return null;
  }
}

export async function getProgramInfo(conn: Connection, programId: string): Promise<ProgramMeta> {
  const core = CORE_PROGRAMS.has(programId);
  if (core) {
    return {
      programId,
      name: PROGRAM_LABELS[programId],
      core: true,
      verified: true,
      deployedDaysAgo: null,
      upgradeAuthority: "immutable",
      receivesFunds: false,
    };
  }

  // Intel blocklist short-circuit.
  const blocked = intel.programBlock(programId);
  const allow = intel.programAllow(programId);

  let upgradeAuthority: ProgramMeta["upgradeAuthority"] = "none";
  let deployedDaysAgo: number | null = null;
  try {
    const acc = await conn.getParsedAccountInfo(new PublicKey(programId));
    const value = acc.value;
    if (value && value.owner.toBase58() === BPF_LOADER_UPGRADEABLE) {
      const data = value.data as ParsedAccountData;
      const programDataAddr = data?.parsed?.info?.programData;
      if (programDataAddr) {
        const pd = await conn.getParsedAccountInfo(new PublicKey(programDataAddr));
        const pdData = pd.value?.data as ParsedAccountData | undefined;
        const pdInfo = pdData?.parsed?.info;
        const authority = pdInfo?.authority;
        upgradeAuthority = authority ? "single-unknown" : "immutable";

        // Resolve the real deploy age from the last-deploy slot (cached).
        const cached = deployAgeCache.get(programId);
        if (cached && Date.now() - cached.at < DEPLOY_AGE_TTL) {
          deployedDaysAgo = cached.daysAgo;
        } else {
          deployedDaysAgo = await resolveDeployedDaysAgo(conn, pdInfo?.slot);
          deployAgeCache.set(programId, { daysAgo: deployedDaysAgo, at: Date.now() });
        }
      }
    } else if (value && value.executable) {
      upgradeAuthority = "immutable";
    }
  } catch {
    upgradeAuthority = "none";
  }

  return {
    programId,
    name: labelForProgram(programId),
    core: false,
    verified: !!allow?.verified,
    // Blocklisted programs are treated as brand-new/high-risk regardless.
    deployedDaysAgo: blocked ? 1 : deployedDaysAgo,
    upgradeAuthority: blocked ? "single-unknown" : upgradeAuthority,
    receivesFunds: true,
    viaCpi: false,
  };
}

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

export interface TokenAcctSnapshot {
  account: string;
  mint: string;
  owner: string;
  delegate: string | null;
  closeAuthority: string | null;
  uiAmount: number;
  decimals: number;
}

/** Snapshot the owner's SPL + Token-2022 token accounts (pre-state). */
export async function snapshotTokenAccounts(
  conn: Connection,
  owner: PublicKey
): Promise<TokenAcctSnapshot[]> {
  const out: TokenAcctSnapshot[] = [];
  for (const programId of [TOKEN_PROGRAM, TOKEN_2022]) {
    try {
      const res = await conn.getParsedTokenAccountsByOwner(owner, {
        programId: new PublicKey(programId),
      });
      for (const { pubkey, account } of res.value) {
        const info = (account.data as ParsedAccountData).parsed?.info ?? {};
        out.push({
          account: pubkey.toBase58(),
          mint: info.mint,
          owner: info.owner,
          delegate: info.delegate ?? null,
          closeAuthority: info.closeAuthority ?? null,
          uiAmount: Number(info.tokenAmount?.uiAmount ?? 0),
          decimals: Number(info.tokenAmount?.decimals ?? 0),
        });
      }
    } catch {
      /* ignore */
    }
  }
  return out;
}

/** Parse a simulated post-state token account (base64) is complex; instead we
 * re-read the accounts referenced by the tx from the simulation's returned
 * account data where the parser gives us owner/delegate. For the demo-grade
 * backend we parse post-state via getMultipleParsedAccounts after simulation
 * is not possible (sim doesn't commit), so we approximate post-state from the
 * instruction set. This helper parses a parsed token-account value. */
export function parseTokenAccountValue(
  account: string,
  value: { data: ParsedAccountData } | null
): TokenAcctSnapshot | null {
  if (!value || !("parsed" in value.data)) return null;
  const info = value.data.parsed?.info ?? {};
  if (value.data.parsed?.type !== "account") return null;
  return {
    account,
    mint: info.mint,
    owner: info.owner,
    delegate: info.delegate ?? null,
    closeAuthority: info.closeAuthority ?? null,
    uiAmount: Number(info.tokenAmount?.uiAmount ?? 0),
    decimals: Number(info.tokenAmount?.decimals ?? 0),
  };
}

export async function getMintInfo(conn: Connection, mint: string): Promise<TokenMeta | null> {
  try {
    const acc = await conn.getParsedAccountInfo(new PublicKey(mint));
    const value = acc.value;
    if (!value || !("parsed" in (value.data as ParsedAccountData))) return null;
    const data = value.data as ParsedAccountData;
    if (data.parsed?.type !== "mint") return null;

    const info = data.parsed?.info ?? {};
    const isToken2022 = value.owner.toBase58() === TOKEN_2022;

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
