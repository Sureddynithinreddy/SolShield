import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { rpcPool } from "./rpc.js";
import { registerScanRoutes } from "./routes/scan.js";
import { registerReputationRoutes } from "./routes/reputation.js";
import { intel } from "./intel/store.js";

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

app.get("/api/health", async () => {
  const rpc = await rpcPool.health();
  return {
    status: rpc.healthy ? "ok" : "degraded",
    service: "solshield-backend",
    version: "1.0.0",
    rpc: { healthy: rpc.healthy, endpoint: rpc.endpoint, pool: rpcPool.endpoints.length },
    intel: intel.summary(),
    time: new Date().toISOString(),
  };
});

await registerScanRoutes(app);
await registerReputationRoutes(app);

try {
  await intel.load();
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`SolShield backend listening on :${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
