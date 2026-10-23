import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { rpcPool } from "./rpc.js";
import { registerScanRoutes } from "./routes/scan.js";
import { registerReputationRoutes } from "./routes/reputation.js";
import { registerStatsRoutes } from "./routes/stats.js";
import { registerReportRoutes } from "./routes/report.js";
import { registerIntelRoutes } from "./routes/intel.js";
import { intel } from "./intel/store.js";
import { startIntelIngestion } from "./intel/ingest.js";
import { db } from "./db.js";
import { scanCacheStats } from "./routes/scan.js";

const app = Fastify({
  logger: {
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
  // Only limit the write/compute-heavy API routes.
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

try {
  await db.connect();
  if (db.connected) app.log.info("MongoDB connected");
  else if (config.mongoUri) app.log.warn(`MongoDB unavailable (${db.info().error}) — running without persistence`);
  else app.log.info("No MONGODB_URI set — running without persistence");

  await intel.load();
  startIntelIngestion({ info: (m) => app.log.info(m) });
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`SolShield backend listening on :${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
