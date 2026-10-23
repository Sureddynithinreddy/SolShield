/**
 * @solshield/sdk — a tiny, dependency-free client for the SolShield API.
 *
 * ```ts
 * import { SolShieldClient } from "@solshield/sdk";
 * const sol = new SolShieldClient({ baseUrl: "https://api.solshield.example", apiKey: "..." });
 * const { verdict, score } = (await sol.scan({ transaction: base64Tx })).scenario!;
 * ```
 */

export type Verdict = "safe" | "caution" | "dangerous";

export interface ScanInput {
  /** base64-encoded unsigned transaction */
  transaction: string;
  /** originating dApp domain */
  origin?: string;
  /** connected wallet pubkey */
  signer?: string;
}

export interface FiredRule {
  id: string;
  title: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  explanation: string;
  recommendedAction: string;
  hardBlock?: boolean;
}

export interface ScanScenario {
  verdict: Verdict;
  score: number;
  summary: string;
  firedRules: FiredRule[];
  scanMs: number;
  scanSource?: "backend" | "local";
  [key: string]: unknown;
}

export interface ScanResult {
  ok: boolean;
  error?: string;
  cached?: boolean;
  scenario?: ScanScenario;
}

export interface ReputationResult {
  ok: boolean;
  domain: string;
  verdict: "trusted" | "unknown" | "dangerous";
  reputation: number;
  onPhishingList: boolean;
  lookalikeOf?: string;
}

export interface AddressResult {
  ok: boolean;
  address: string;
  drainer: boolean;
  drainerThefts: number | null;
  sanctioned: boolean;
  maliciousCluster: boolean;
}

export interface ClientOptions {
  baseUrl: string;
  apiKey?: string;
  /** custom fetch (e.g. for Node < 18 or testing) */
  fetch?: typeof fetch;
}

export class SolShieldError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "SolShieldError";
  }
}

export class SolShieldClient {
  private baseUrl: string;
  private apiKey?: string;
  private fetchImpl: typeof fetch;

  constructor(opts: ClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    if (!this.fetchImpl) {
      throw new SolShieldError("No fetch implementation available; pass one via options.");
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.apiKey) headers["x-api-key"] = this.apiKey;
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...headers, ...(init?.headers as Record<string, string>) },
    });
    const json = (await res.json()) as T & { ok?: boolean; error?: string };
    if (!res.ok || json.ok === false) {
      throw new SolShieldError(json.error ?? `Request failed (${res.status})`, res.status);
    }
    return json;
  }

  /** Scan a transaction and get a verdict. */
  scan(input: ScanInput): Promise<ScanResult> {
    return this.request<ScanResult>("/api/scan", { method: "POST", body: JSON.stringify(input) });
  }

  /** Check a dApp domain's reputation. */
  reputation(domain: string): Promise<ReputationResult> {
    return this.request<ReputationResult>(`/api/reputation?domain=${encodeURIComponent(domain)}`);
  }

  /** Look up threat intel for an address. */
  address(address: string): Promise<AddressResult> {
    return this.request<AddressResult>(`/api/address?address=${encodeURIComponent(address)}`);
  }

  /** Report a scam address or domain. */
  report(input: { kind: "address" | "domain"; value: string; reason?: string }): Promise<{
    ok: boolean;
    status: string;
    confirmations: number;
  }> {
    return this.request("/api/report", { method: "POST", body: JSON.stringify(input) });
  }

  /** Service health. */
  health(): Promise<Record<string, unknown>> {
    return this.request("/api/health");
  }
}
