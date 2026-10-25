import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { intel } from "../intel/store.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({ logger: false });
  await intel.load();
});

afterAll(async () => {
  await app.close();
});

describe("GET /api/health", () => {
  it("returns service status and intel summary", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.service).toBe("solshield-backend");
    expect(body.intel.phishingDomains).toBeGreaterThan(0);
    expect(body.db.status).toBe("disabled"); // no MONGODB_URI in tests
  });
});

describe("GET /api/reputation", () => {
  it("flags a known phishing domain as dangerous", async () => {
    const res = await app.inject({ method: "GET", url: "/api/reputation?domain=solana-airdrop-claim.net" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.verdict).toBe("dangerous");
    expect(body.onPhishingList).toBe(true);
  });

  it("flags a lookalike domain", async () => {
    const res = await app.inject({ method: "GET", url: "/api/reputation?domain=so1ana.com" });
    expect(res.json().lookalikeOf).toBe("solana.com");
  });

  it("400s without a domain", async () => {
    const res = await app.inject({ method: "GET", url: "/api/reputation" });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/address", () => {
  it("flags a seeded drainer address", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/address?address=7xKqFv2dra1nerWa11etZzZ9kQ2vB8hUeppppppppp9Fv2",
    });
    expect(res.json().drainer).toBe(true);
    expect(res.json().drainerThefts).toBe(240);
  });
});

describe("POST /api/scan validation", () => {
  it("400s when no transaction is provided", async () => {
    const res = await app.inject({ method: "POST", url: "/api/scan", payload: {} });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /api/report without DB", () => {
  it("503s because persistence is disabled in tests", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/report",
      payload: { kind: "domain", value: "evil.test", reason: "scam" },
    });
    expect(res.statusCode).toBe(503);
  });
});

describe("GET /api/intel", () => {
  it("returns the intel summary", async () => {
    const res = await app.inject({ method: "GET", url: "/api/intel" });
    expect(res.statusCode).toBe(200);
    expect(res.json().knownDomains).toBeGreaterThan(0);
  });
});

describe("POST /api/intel/refresh auth", () => {
  it("401s without the admin key", async () => {
    const res = await app.inject({ method: "POST", url: "/api/intel/refresh", payload: {} });
    expect(res.statusCode).toBe(401);
  });
});

describe("resolveDeployedDaysAgo", () => {
  it("computes days-ago from a block time", async () => {
    const { resolveDeployedDaysAgo } = await import("../chain.js");
    // Fake connection: block time = 10 days ago.
    const tenDaysAgo = Math.floor(Date.now() / 1000) - 10 * 86400;
    const conn = { getBlockTime: async () => tenDaysAgo } as unknown as import("@solana/web3.js").Connection;
    expect(await resolveDeployedDaysAgo(conn, 123)).toBe(10);
  });

  it("returns null for a missing slot", async () => {
    const { resolveDeployedDaysAgo } = await import("../chain.js");
    const conn = { getBlockTime: async () => null } as unknown as import("@solana/web3.js").Connection;
    expect(await resolveDeployedDaysAgo(conn, null)).toBeNull();
    expect(await resolveDeployedDaysAgo(conn, 5)).toBeNull();
  });
});
