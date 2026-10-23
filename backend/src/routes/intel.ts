import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { intel } from "../intel/store.js";
import { ingestIntelFeeds } from "../intel/ingest.js";

export async function registerIntelRoutes(app: FastifyInstance) {
  // Current intel summary (public, read-only).
  app.get("/api/intel", async () => {
    await intel.load();
    return { ok: true, ...intel.summary(), feeds: config.intelFeeds.length };
  });

  // Manually trigger a feed ingestion (admin-gated).
  app.post<{ Headers: { "x-admin-key"?: string } }>("/api/intel/refresh", async (request, reply) => {
    const adminKey = request.headers["x-admin-key"];
    if (!config.adminKey || adminKey !== config.adminKey) {
      return reply.status(401).send({ ok: false, error: "Unauthorized." });
    }
    const result = await ingestIntelFeeds();
    return reply.send({ ok: true, ...result });
  });
}
