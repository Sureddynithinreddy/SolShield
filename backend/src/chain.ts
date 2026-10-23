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
