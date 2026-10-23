import {
  Connection,
  VersionedTransaction,
  Transaction,
  PublicKey,
  type Message,
  type VersionedMessage,
  type AddressLookupTableAccount,
} from "@solana/web3.js";
import type {
  BalanceChange,
  InstructionItem,
  ScannerPanel,
  TxScenario,
} from "./types";
import { getMintInfo, getProgramInfo, labelForProgram } from "./solana";
import {
  evaluateProgramScanner,
  evaluateTokenScanner,
  evaluateWalletScanner,
} from "./securityChecks";
import {
  decodeInstruction,
  computeBalanceChanges,
  usesDurableNonce,
  type RawInstruction,
  type TokenBalanceSnapshot,
} from "@shared/detection";
import { scoreFromRules, sortRulesBySeverity } from "@shared/scoring";

/* ------------------------------------------------------------------ *
 * Real transaction analyzer (#2).
 *
 * Takes a base64-encoded unsigned transaction, decodes it (legacy or v0,
 * resolving Address Lookup Tables), simulates it against the RPC, pulls
 * live program + token metadata, runs the real scanner engines and
 * produces a TxScenario the signing overlay can render.
 * ------------------------------------------------------------------ */

const SPL_TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

export interface AnalyzeResult {
  ok: boolean;
  error?: string;
  scenario?: TxScenario;
  simLogs?: string[];
  simUnits?: number | null;
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.trim().replace(/\s+/g, "");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Decode either a versioned or legacy transaction from raw bytes. */
function decode(bytes: Uint8Array): VersionedTransaction {
  try {
    return VersionedTransaction.deserialize(bytes);
  } catch {
    // Fall back to legacy and wrap as a versioned message.
    const legacy = Transaction.from(bytes);
    const msg = legacy.compileMessage();
    return new VersionedTransaction(msg);
  }
}

/** Resolve all account keys, following ALTs for v0 messages. */
async function resolveAccountKeys(
  conn: Connection,
  message: VersionedMessage | Message
): Promise<{ keys: PublicKey[]; lookups: AddressLookupTableAccount[] }> {
  const lookups: AddressLookupTableAccount[] = [];
  // Versioned messages expose addressTableLookups.
  const anyMsg = message as VersionedMessage;
  if ("addressTableLookups" in anyMsg && anyMsg.addressTableLookups.length > 0) {
    for (const lookup of anyMsg.addressTableLookups) {
      try {
        const res = await conn.getAddressLookupTable(lookup.accountKey);
        if (res.value) lookups.push(res.value);
      } catch {
        /* skip unresolved tables */
      }
    }
    try {
      const resolved = anyMsg.getAccountKeys({ addressLookupTableAccounts: lookups });
      return { keys: [...resolved.keySegments().flat()], lookups };
    } catch {
      /* fall through to static keys */
    }
  }
  // Legacy or no lookups: static keys only.
  const staticKeys =
    "staticAccountKeys" in anyMsg
      ? anyMsg.staticAccountKeys
      : (message as Message).accountKeys;
  return { keys: [...staticKeys], lookups };
}

export async function analyzeTransaction(
  conn: Connection,
  base64: string,
  signer?: string
): Promise<AnalyzeResult> {
  let tx: VersionedTransaction;
  try {
    tx = decode(base64ToBytes(base64));
  } catch (e) {
    return { ok: false, error: "Could not decode transaction. Paste a base64-encoded unsigned transaction." };
  }

  const message = tx.message;
  const { keys } = await resolveAccountKeys(conn, message);

  // Build human-readable instructions (real decoding) + collect program ids.
  const programIds = new Set<string>();
  const rawInstructions: RawInstruction[] = [];
  const instructions: InstructionItem[] = message.compiledInstructions.map((ci, i) => {
    const programId = keys[ci.programIdIndex]?.toBase58() ?? "unknown";
    programIds.add(programId);
    const raw: RawInstruction = {
      programId,
      dataFirstByte: ci.data.length > 0 ? ci.data[0] : undefined,
      discriminator:
        ci.data.length >= 8
          ? Array.from(ci.data.slice(0, 8))
              .map((x) => x.toString(16).padStart(2, "0"))
              .join("")
          : undefined,
      accountCount: ci.accountKeyIndexes.length,
    };
    rawInstructions.push(raw);
    const decoded = decodeInstruction(raw);
    return {
      index: i,
      program: labelForProgram(programId),
      programId,
      name: decoded.name,
      summary: decoded.summary,
      flagged: decoded.flagged,
    };
  });

  const durableNonce = usesDurableNonce(rawInstructions[0]);

  // --- Simulate (best-effort), capturing fee-payer post-state for a SOL diff ---
  const feePayerKey = keys[0];
  let simLogs: string[] = [];
  let simUnits: number | null = null;
  let simErr = false;
  let balanceChanges: BalanceChange[] = [];
  try {
    const preLamports = feePayerKey ? await conn.getBalance(feePayerKey).catch(() => null) : null;
    const sim = await conn.simulateTransaction(tx, {
      replaceRecentBlockhash: true,
      sigVerify: false,
      accounts: feePayerKey ? { encoding: "base64", addresses: [feePayerKey.toBase58()] } : undefined,
    });
    simLogs = sim.value.logs ?? [];
    simUnits = sim.value.unitsConsumed ?? null;
    simErr = sim.value.err != null;

    const postLamports = sim.value.accounts?.[0]?.lamports ?? null;
    if (preLamports != null && postLamports != null && feePayerKey) {
      balanceChanges = computeBalanceChanges({
        owner: feePayerKey.toBase58(),
        preSol: preLamports,
        postSol: postLamports,
        preTokens: [] as TokenBalanceSnapshot[],
        postTokens: [] as TokenBalanceSnapshot[],
      });
    }
  } catch {
    simErr = true;
  }

  // --- Fetch live program metadata and run the Program Scanner ---
  const programMetas = (
    await Promise.all([...programIds].map((id) => getProgramInfo(conn, id)))
  ).filter((p): p is NonNullable<typeof p> => p != null);

  // --- Fetch token mints touched (any account owned by a token program) ---
  // Heuristic: treat accounts that are themselves mints as token mints.
  const candidateMints = keys.map((k) => k.toBase58());
  const tokenMetas = (
    await Promise.all(
      candidateMints.slice(0, 20).map(async (addr) => {
        const meta = await getMintInfo(conn, addr);
        return meta;
      })
    )
  ).filter((t): t is NonNullable<typeof t> => t != null);

  const usesTokenProgram = programIds.has(SPL_TOKEN) || programIds.has(TOKEN_2022);

  // --- Run the real scanners ---
  const programCheck = evaluateProgramScanner(programMetas);
  const tokenCheck = evaluateTokenScanner(usesTokenProgram ? tokenMetas : []);
  // Wallet scanner: we can't resolve recipients to intel lists in-browser,
  // so we evaluate structural facts we DO have (fee payer, self), with a
  // neutral local domain. Drainer/phishing lists require the backend.
  const feePayer = keys[0]?.toBase58() ?? signer ?? "";
  const walletCheck = evaluateWalletScanner(
    [{ address: feePayer, role: "Fee payer", isSelf: feePayer === signer }],
    {
      domain: "local-analysis",
      ageDays: 9999,
      ssl: true,
      onPhishingList: false,
      reputation: 100,
    }
  );

  // Merge fired rules.
  const allRules = [
    ...programCheck.firedRules,
    ...walletCheck.firedRules,
    ...tokenCheck.firedRules,
  ];

  // Add a simulation finding/rule.
  const simFinding = simErr
    ? { label: "Simulation", value: "Failed or reverted", status: "warn" as const }
    : { label: "Simulation", value: `Succeeded${simUnits ? ` · ${simUnits.toLocaleString()} CU` : ""}`, status: "ok" as const };
  if (simErr) {
    allRules.push({
      id: "R-SIM-1",
      title: "Simulation failed",
      severity: "medium",
      explanation: "The transaction failed to simulate. It may revert on-chain, use a stale blockhash, or behave evasively.",
      recommendedAction: "Do not sign unless you understand why it fails.",
    });
  }

  // R-009 — durable nonce (can be signed now, submitted later).
  if (durableNonce) {
    allRules.push({
      id: "R-009",
      title: "Durable nonce",
      severity: "medium",
      explanation: "This transaction uses a durable nonce, so it can be signed now and submitted much later. Treat with extra caution from untrusted sites.",
      recommendedAction: "Only sign durable-nonce transactions you initiated.",
    });
  }

  // --- Score via the shared PRD scoring model ---
  const { score, verdict } = scoreFromRules(allRules);
  const hardBlock = allRules.some((r) => r.hardBlock);

  const scanners: ScannerPanel[] = [
    { key: "program", title: "Program Scanner", findings: programCheck.findings },
    { key: "wallet", title: "Wallet Scanner", findings: walletCheck.findings },
    {
      key: "token",
      title: "Token Scanner",
      findings: usesTokenProgram
        ? tokenCheck.findings.length
          ? tokenCheck.findings
          : [{ label: "Token activity", value: "No mint metadata resolved", status: "info" }]
        : [{ label: "Token activity", value: "No token program invoked", status: "ok" }],
    },
    {
      key: "simulator",
      title: "Simulator",
      findings: [
        simFinding,
        { label: "Instructions", value: `${instructions.length} decoded`, status: "info" },
        { label: "Accounts", value: `${keys.length} resolved`, status: "info" },
      ],
    },
  ];

  const firedRules = sortRulesBySeverity(allRules);

  const summary = hardBlock
    ? "A hard-block rule fired. This transaction is dangerous — do not sign."
    : verdict === "dangerous"
    ? "Multiple high-risk signals detected in this transaction. Review carefully before signing."
    : verdict === "caution"
    ? "Some risk signals were found. Review the details before you proceed."
    : "No significant risks detected in this transaction from the live scan.";

  const scenario: TxScenario = {
    id: "live-analysis",
    dappName: "Pasted transaction",
    dappDomain: "local analysis",
    dappFavicon: "🔬",
    requestType: "signTransaction",
    verdict,
    score,
    confidence: simErr ? "low" : "medium",
    summary,
    balanceChanges,
    permissions: tokenMetas
      .filter((t) => t.delegateApproval)
      .map((t) => ({
        label: `${t.symbol} delegate approval`,
        detail: `Grants a spending delegate on your ${t.symbol}.`,
        severity: "high" as const,
      })),
    firedRules,
    scanners,
    instructions,
    programs: programMetas,
    walletTargets: [],
    domain: {
      domain: "local-analysis",
      ageDays: 9999,
      ssl: true,
      onPhishingList: false,
      reputation: 100,
    },
    tokens: usesTokenProgram ? tokenMetas : [],
    feeSol: 0,
    scanMs: 0,
    scanSource: "local",
  };

  return { ok: true, scenario, simLogs, simUnits };
}
