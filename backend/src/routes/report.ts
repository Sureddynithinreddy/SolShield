import type { FastifyInstance } from "fastify";
import { db, type ReportDoc } from "../db.js";
import { sha256 } from "../hash.js";
import { intel } from "../intel/store.js";
import { promoteToIntel } from "../intel/promote.js";

interface ReportBody {
  kind: "address" | "domain";
  value: string;
  reason: string;
  reporter?: string;
}

/** A report becomes community-confirmed once it reaches this many submissions. */
const CONFIRM_THRESHOLD = 3;

export async function registerReportRoutes(app: FastifyInstance) {
  // Submit a scam report.
  app.post<{ Body: ReportBody }>("/api/report", async (request, reply) => {
    const { kind, value, reason, reporter } = request.body ?? ({} as ReportBody);
    if ((kind !== "address" && kind !== "domain") || !value || typeof value !== "string") {
      return reply.status(400).send({ ok: false, error: "Provide 'kind' (address|domain) and 'value'." });
    }
    if (!db.connected) {
      return reply.status(503).send({ ok: false, error: "Reporting requires the database, which is not configured." });
    }

    const normalized = kind === "domain" ? value.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "") : value.trim();
    const reporterHash = sha256(reporter);

    try {
      // Upsert: increment confirmations for repeated reports of the same value.
      const existing = await db.reports.findOne({ kind, value: normalized });
      let confirmations = 1;
      if (existing) {
        confirmations = existing.confirmations + 1;
        await db.reports.updateOne(
          { kind, value: normalized },
          { $set: { confirmations, reason: reason || existing.reason } }
        );
      } else {
        const doc: ReportDoc = {
          createdAt: new Date(),
          kind,
          value: normalized,
          reason: reason || "",
          reporterHash,
          status: "pending",
          confirmations: 1,
        };
        await db.reports.insertOne(doc);
      }

      // Auto-confirm once the threshold is reached → promote into intel.
      let status: ReportDoc["status"] = "pending";
      if (confirmations >= CONFIRM_THRESHOLD) {
        status = "confirmed";
        await db.reports.updateOne({ kind, value: normalized }, { $set: { status } });
        await promoteToIntel(kind, normalized);
        await intel.load(true); // refresh so the new entry takes effect
      }

      return reply.send({ ok: true, status, confirmations });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ ok: false, error: "Failed to record report." });
    }
  });

  // Admin-confirm a pending report immediately.
  app.post<{ Body: { kind: "address" | "domain"; value: string }; Headers: { "x-admin-key"?: string } }>(
    "/api/report/confirm",
    async (request, reply) => {
      const adminKey = request.headers["x-admin-key"];
      if (!adminKey || adminKey !== (process.env.ADMIN_KEY || "")) {
        return reply.status(401).send({ ok: false, error: "Unauthorized." });
      }
      if (!db.connected) return reply.status(503).send({ ok: false, error: "Database not configured." });
      const { kind, value } = request.body ?? ({} as { kind: "address" | "domain"; value: string });
      await db.reports.updateOne({ kind, value }, { $set: { status: "confirmed" } });
      await promoteToIntel(kind, value);
      await intel.load(true);
      return reply.send({ ok: true, status: "confirmed" });
    }
  );

  // Recent reports (public, read-only).
  app.get("/api/reports", async (_request, reply) => {
    if (!db.connected) return reply.send({ ok: true, available: false, reports: [] });
    const reports = await db.reports.find({}).sort({ confirmations: -1, createdAt: -1 }).limit(50).toArray();
    return reply.send({
      ok: true,
      available: true,
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
}
