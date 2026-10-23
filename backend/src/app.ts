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

  return app;
}
