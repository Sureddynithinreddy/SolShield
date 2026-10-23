import {
  VersionedTransaction,
  Transaction,
  PublicKey,
  type Connection,
  type Message,
  type VersionedMessage,
  type AddressLookupTableAccount,
} from "@solana/web3.js";
import {
  evaluateProgramScanner,
  evaluateTokenScanner,
  evaluateWalletScanner,
} from "@shared/scanners";
import {
  decodeInstruction,
  usesDurableNonce,
  computeBalanceChanges,
  type RawInstruction,
} from "@shared/detection";
import { scoreFromRules, sortRulesBySeverity } from "@shared/scoring";
import type {
  BalanceChange,
  FiredRule,
  InstructionItem,
  ScannerPanel,
  TxScenario,
  WalletScanTarget,
} from "@shared/types";
import {
  getMintInfo,
  getProgramInfo,
  labelForProgram,
  snapshotTokenAccounts,
  parseTokenAccountValue,
  type TokenAcctSnapshot,
} from "./chain.js";
import {
  detectAuthorityChanges,
  authorityChangeRules,
  type TokenBalanceSnapshot,
  type TokenAccountState,
} from "@shared/detection";
import { intel } from "./intel/store.js";

const SPL_TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

export interface ScanRequest {
  transaction: string; // base64 unsigned tx
  origin?: string; // dApp domain
  signer?: string; // connected wallet pubkey
}

export interface ScanResponse {
  ok: boolean;
  error?: string;
  scenario?: TxScenario;
  simLogs?: string[];
}

function decode(b64: string): VersionedTransaction {
  const clean = b64.trim().replace(/\s+/g, "");
  const bytes = Buffer.from(clean, "base64");
  try {
    return VersionedTransaction.deserialize(bytes);
  } catch {
    const legacy = Transaction.from(bytes);
    return new VersionedTransaction(legacy.compileMessage());
  }
}

async function resolveKeys(
  conn: Connection,
  message: VersionedMessage | Message
): Promise<PublicKey[]> {
  const anyMsg = message as VersionedMessage;
  if ("addressTableLookups" in anyMsg && anyMsg.addressTableLookups.length > 0) {
    const lookups: AddressLookupTableAccount[] = [];
    for (const l of anyMsg.addressTableLookups) {
      try {
        const res = await conn.getAddressLookupTable(l.accountKey);
        if (res.value) lookups.push(res.value);
      } catch {
        /* skip */
      }
    }
    try {
      const resolved = anyMsg.getAccountKeys({ addressLookupTableAccounts: lookups });
      return [...resolved.keySegments().flat()];
    } catch {
      /* fall through */
    }
  }
  const staticKeys =
    "staticAccountKeys" in anyMsg ? anyMsg.staticAccountKeys : (message as Message).accountKeys;
  return [...staticKeys];
}

