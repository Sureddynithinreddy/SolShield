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
  /** MongoDB connection; empty => run without persistence */
  mongoUri: process.env.MONGODB_URI || "",
  mongoDb: process.env.MONGODB_DB || "solshield",
  /** optional admin key for protected endpoints (intel refresh, etc.) */
  adminKey: process.env.ADMIN_KEY || "",
  /** scan result cache TTL (ms) */
  scanCacheTtlMs: Number(process.env.SCAN_CACHE_TTL_MS || 60 * 1000),
  /** rate limit: max requests per window per IP */
  rateMax: Number(process.env.RATE_MAX || 120),
  rateWindowMs: Number(process.env.RATE_WINDOW_MS || 60 * 1000),
  /** optional remote intel feed URLs (comma-separated JSON endpoints) */
  intelFeeds: (process.env.INTEL_FEEDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  /** how often to refresh live intel (ms) */
  intelRefreshMs: Number(process.env.INTEL_REFRESH_MS || 10 * 60 * 1000),
};
