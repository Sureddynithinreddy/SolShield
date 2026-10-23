import type { FastifyInstance } from "fastify";
import { rpcPool } from "../rpc.js";
import { intel } from "../intel/store.js";
import { analyze, type ScanRequest } from "../analyze.js";
import { recordScan } from "../scanlog.js";

export async function registerScanRoutes(app: FastifyInstance) {
  app.post<{ Body: ScanRequest }>("/api/scan", async (request, reply) => {
    const body = request.body ?? ({} as ScanRequest);
    if (!body.transaction || typeof body.transaction !== "string") {
      return reply.status(400).send({ ok: false, error: "Missing 'transaction' (base64 string)." });
    }

    await intel.load(); // refresh if TTL elapsed
    const started = Date.now();
    try {
      const result = await rpcPool.withFailover((conn) => analyze(conn, body));
      if (result.scenario) {
        result.scenario.scanMs = Date.now() - started;
        // Fire-and-forget scan log (privacy-preserving, no-op without DB).
        void recordScan(result.scenario, { origin: body.origin, signer: body.signer });
      }
      return reply.send(result);
    } catch (err) {
      request.log.error(err);
      return reply.status(502).send({
        ok: false,
        error: "Scan failed — all RPC endpoints are unreachable.",
      });
    }
  });
}
