import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";
import { db } from "../db.js";
import { intel } from "../intel/store.js";
import { promoteToIntel } from "../intel/promote.js";

/** Rejects the request unless a valid x-admin-key is present. */
function requireAdmin(request: FastifyRequest, reply: FastifyReply): boolean {
  const key = request.headers["x-admin-key"];
  if (!config.adminKey || key !== config.adminKey) {
    reply.status(401).send({ ok: false, error: "Unauthorized." });
    return false;
  }
  return true;
}

export async function registerAdminRoutes(app: FastifyInstance) {
  // List reports (optionally filter by status), most actionable first.
  app.get<{ Querystring: { status?: string } }>("/api/admin/reports", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    if (!db.connected) return reply.send({ ok: true, available: false, reports: [] });

    const valid = ["pending", "confirmed", "rejected"] as const;
    const s = valid.find((v) => v === request.query.status);
    const filter = s ? { status: s } : {};
    const reports = await db.reports
      .find(filter)
      .sort({ status: 1, confirmations: -1, createdAt: -1 })
      .limit(200)
      .toArray();

    const counts = {
      pending: await db.reports.countDocuments({ status: "pending" }),
      confirmed: await db.reports.countDocuments({ status: "confirmed" }),
      rejected: await db.reports.countDocuments({ status: "rejected" }),
    };

    return reply.send({
      ok: true,
      available: true,
      counts,
      reports: reports.map((r) => ({
        kind: r.kind,
        value: r.value,
        reason: r.reason,
        status: r.status,
        confirmations: r.confirmations,
        createdAt: r.createdAt,
      })),
    });
  });

  // Confirm or reject a report. Confirming promotes it into the intel lists.
  app.post<{ Body: { kind: "address" | "domain"; value: string; action: "confirm" | "reject" } }>(
    "/api/admin/reports/action",
    async (request, reply) => {
      if (!requireAdmin(request, reply)) return;
      if (!db.connected) return reply.status(503).send({ ok: false, error: "Database not configured." });

      const { kind, value, action } = request.body ?? ({} as never);
      if ((kind !== "address" && kind !== "domain") || !value || (action !== "confirm" && action !== "reject")) {
        return reply.status(400).send({ ok: false, error: "Provide kind, value and action (confirm|reject)." });
      }

      const status = action === "confirm" ? "confirmed" : "rejected";
      await db.reports.updateOne({ kind, value }, { $set: { status } });

      if (action === "confirm") {
        await promoteToIntel(kind, value);
        await intel.load(true);
      }
      return reply.send({ ok: true, status });
    }
  );

  // Admin overview: intel summary + report counts + cache (handy dashboard header).
  app.get("/api/admin/overview", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    await intel.load();
    const reportCounts = db.connected
      ? {
          pending: await db.reports.countDocuments({ status: "pending" }),
          confirmed: await db.reports.countDocuments({ status: "confirmed" }),
          rejected: await db.reports.countDocuments({ status: "rejected" }),
        }
      : null;
    return reply.send({ ok: true, intel: intel.summary(), db: db.info(), reportCounts });
  });
}
