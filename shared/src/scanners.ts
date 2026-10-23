import type {
  CheckResult,
  DomainMeta,
  FiredRule,
  ProgramMeta,
  ScannerFinding,
  ScannerPanel,
  TokenMeta,
  TxScenario,
  WalletScanTarget,
} from "./types";
import { shortAddr, usd } from "./format";
import { dedupeRules, sortRulesBySeverity } from "./scoring";

/* ================================================================== *
 * Program Scanner — brand-new / unverified / upgrade-authority check.
 * PRD section 5.3 (PRG-1/3/5/7, R-004).
 * ================================================================== */

export const BRAND_NEW_MAX_DAYS = 3; // 72 hours

function programFinding(p: ProgramMeta): ScannerFinding {
  if (p.core) return { label: p.name, value: "Core program", status: "ok" };

  const brandNew = p.deployedDaysAgo !== null && p.deployedDaysAgo < BRAND_NEW_MAX_DAYS;
  const young = p.deployedDaysAgo !== null && p.deployedDaysAgo < 30;

  if (p.viaCpi && !p.verified) {
    return { label: `${p.name} (CPI)`, value: "Unverified program called via CPI", status: "bad" };
  }
  if (brandNew && p.receivesFunds) {
    return { label: p.name, value: `Deployed ${p.deployedDaysAgo}d ago · receives funds`, status: "bad" };
  }
  if (p.verified) return { label: p.name, value: "Verified build · audited", status: "ok" };

  const ageText = p.deployedDaysAgo === null ? "deploy date unknown" : `deployed ${p.deployedDaysAgo}d ago`;
  return { label: p.name, value: `Unverified · ${ageText}`, status: young ? "warn" : "info" };
}

function upgradeAuthorityFinding(programs: ProgramMeta[]): ScannerFinding {
  const nonCore = programs.filter((p) => !p.core);
  if (nonCore.length === 0) {
    return { label: "Upgrade authority", value: "All core programs · immutable", status: "ok" };
  }
  const singleUnknown = nonCore.find((p) => p.upgradeAuthority === "single-unknown");
  if (singleUnknown) {
    return { label: "Upgrade authority", value: `${singleUnknown.name}: single unknown key`, status: "warn" };
  }
  const allSafe = nonCore.every(
    (p) => p.upgradeAuthority === "immutable" || p.upgradeAuthority === "multisig-known"
  );
  if (allSafe) return { label: "Upgrade authority", value: "Immutable or known multisig", status: "ok" };
  return { label: "Upgrade authority", value: "Mixed · review", status: "info" };
}

export function evaluateProgramScanner(programs: ProgramMeta[]): CheckResult {
  const findings: ScannerFinding[] = programs.map(programFinding);
  findings.push(upgradeAuthorityFinding(programs));

  const firedRules: FiredRule[] = [];

  const brandNewFunded = programs.filter(
    (p) => !p.core && p.receivesFunds && p.deployedDaysAgo !== null && p.deployedDaysAgo < BRAND_NEW_MAX_DAYS
  );
  const youngUnverifiedFunded = programs.filter(
    (p) =>
      !p.core &&
      !p.verified &&
      p.receivesFunds &&
      p.deployedDaysAgo !== null &&
      p.deployedDaysAgo >= BRAND_NEW_MAX_DAYS &&
      p.deployedDaysAgo < 30
  );

  if (brandNewFunded.length > 0) {
    const p = brandNewFunded[0];
    firedRules.push({
      id: "R-004",
      title: "Brand-new program",
      severity: "high",
      explanation: `${p.name} was deployed ${p.deployedDaysAgo} days ago (under 72h) and receives your funds. Brand-new programs are a common rug-pull vector.`,
      recommendedAction: "Do not sign unless you fully trust this program.",
    });
  } else if (youngUnverifiedFunded.length > 0) {
    const p = youngUnverifiedFunded[0];
    firedRules.push({
      id: "R-004",
      title: "Brand-new program",
      severity: "medium",
      explanation: `${p.name} was deployed ${p.deployedDaysAgo} days ago and is not yet verified. New programs carry higher risk.`,
      recommendedAction: "New programs carry higher risk. Review before signing.",
    });
  }

  const singleUnknown = programs.filter((p) => !p.core && p.upgradeAuthority === "single-unknown");
  if (singleUnknown.length > 0) {
    const p = singleUnknown[0];
    firedRules.push({
      id: "R-PRG-3",
      title: "Single-key upgrade authority",
      severity: "medium",
      explanation: `${p.name} can be upgraded at any time by a single unknown key. Its code could change after you interact with it.`,
      recommendedAction: "Prefer immutable programs or known multisig authorities.",
    });
  }

  const cpiUnverified = programs.filter((p) => p.viaCpi && !p.verified && !p.core);
  if (cpiUnverified.length > 0) {
    const p = cpiUnverified[0];
    firedRules.push({
      id: "R-PRG-7",
      title: "Unverified CPI call",
      severity: "high",
      explanation: `An unverified program (${shortAddr(p.programId, 6, 6)}) is invoked via cross-program invocation. Hidden logic may run that is not visible in the top-level instructions.`,
      recommendedAction: "Treat unverified CPI targets as untrusted.",
    });
  }

  return { findings, firedRules };
}

