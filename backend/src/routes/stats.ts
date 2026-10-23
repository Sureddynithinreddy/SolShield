import type { FastifyInstance } from "fastify";
import { db } from "../db.js";

/** Human labels for the rule ids that drive the threat breakdown. */
const RULE_LABEL: Record<string, string> = {
  "R-001": "Wallet drainer",
  "R-002": "Authority takeover",
  "R-003": "Unlimited delegate",
  "R-004": "Brand-new program",
  "R-005": "Active freeze authority",
  "R-006": "Token-2022 permanent delegate",
  "R-007": "Lookalike / phishing domain",
  "R-008": "Address poisoning",
  "R-009": "Durable nonce",
  "R-010": "Large outflow",
  "R-WAL-1": "Sanctioned address",
  "R-WAL-4": "Malicious cluster",
  "R-TOK-7": "Impersonation token",
};
const THREAT_COLORS = ["#f43f5e", "#fb923c", "#fbbf24", "#a78bfa", "#22d3ee", "#34d399"];

export async function registerStatsRoutes(app: FastifyInstance) {
  app.get("/api/stats", async (_request, reply) => {
    if (!db.connected) {
      return reply.send({ ok: true, available: false, reason: "persistence disabled" });
    }

    const now = Date.now();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const start14 = new Date(now - 14 * 24 * 60 * 60 * 1000);

    try {
      const [totals, blockedTotal, protectedAgg, trendAgg, threatAgg, todayCount] = await Promise.all([
        db.scans.estimatedDocumentCount(),
        db.scans.countDocuments({ verdict: "dangerous" }),
        db.scans
          .aggregate([
            { $match: { verdict: "dangerous" } },
            { $group: { _id: null, usd: { $sum: "$outflowUsd" } } },
          ])
          .toArray(),
        db.scans
          .aggregate([
            { $match: { createdAt: { $gte: start14 } } },
            {
              $group: {
                _id: {
                  d: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                  v: "$verdict",
                },
                n: { $sum: 1 },
              },
            },
          ])
          .toArray(),
        db.scans
          .aggregate([
            { $unwind: "$ruleIds" },
            { $group: { _id: "$ruleIds", n: { $sum: 1 } } },
            { $sort: { n: -1 } },
            { $limit: 6 },
          ])
          .toArray(),
        db.scans.countDocuments({ createdAt: { $gte: dayAgo } }),
      ]);

      // 14-day trend: build a dense array of {d, safe, caution, dangerous}.
      const trendMap = new Map<string, { safe: number; caution: number; dangerous: number }>();
      for (const row of trendAgg as { _id: { d: string; v: string }; n: number }[]) {
        const e = trendMap.get(row._id.d) ?? { safe: 0, caution: 0, dangerous: 0 };
        (e as Record<string, number>)[row._id.v] = row.n;
        trendMap.set(row._id.d, e);
      }
      const trend: { d: string; safe: number; caution: number; dangerous: number }[] = [];
      for (let i = 13; i >= 0; i--) {
        const date = new Date(now - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const e = trendMap.get(date) ?? { safe: 0, caution: 0, dangerous: 0 };
        trend.push({ d: date.slice(5), ...e });
      }

      const threatBreakdown = (threatAgg as { _id: string; n: number }[]).map((r, i) => ({
        label: RULE_LABEL[r._id] ?? r._id,
        count: r.n,
        color: THREAT_COLORS[i % THREAT_COLORS.length],
      }));

      return reply.send({
        ok: true,
        available: true,
        scansTotal: totals,
        scansToday: todayCount,
        blocked: blockedTotal,
        valueProtectedUsd: Math.round((protectedAgg[0]?.usd as number) ?? 0),
        threatBreakdown,
        trend,
      });
    } catch (err) {
      _request.log.error(err);
      return reply.status(500).send({ ok: false, error: "Failed to compute stats." });
    }
  });
}
