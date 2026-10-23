import type { FastifyInstance } from "fastify";
import { intel } from "../intel/store.js";

export async function registerReputationRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { domain?: string } }>("/api/reputation", async (request, reply) => {
    const domain = request.query.domain;
    if (!domain) {
      return reply.status(400).send({ ok: false, error: "Missing 'domain' query param." });
    }
    await intel.load();
    const meta = intel.evaluateDomain(domain);
    const verdict = meta.onPhishingList || meta.lookalikeOf ? "dangerous" : meta.reputation >= 80 ? "trusted" : "unknown";
    return reply.send({ ok: true, verdict, ...meta });
  });

  // Address intel lookup (drainer / sanctioned / cluster).
  app.get<{ Querystring: { address?: string } }>("/api/address", async (request, reply) => {
    const address = request.query.address;
    if (!address) {
      return reply.status(400).send({ ok: false, error: "Missing 'address' query param." });
    }
    await intel.load();
    const drainer = intel.drainer(address);
    return reply.send({
      ok: true,
      address,
      drainer: !!drainer,
      drainerThefts: drainer?.thefts ?? null,
      sanctioned: intel.isSanctioned(address),
      maliciousCluster: intel.isCluster(address),
    });
  });
}