/* ================================================================== *
 * Wallet Scanner — drainer / sanctioned / phishing / lookalike check.
 * PRD section 5.4 (WAL-1/2/3/4/5, R-001, R-007, R-008).
 * ================================================================== */

export const NEW_WALLET_VALUE_USD = 100;
export const NEW_WALLET_MAX_DAYS = 7;

function targetFinding(t: WalletScanTarget): ScannerFinding {
  const who = `${t.role} ${shortAddr(t.address, 4, 4)}`;
  if (t.drainer) {
    return { label: who, value: `CONFIRMED DRAINER${t.drainerThefts ? ` · ${t.drainerThefts}+ thefts` : ""}`, status: "bad" };
  }
  if (t.sanctioned) return { label: who, value: "On sanctioned-address list", status: "bad" };
  if (t.poisoningLookalikeOf) {
    return { label: who, value: `Mimics ${shortAddr(t.poisoningLookalikeOf, 4, 4)} — address poisoning`, status: "bad" };
  }
  if (t.maliciousCluster) return { label: who, value: "Funded by a known malicious wallet", status: "bad" };
  if (t.isSelf) return { label: who, value: "Your own account", status: "ok" };
  const newish = t.ageDays !== null && t.ageDays !== undefined && t.ageDays < NEW_WALLET_MAX_DAYS;
  if (newish && (t.incomingUsd ?? 0) >= NEW_WALLET_VALUE_USD) {
    return { label: who, value: `Brand-new wallet (${t.ageDays}d) receiving ${usd(t.incomingUsd ?? 0)}`, status: "warn" };
  }
  return { label: who, value: "No negative history", status: "ok" };
}

function domainFinding(d: DomainMeta): ScannerFinding {
  if (d.onPhishingList) return { label: `Domain ${d.domain}`, value: "On phishing blocklist", status: "bad" };
  if (d.lookalikeOf) return { label: `Domain ${d.domain}`, value: `Lookalike of ${d.lookalikeOf} · ${d.ageDays}d old`, status: "bad" };
  if (d.ageDays < 30) return { label: `Domain ${d.domain}`, value: `Domain age ${d.ageDays} days`, status: "warn" };
  return {
    label: `Domain ${d.domain}`,
    value: `Reputation ${d.reputation}/100 · SSL ${d.ssl ? "valid" : "INVALID"}`,
    status: d.ssl ? "ok" : "warn",
  };
}

