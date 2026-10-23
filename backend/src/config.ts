import { clusterApiUrl } from "@solana/web3.js";

/** Comma-separated RPC endpoints for failover; falls back to public mainnet. */
function rpcEndpoints(): string[] {
  const env = process.env.SOLANA_RPC_URLS || process.env.SOLANA_RPC_URL;
  if (env) {
    return env
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [clusterApiUrl("mainnet-beta")];
}

export const config = {
  port: Number(process.env.PORT || 8787),
  host: process.env.HOST || "0.0.0.0",
  rpcEndpoints: rpcEndpoints(),
  /** comma-separated allowed origins for CORS; "*" allows all */
  corsOrigins: (process.env.CORS_ORIGINS || "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  /** intel cache TTL in ms */
  intelTtlMs: Number(process.env.INTEL_TTL_MS || 5 * 60 * 1000),
};