export async function analyze(conn: Connection, req: ScanRequest): Promise<ScanResponse> {
  let tx: VersionedTransaction;
  try {
    tx = decode(req.transaction);
  } catch {
    return { ok: false, error: "Could not decode transaction (expected base64 unsigned tx)." };
  }

  const message = tx.message;
  const keys = await resolveKeys(conn, message);
  const feePayer = keys[0]?.toBase58() ?? req.signer ?? "";

  // Decode instructions.
  const programIds = new Set<string>();
  const rawIxs: RawInstruction[] = [];
  const instructions: InstructionItem[] = message.compiledInstructions.map((ci, i) => {
    const programId = keys[ci.programIdIndex]?.toBase58() ?? "unknown";
    programIds.add(programId);
    const raw: RawInstruction = {
      programId,
      dataFirstByte: ci.data.length > 0 ? ci.data[0] : undefined,
      accountCount: ci.accountKeyIndexes.length,
    };
    rawIxs.push(raw);
    const d = decodeInstruction(raw);
    return { index: i, program: labelForProgram(programId), programId, name: d.name, summary: d.summary, flagged: d.flagged };
  });
  const durableNonce = usesDurableNonce(rawIxs[0]);

  // --- Simulate with full balance + authority diffing ---
  let simLogs: string[] = [];
  let simErr = false;
  let balanceChanges: BalanceChange[] = [];
  let authorityChanges: ReturnType<typeof detectAuthorityChanges> = [];
  try {
    const feePayerKey = keys[0];

    // Pre-state: SOL + the signer's token accounts.
    const preSnap: TokenAcctSnapshot[] = feePayerKey
      ? await snapshotTokenAccounts(conn, feePayerKey).catch(() => [])
      : [];
    const preLamports = feePayerKey ? await conn.getBalance(feePayerKey).catch(() => null) : null;

    // Ask the simulator to return post-state for the fee payer + its token
    // accounts so we can diff balances and authorities.
    const watchAddresses = [
      ...(feePayerKey ? [feePayerKey.toBase58()] : []),
      ...preSnap.map((s) => s.account),
    ].slice(0, 20);

    const sim = await conn.simulateTransaction(tx, {
      replaceRecentBlockhash: true,
      sigVerify: false,
      // jsonParsed gives us post-state token-account fields; web3.js types only
      // declare "base64" for this field, but the RPC accepts jsonParsed.
      accounts: watchAddresses.length
        ? ({ encoding: "jsonParsed", addresses: watchAddresses } as unknown as {
            encoding: "base64";
            addresses: string[];
          })
        : undefined,
    });
    simLogs = sim.value.logs ?? [];
    simErr = sim.value.err != null;

    const simAccounts = sim.value.accounts ?? [];
    const owner = feePayerKey?.toBase58() ?? req.signer ?? "";

    // Post SOL (first watched address is the fee payer).
    const postLamports = simAccounts[0]?.lamports ?? null;

    // Build post token snapshots from jsonParsed sim accounts.
    const postSnap: TokenAcctSnapshot[] = [];
    watchAddresses.forEach((addr, i) => {
      if (i === 0) return; // fee payer (system account)
      const acc = simAccounts[i];
      if (!acc) return;
      const parsed = parseTokenAccountValue(addr, { data: acc.data as unknown as { parsed?: unknown } } as never);
      if (parsed) postSnap.push(parsed);
    });

    // Per-token balance diff.
    const toBalSnap = (s: TokenAcctSnapshot): TokenBalanceSnapshot => ({
      accountIndex: 0,
      mint: s.mint,
      owner: s.owner,
      uiAmount: s.uiAmount,
      decimals: s.decimals,
    });
    if (preLamports != null && feePayerKey) {
      balanceChanges = computeBalanceChanges({
        owner,
        preSol: preLamports,
        postSol: postLamports ?? preLamports,
        preTokens: preSnap.map(toBalSnap),
        postTokens: postSnap.map(toBalSnap),
      });
    }

    // Authority / ownership-change detection (R-002).
    const toAcctState = (s: TokenAcctSnapshot): TokenAccountState => ({
      account: s.account,
      mint: s.mint,
      owner: s.owner,
      delegate: s.delegate,
      closeAuthority: s.closeAuthority,
    });
    if (postSnap.length) {
      authorityChanges = detectAuthorityChanges(owner, preSnap.map(toAcctState), postSnap.map(toAcctState));
    }
  } catch {
    simErr = true;
  }

  // Program metadata.
  const programs = await Promise.all([...programIds].map((id) => getProgramInfo(conn, id)));

  // Token mints touched.
  const usesTokenProgram = programIds.has(SPL_TOKEN) || programIds.has(TOKEN_2022);
  const tokens = usesTokenProgram
    ? (
        await Promise.all(keys.slice(0, 25).map((k) => getMintInfo(conn, k.toBase58())))
      ).filter((t): t is NonNullable<typeof t> => t != null)
    : [];

  // Wallet targets enriched with real intel (drainer / sanctioned / cluster).
  const recipientKeys = [...new Set(keys.slice(1).map((k) => k.toBase58()))].slice(0, 10);
  const walletTargets: WalletScanTarget[] = recipientKeys.map((addr) => {
    const drainer = intel.drainer(addr);
    return {
      address: addr,
      role: "Counterparty",
      drainer: !!drainer,
      drainerThefts: drainer?.thefts,
      sanctioned: intel.isSanctioned(addr),
      maliciousCluster: intel.isCluster(addr),
      isSelf: addr === req.signer,
    };
  });
  // Always include the fee payer as self.
  walletTargets.unshift({ address: feePayer, role: "Fee payer", isSelf: feePayer === req.signer });

  // Domain reputation from intel + lookalike.
  const domain = intel.evaluateDomain(req.origin || "local-analysis");

  // Run shared scanners.
  const programCheck = evaluateProgramScanner(programs);
  const walletCheck = evaluateWalletScanner(walletTargets, domain);
  const tokenCheck = evaluateTokenScanner(tokens);

  const rules: FiredRule[] = [
    ...programCheck.firedRules,
    ...walletCheck.firedRules,
    ...tokenCheck.firedRules,
    ...authorityChangeRules(authorityChanges),
  ];
  if (simErr) {
    rules.push({
      id: "R-SIM-1",
      title: "Simulation failed",
      severity: "medium",
      explanation: "The transaction failed to simulate. It may revert on-chain or behave evasively.",
      recommendedAction: "Do not sign unless you understand why it fails.",
    });
  }
  if (durableNonce) {
    rules.push({
      id: "R-009",
      title: "Durable nonce",
      severity: "medium",
      explanation: "Uses a durable nonce — can be signed now and submitted later. Riskier from untrusted sites.",
      recommendedAction: "Only sign durable-nonce transactions you initiated.",
    });
  }

  const { score, verdict } = scoreFromRules(rules);
  const hardBlock = rules.some((r) => r.hardBlock);
  const firedRules = sortRulesBySeverity(rules);

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
        simErr
          ? { label: "Simulation", value: "Failed or reverted", status: "warn" }
          : { label: "Simulation", value: "Succeeded", status: "ok" },
        {
          label: "Net balance change",
          value: balanceChanges.length
            ? balanceChanges.map((b) => `${b.amount > 0 ? "+" : ""}${b.amount.toFixed(4)} ${b.symbol}`).join(" / ")
            : "No net change detected",
          status: balanceChanges.some((b) => b.amount < 0) ? "info" : "ok",
        },
        {
          label: "Authority changes",
          value: authorityChanges.length
            ? authorityChanges.map((c) => c.kind).join(", ")
            : "None detected",
          status: authorityChanges.length ? "bad" : "ok",
        },
        { label: "Instructions", value: `${instructions.length} decoded`, status: "info" },
        { label: "Accounts", value: `${keys.length} resolved`, status: "info" },
      ],
    },
  ];

  const summary = hardBlock
    ? "A hard-block rule fired. This transaction is dangerous — do not sign."
    : verdict === "dangerous"
    ? "Multiple high-risk signals detected. Review carefully before signing."
    : verdict === "caution"
    ? "Some risk signals were found. Review the details before you proceed."
    : "No significant risks detected in this transaction.";

  const scenario: TxScenario = {
    id: "backend-scan",
    dappName: req.origin || "Pasted transaction",
    dappDomain: domain.domain,
    dappFavicon: "🛡️",
    requestType: "signTransaction",
    verdict,
    score,
    confidence: simErr ? "low" : "high",
    summary,
    balanceChanges,
    permissions: tokens
      .filter((t) => t.delegateApproval)
      .map((t) => ({
        label: `${t.symbol} delegate approval`,
        detail: `Grants a spending delegate on your ${t.symbol}.`,
        severity: "high" as const,
      })),
    firedRules,
    scanners,
    instructions,
    programs,
    walletTargets,
    domain,
    tokens,
    feeSol: 0,
    scanMs: 0,
    scanSource: "backend",
  };

  return { ok: true, scenario, simLogs };
}