export function evaluateWalletScanner(targets: WalletScanTarget[], domain: DomainMeta): CheckResult {
  const findings: ScannerFinding[] = targets.map(targetFinding);
  findings.push(domainFinding(domain));
  if (!domain.ssl && !domain.onPhishingList && !domain.lookalikeOf) {
    findings.push({ label: "SSL", value: "Certificate invalid or missing", status: "warn" });
  }

  const firedRules: FiredRule[] = [];

  const drainer = targets.find((t) => t.drainer);
  if (drainer) {
    firedRules.push({
      id: "R-001",
      title: "Drainer destination",
      severity: "critical",
      hardBlock: true,
      explanation: `Recipient ${shortAddr(drainer.address, 6, 6)} is on the confirmed drainer list${drainer.drainerThefts ? `, linked to ${drainer.drainerThefts}+ previous thefts` : ""}.`,
      recommendedAction: "Hard block. Reject this transaction.",
    });
  }

  const sanctioned = targets.find((t) => t.sanctioned);
  if (sanctioned) {
    firedRules.push({
      id: "R-WAL-1",
      title: "Sanctioned address",
      severity: "critical",
      hardBlock: true,
      explanation: `Recipient ${shortAddr(sanctioned.address, 6, 6)} appears on a sanctioned-address list. Interacting with it may be illegal.`,
      recommendedAction: "Do not proceed.",
    });
  }

  const poisoned = targets.find((t) => t.poisoningLookalikeOf);
  if (poisoned) {
    firedRules.push({
      id: "R-008",
      title: "Address poisoning",
      severity: "high",
      explanation: `Destination ${shortAddr(poisoned.address, 6, 6)} closely resembles a recent counterparty but is not the same address. Attackers use this to redirect funds.`,
      recommendedAction: "Verify the full address before sending.",
    });
  }

  const cluster = targets.find((t) => t.maliciousCluster && !t.drainer);
  if (cluster) {
    firedRules.push({
      id: "R-WAL-4",
      title: "Malicious wallet cluster",
      severity: "high",
      explanation: `Recipient ${shortAddr(cluster.address, 6, 6)} was funded by or is clustered with a known malicious wallet.`,
      recommendedAction: "Treat this destination as untrusted.",
    });
  }

  const newBig = targets.find(
    (t) =>
      !t.isSelf &&
      !t.drainer &&
      t.ageDays !== null &&
      t.ageDays !== undefined &&
      t.ageDays < NEW_WALLET_MAX_DAYS &&
      (t.incomingUsd ?? 0) >= NEW_WALLET_VALUE_USD
  );
  if (newBig) {
    firedRules.push({
      id: "R-WAL-2",
      title: "New wallet, large transfer",
      severity: "medium",
      explanation: `${usd(newBig.incomingUsd ?? 0)} is going to a wallet created ${newBig.ageDays} days ago with little history.`,
      recommendedAction: "Confirm you know this recipient.",
    });
  }

  if (domain.onPhishingList) {
    firedRules.push({
      id: "R-007",
      title: "Phishing domain",
      severity: "high",
      explanation: `${domain.domain} is on a known phishing blocklist.`,
      recommendedAction: "Close this site immediately.",
    });
  } else if (domain.lookalikeOf) {
    firedRules.push({
      id: "R-007",
      title: "Lookalike domain",
      severity: "high",
      explanation: `${domain.domain} impersonates ${domain.lookalikeOf} and was registered ${domain.ageDays} days ago.`,
      recommendedAction: "Close this site.",
    });
  }

  return { findings, firedRules };
}

/* ================================================================== *
 * Token Scanner — authority & delegate abuse check.
 * PRD section 5.5 (TOK-2/3/4/7/9, R-002, R-003, R-005, R-006).
 * ================================================================== */

const extLabel: Record<string, string> = {
  "permanent-delegate": "permanent delegate",
  "transfer-hook": "transfer hook",
  "transfer-fee": "high transfer fee",
  "non-transferable": "non-transferable",
  "default-frozen": "default account state frozen",
};

function tokenFindings(t: TokenMeta): ScannerFinding[] {
  const out: ScannerFinding[] = [];

  if (t.delegateApproval) {
    const { amount, knownDelegate, worstCaseUsd } = t.delegateApproval;
    const amt = amount === "unlimited" ? "UNLIMITED" : `${amount} ${t.symbol}`;
    out.push({
      label: `${t.symbol} delegate`,
      value: `${amt} approve to ${knownDelegate ? "known delegate" : "unknown address"}`,
      status: amount === "unlimited" || !knownDelegate ? "bad" : "warn",
    });
    if (worstCaseUsd) {
      out.push({ label: "Worst-case exposure", value: `${usd(worstCaseUsd)} can be drained later`, status: "bad" });
    }
  }

  out.push({
    label: `${t.symbol} freeze authority`,
    value: t.freezeAuthorityActive ? "ACTIVE — accounts can be frozen" : "Inactive",
    status: t.freezeAuthorityActive ? "warn" : "ok",
  });

  out.push({
    label: `${t.symbol} mint authority`,
    value: t.mintAuthorityActive
      ? t.isNft
        ? "Active (expected for NFT series)"
        : "ACTIVE — supply can be inflated"
      : "Revoked",
    status: t.mintAuthorityActive && !t.isNft ? "warn" : t.mintAuthorityActive ? "info" : "ok",
  });

  const exts = t.token2022Extensions ?? [];
  if (exts.length > 0) {
    out.push({
      label: `${t.symbol} Token-2022`,
      value: exts.map((e) => extLabel[e]).join(", "),
      status: exts.includes("permanent-delegate") || exts.includes("transfer-hook") ? "bad" : "warn",
    });
  } else {
    out.push({ label: `${t.symbol} Token-2022 extensions`, value: "None", status: "ok" });
  }

  if (t.impersonates) {
    out.push({ label: `${t.symbol} impersonation`, value: `Mimics ${t.impersonates} with a different mint`, status: "bad" });
  } else if (t.verifiedListed) {
    out.push({ label: `${t.symbol} listing`, value: "Matches canonical token list", status: "ok" });
  }

  return out;
}

