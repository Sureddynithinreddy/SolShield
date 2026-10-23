export type Verdict = "safe" | "caution" | "dangerous";

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type Strictness = "relaxed" | "balanced" | "strict";

export interface FiredRule {
  id: string; // e.g. R-001
  title: string;
  severity: Severity;
  explanation: string;
  recommendedAction: string;
  hardBlock?: boolean;
}

export interface BalanceChange {
  symbol: string;
  name: string;
  amount: number; // signed: negative = you send, positive = you receive
  usd?: number;
  mono?: string; // mint/account mono string
}

export interface Permission {
  label: string;
  detail: string;
  severity: Severity;
}

export interface ScannerFinding {
  label: string;
  value: string;
  status: "ok" | "warn" | "bad" | "info";
}

export interface ScannerPanel {
  key: "program" | "wallet" | "token" | "simulator";
  title: string;
  findings: ScannerFinding[];
}

export interface InstructionItem {
  index: number;
  program: string;
  programId: string;
  name: string;
  summary: string;
  flagged?: boolean;
}

/**
 * On-chain-style metadata about a program the Program Scanner evaluates.
 * In production these fields come from the RPC + verified-build registries.
 */
export interface ProgramMeta {
  programId: string;
  name: string;
  /** true for System, SPL Token, ATA, Compute Budget, etc. */
  core: boolean;
  /** on the verified-build / audited allowlist */
  verified: boolean;
  /** how many days ago the program was deployed; null for core programs */
  deployedDaysAgo: number | null;
  upgradeAuthority: "immutable" | "multisig-known" | "single-unknown" | "none";
  /** does this program move the user's funds in this transaction */
  receivesFunds: boolean;
  /** invoked only via CPI from another program */
  viaCpi?: boolean;
}

/** Result of a single security check run by a scanner. */
export interface CheckResult {
  findings: ScannerFinding[];
  firedRules: FiredRule[];
}

/**
 * A destination / counterparty address the Wallet Scanner evaluates.
 * Flags come from threat-intel feeds, blocklists and on-chain history.
 */
export interface WalletScanTarget {
  address: string;
  /** short human label, e.g. "Recipient" or "Your ATA" */
  role: string;
  /** on the confirmed drainer list */
  drainer?: boolean;
  /** number of known thefts linked to this address */
  drainerThefts?: number;
  /** on an OFAC / sanctioned list */
  sanctioned?: boolean;
  /** this address belongs to the user (own wallet / ATA) */
  isSelf?: boolean;
  /** age of the wallet in days; low age + large value is suspicious */
  ageDays?: number | null;
  /** funded by / clustered with a known malicious wallet */
  maliciousCluster?: boolean;
  /** USD value flowing to this address in this transaction */
  incomingUsd?: number;
  /** Address poisoning: destination mimics a recent counterparty but isn't identical. */
  poisoningLookalikeOf?: string;
}

/** The originating dApp domain the Wallet Scanner evaluates. */
export interface DomainMeta {
  domain: string;
  ageDays: number;
  ssl: boolean;
  onPhishingList: boolean;
  /** the known brand this domain impersonates, if any */
  lookalikeOf?: string;
  /** 0-100 reputation score */
  reputation: number;
}

/**
 * A token mint touched by the transaction, evaluated by the Token Scanner.
 * Covers SPL + Token-2022 abuse vectors from PRD section 5.5.
 */
export interface TokenMeta {
  mint: string;
  symbol: string;
  name: string;
  /** mint authority still active (supply can be inflated) */
  mintAuthorityActive: boolean;
  /** freeze authority active (accounts can be frozen) */
  freezeAuthorityActive: boolean;
  /** true if this token is an NFT (mint authority active is expected) */
  isNft?: boolean;
  /** Token-2022 extensions present on the mint */
  token2022Extensions?: Array<
    "permanent-delegate" | "transfer-hook" | "transfer-fee" | "non-transferable" | "default-frozen"
  >;
  /** a delegate approval granted in this tx */
  delegateApproval?: {
    /** "unlimited" or a numeric amount of the token */
    amount: "unlimited" | number;
    /** the delegate address */
    to: string;
    /** whether the delegate is a known/trusted address */
    knownDelegate: boolean;
    /** worst-case USD exposure if the delegate is later exercised */
    worstCaseUsd?: number;
  };
  /** impersonates a known token (same symbol, different mint) */
  impersonates?: string;
  /** matches the canonical verified token list */
  verifiedListed?: boolean;
}

export interface TxScenario {
  id: string;
  dappName: string;
  dappDomain: string;
  dappFavicon: string; // emoji stand-in
  requestType: "signTransaction" | "signAllTransactions" | "signMessage" | "signAndSendTransaction";
  verdict: Verdict;
  score: number; // 0-100
  confidence: "high" | "medium" | "low";
  summary: string;
  balanceChanges: BalanceChange[];
  permissions: Permission[];
  firedRules: FiredRule[];
  scanners: ScannerPanel[];
  instructions: InstructionItem[];
  /** programs invoked by this transaction, evaluated live by the Program Scanner */
  programs: ProgramMeta[];
  /** destination/counterparty addresses, evaluated live by the Wallet Scanner */
  walletTargets: WalletScanTarget[];
  /** the originating dApp domain, evaluated live by the Wallet Scanner */
  domain: DomainMeta;
  /** token mints touched, evaluated live by the Token Scanner */
  tokens: TokenMeta[];
  feeSol: number;
  scanMs: number;
  /** where the scan ran: the backend service or the local fail-safe engine */
  scanSource?: "backend" | "local";
}

export interface HistoryEntry {
  id: string;
  time: string;
  dappName: string;
  dappDomain: string;
  dappFavicon: string;
  action: string;
  verdict: Verdict;
  score: number;
  userAction: "allowed" | "blocked" | "overrode";
  valueUsd: number;
}

export interface ListEntry {
  value: string;
  label: string;
  kind: "domain" | "program" | "address";
  type: "allow" | "block";
}

export interface UserRule {
  id: string;
  text: string;
  enabled: boolean;
  severity: Severity;
}
