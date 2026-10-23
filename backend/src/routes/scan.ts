import type { FastifyInstance } from "fastify";
import { rpcPool } from "../rpc.js";
import { intel } from "../intel/store.js";
import { analyze, type ScanRequest, type ScanResponse } from "../analyze.js";
import { recordScan } from "../scanlog.js";
import { TtlCache } from "../cache.js";
import { config } from "../config.js";
import { sha256 } from "../hash.js";

const scanCache = new TtlCache<ScanResponse>(config.scanCacheTtlMs, 2000);

export function scanCacheStats() {
  return scanCache.stats();
}

export async function registerScanRoutes(app: FastifyInstance) {
  app.post<{ Body: ScanRequest }>("/api/scan", async (request, reply) => {
    const body = request.body ?? ({} as ScanRequest);
    if (!body.transaction || typeof body.transaction !== "string") {
      return reply.status(400).send({ ok: false, error: "Missing 'transaction' (base64 string)." });
    }

    // Cache key: the tx bytes + origin + signer determine the outcome.
    const cacheKey = `${sha256(body.transaction)}|${body.origin ?? ""}|${body.signer ?? ""}`;
    const cached = scanCache.get(cacheKey);
    if (cached?.scenario) {
      const hit: ScanResponse = {
        ...cached,
        scenario: { ...cached.scenario, scanSource: cached.scenario.scanSource },
      };
      // Mark as a cache hit in the log (don't double-count the scanMs).
      void recordScan(hit.scenario!, { origin: body.origin, signer: body.signer, cacheHit: true });
      return reply.send({ ...hit, cached: true });
    }

    await intel.load(); // refresh if TTL elapsed
    const started = Date.now();
    try {
      const result = await rpcPool.withFailover((conn) => analyze(conn, body));
      if (result.ok && result.scenario) {
        result.scenario.scanMs = Date.now() - started;
        scanCache.set(cacheKey, result);
        void recordScan(result.scenario, { origin: body.origin, signer: body.signer });
      }
      return reply.send({ ...result, cached: false });
    } catch (err) {
      request.log.error(err);
      return reply.status(502).send({
        ok: false,
        error: "Scan failed — all RPC endpoints are unreachable.",
      });
    }
  });
}