export function evaluateTokenScanner(tokens: TokenMeta[]): CheckResult {
  const findings: ScannerFinding[] = tokens.flatMap(tokenFindings);
  const firedRules: FiredRule[] = [];

  const unlimited = tokens.find(
    (t) => t.delegateApproval && (t.delegateApproval.amount === "unlimited" || !t.delegateApproval.knownDelegate)
  );
  if (unlimited && unlimited.delegateApproval) {
    const da = unlimited.delegateApproval;
    firedRules.push({
      id: "R-003",
      title: "Unlimited delegate approval",
      severity: "high",
      explanation: `An Approve instruction grants ${da.amount === "unlimited" ? "an unlimited" : `a ${da.amount} ${unlimited.symbol}`} spending delegate on your ${unlimited.symbol} to ${da.knownDelegate ? "a delegate" : "an unknown address"} (${shortAddr(da.to, 6, 6)}).${da.worstCaseUsd ? ` Worst case, ${usd(da.worstCaseUsd)} can be moved without another signature.` : ""}`,
      recommendedAction: "Never grant unlimited delegates to unknown sites.",
    });
  }

  const freeze = tokens.find((t) => t.freezeAuthorityActive);
  if (freeze) {
    firedRules.push({
      id: "R-005",
      title: "Active freeze authority",
      severity: "medium",
      explanation: `${freeze.symbol} has an active freeze authority. The issuer can freeze your account and stop you transferring or selling.`,
      recommendedAction: "Only proceed if you trust this project.",
    });
  }

  const permDelegate = tokens.find((t) => (t.token2022Extensions ?? []).includes("permanent-delegate"));
  if (permDelegate) {
    firedRules.push({
      id: "R-006",
      title: "Token-2022 permanent delegate",
      severity: "high",
      explanation: `${permDelegate.symbol} uses the Token-2022 permanent-delegate extension, letting the issuer move or burn your tokens at any time.`,
      recommendedAction: "Avoid tokens with a permanent delegate.",
    });
  }
  const transferHook = tokens.find((t) => (t.token2022Extensions ?? []).includes("transfer-hook"));
  if (transferHook) {
    firedRules.push({
      id: "R-TOK-4",
      title: "Token-2022 transfer hook",
      severity: "medium",
      explanation: `${transferHook.symbol} runs custom code on every transfer via a transfer hook, which can block or redirect transfers.`,
      recommendedAction: "Understand the hook before holding this token.",
    });
  }

  const inflatable = tokens.find((t) => t.mintAuthorityActive && !t.isNft && !t.verifiedListed);
  if (inflatable) {
    firedRules.push({
      id: "R-002",
      title: "Active mint authority",
      severity: "medium",
      explanation: `${inflatable.symbol} still has an active mint authority, so its supply can be inflated at any time — a common rug-pull setup.`,
      recommendedAction: "Be cautious holding tokens with an active mint authority.",
    });
  }

  const impostor = tokens.find((t) => t.impersonates);
  if (impostor) {
    firedRules.push({
      id: "R-TOK-7",
      title: "Impersonation token",
      severity: "high",
      explanation: `${impostor.symbol} shares the name/symbol of ${impostor.impersonates} but has a different mint. It is not the real token.`,
      recommendedAction: "Do not treat this as the genuine token.",
    });
  }

  return { findings, firedRules };
}

/* ------------------------------------------------------------------ *
 * Assembly — run all three scanners, build panels, merge rules.
 * ------------------------------------------------------------------ */

export interface AssembledScan {
  scanners: ScannerPanel[];
  firedRules: FiredRule[];
  programCheck: CheckResult;
  walletCheck: CheckResult;
  tokenCheck: CheckResult;
}

export function assembleScan(scenario: TxScenario): AssembledScan {
  const programCheck = evaluateProgramScanner(scenario.programs);
  const walletCheck = evaluateWalletScanner(scenario.walletTargets, scenario.domain);
  const tokenCheck = evaluateTokenScanner(scenario.tokens);

  const livePanels: ScannerPanel[] = [
    { key: "program", title: "Program Scanner", findings: programCheck.findings },
    { key: "wallet", title: "Wallet Scanner", findings: walletCheck.findings },
    { key: "token", title: "Token Scanner", findings: tokenCheck.findings },
  ];

  const staticPanels = scenario.scanners.filter(
    (p) => p.key !== "program" && p.key !== "wallet" && p.key !== "token"
  );
  const scanners = [...livePanels, ...staticPanels];

  const merged = dedupeRules([
    ...scenario.firedRules,
    ...programCheck.firedRules,
    ...walletCheck.firedRules,
    ...tokenCheck.firedRules,
  ]);
  const firedRules = sortRulesBySeverity(merged);

  return { scanners, firedRules, programCheck, walletCheck, tokenCheck };
}
