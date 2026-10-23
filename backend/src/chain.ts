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
  try {
    const acc = await conn.getParsedAccountInfo(new PublicKey(programId));
    const value = acc.value;
    if (value && value.owner.toBase58() === BPF_LOADER_UPGRADEABLE) {
      const data = value.data as ParsedAccountData;
      const programDataAddr = data?.parsed?.info?.programData;
      if (programDataAddr) {
        const pd = await conn.getParsedAccountInfo(new PublicKey(programDataAddr));
        const pdData = pd.value?.data as ParsedAccountData | undefined;
        const authority = pdData?.parsed?.info?.authority;
        upgradeAuthority = authority ? "single-unknown" : "immutable";
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
    deployedDaysAgo: blocked ? 1 : null,
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
