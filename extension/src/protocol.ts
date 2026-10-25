import type { Verdict, FiredRule, BalanceChange } from "@shared/types";

/** A scan verdict as returned to the overlay (subset of the backend scenario). */
export interface ScanVerdict {
  verdict: Verdict;
  score: number;
  summary: string;
  firedRules: FiredRule[];
  balanceChanges: BalanceChange[];
  scanSource: "backend" | "local" | "unavailable";
  requestType: string;
  dappDomain: string;
}

/** page (inject) -> content: a signing request to scan + hold. */
export interface ScanRequestMsg {
  source: "solshield-inject";
  type: "scan-request";
  id: string;
  method: "signTransaction" | "signAllTransactions" | "signMessage" | "signAndSendTransaction";
  /** base64 transaction(s) or message text */
  payload: string;
  origin: string;
}

/** content -> page (inject): the user's decision for a held request. */
export interface DecisionMsg {
  source: "solshield-content";
  type: "decision";
  id: string;
  decision: "allow" | "block";
}

/** content -> page (inject): the verdict to render (overlay lives in page DOM). */
export interface VerdictMsg {
  source: "solshield-content";
  type: "verdict";
  id: string;
  verdict: ScanVerdict;
}

export type PageMessage = ScanRequestMsg;
export type ContentMessage = DecisionMsg | VerdictMsg;
