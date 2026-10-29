import type { Severity } from "./types";

/**
 * The built-in rule registry — the authoritative catalog of every detection
 * rule the scanners can fire. This is the single source of truth shared by the
 * backend, the frontend (Settings "built-in rule pack") and the extension.
 *
 * Each entry mirrors a rule produced by the scanner engines in scanners.ts /
 * detection.ts, so the catalog never drifts from what actually fires.
 */
export interface RuleDef {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  /** which scanner produces it */
  source: "program" | "wallet" | "token" | "simulator";
  hardBlock?: boolean;
}

export const RULE_REGISTRY: RuleDef[] = [
  { id: "R-001", title: "Drainer destination", description: "Recipient is on the confirmed drainer list.", severity: "critical", source: "wallet", hardBlock: true },
  { id: "R-002", title: "Wallet authority takeover", description: "Simulation shows your token-account owner reassigned to another address.", severity: "critical", source: "simulator", hardBlock: true },
  { id: "R-003", title: "Unlimited delegate approval", description: "An Approve grants an unlimited or unknown spending delegate on your tokens.", severity: "high", source: "token" },
  { id: "R-004", title: "Brand-new program", description: "A fund-receiving program was deployed recently (under 72h) or is unverified.", severity: "high", source: "program" },
  { id: "R-005", title: "Active freeze authority", description: "A token you receive has an active freeze authority (accounts can be frozen).", severity: "medium", source: "token" },
  { id: "R-006", title: "Token-2022 permanent delegate", description: "A mint uses the permanent-delegate extension, letting the issuer move your tokens.", severity: "high", source: "token" },
  { id: "R-007", title: "Lookalike / phishing domain", description: "The dApp domain is on a phishing list or impersonates a known brand.", severity: "high", source: "wallet" },
  { id: "R-008", title: "Address poisoning", description: "A destination mimics a recent counterparty's first/last characters but isn't identical.", severity: "high", source: "wallet" },
  { id: "R-009", title: "Durable nonce", description: "The transaction uses a durable nonce — it can be signed now and submitted later.", severity: "medium", source: "simulator" },
  { id: "R-010", title: "Large outflow", description: "Net outflow exceeds the configured threshold.", severity: "medium", source: "simulator" },
  { id: "R-WAL-1", title: "Sanctioned address", description: "A counterparty appears on a sanctioned-address list.", severity: "critical", source: "wallet", hardBlock: true },
  { id: "R-WAL-2", title: "New wallet, large transfer", description: "A large transfer is going to a brand-new wallet with little history.", severity: "medium", source: "wallet" },
  { id: "R-WAL-4", title: "Malicious wallet cluster", description: "A counterparty is funded by or clustered with a known malicious wallet.", severity: "high", source: "wallet" },
  { id: "R-PRG-3", title: "Single-key upgrade authority", description: "A program can be upgraded at any time by a single unknown key.", severity: "medium", source: "program" },
  { id: "R-PRG-7", title: "Unverified CPI call", description: "An unverified program is invoked via cross-program invocation.", severity: "high", source: "program" },
  { id: "R-TOK-4", title: "Token-2022 transfer hook", description: "A token runs custom code on every transfer via a transfer hook.", severity: "medium", source: "token" },
  { id: "R-TOK-7", title: "Impersonation token", description: "A token shares a known token's name/symbol but has a different mint.", severity: "high", source: "token" },
  { id: "R-SIM-1", title: "Simulation failed", description: "The transaction failed to simulate; it may revert or behave evasively.", severity: "medium", source: "simulator" },
  { id: "R-SIM-3", title: "Close authority granted", description: "A close authority on your token account is being set to another address.", severity: "high", source: "simulator" },
];

/** Current signed rule-pack version. */
export const RULE_PACK_VERSION = "1.0.0";
