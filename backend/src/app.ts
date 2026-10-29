import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { rpcPool } from "./rpc.js";
import { registerScanRoutes, scanCacheStats } from "./routes/scan.js";
import { registerReputationRoutes } from "./routes/reputation.js";
import { registerStatsRoutes } from "./routes/stats.js";
import { registerReportRoutes } from "./routes/report.js";
import { registerIntelRoutes } from "./routes/intel.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { intel } from "./intel/store.js";
import { db } from "./db.js";

/** Builds the Fastify app with all routes. Does not listen — callers decide. */
export async function buildApp(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger === false
      ? false
      : {
          level: process.env.LOG_LEVEL || "info",
          transport: process.env.NODE_ENV === "production" ? undefined : { target: "pino-pretty" },
        },
  });

  await app.register(cors, {
    origin: config.corsOrigins.includes("*") ? true : config.corsOrigins,
    methods: ["GET", "POST", "OPTIONS"],
  });

  await app.register(rateLimit, {
    max: config.rateMax,
    timeWindow: config.rateWindowMs,
    allowList: (req) => !req.url.startsWith("/api/scan") && !req.url.startsWith("/api/report"),
  });

  // Optional API-key gate on /api/scan. If API_KEYS is unset the API is open
  // (so the demo frontend works out of the box); if set, a valid x-api-key
  // header is required — the basis for the metered public API / SDK.
  if (config.apiKeys.length > 0) {
    app.addHook("preHandler", async (request, reply) => {
      if (!request.url.startsWith("/api/scan")) return;
      const key = request.headers["x-api-key"];
      if (typeof key !== "string" || !config.apiKeys.includes(key)) {
        return reply.status(401).send({ ok: false, error: "Invalid or missing API key (x-api-key)." });
      }
    });
  }

  // Self-describing API catalog (lightweight OpenAPI-ish).
  app.get("/api", async () => ({
    service: "solshield-api",
    version: "1.0.0",
    authRequired: config.apiKeys.length > 0,
    endpoints: [
      { method: "GET", path: "/api/health", desc: "Service, RPC, DB, intel and cache status." },
      { method: "POST", path: "/api/scan", desc: "Scan a transaction.", body: { transaction: "base64 (required)", origin: "string?", signer: "string?" }, auth: config.apiKeys.length > 0 },
      { method: "GET", path: "/api/reputation", desc: "Domain reputation.", query: { domain: "string (required)" } },
      { method: "GET", path: "/api/address", desc: "Address threat intel.", query: { address: "string (required)" } },
      { method: "GET", path: "/api/stats", desc: "Fleet analytics (needs DB)." },
      { method: "GET", path: "/api/intel", desc: "Threat-intel summary." },
      { method: "POST", path: "/api/report", desc: "Report a scam.", body: { kind: "address|domain", value: "string", reason: "string?" } },
      { method: "GET", path: "/api/reports", desc: "Recent community reports." },
    ],
  }));

  app.get("/api/health", async () => {
    const rpc = await rpcPool.health();
    return {
      status: rpc.healthy ? "ok" : "degraded",
      service: "solshield-backend",
      version: "1.0.0",
      rpc: { healthy: rpc.healthy, endpoint: rpc.endpoint, pool: rpcPool.endpoints.length },
      db: db.info(),
      intel: intel.summary(),
      cache: scanCacheStats(),
      time: new Date().toISOString(),
    };
  });

  await registerScanRoutes(app);
  await registerReputationRoutes(app);
  await registerStatsRoutes(app);
  await registerReportRoutes(app);
  await registerIntelRoutes(app);
  await registerAdminRoutes(app);
  await registerSettingsRoutes(app);

  return app;
}
