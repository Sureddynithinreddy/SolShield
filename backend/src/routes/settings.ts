import type { FastifyInstance } from "fastify";
import { db, type SettingsDoc, type UserListEntry, type UserRuleEntry } from "../db.js";
import { sha256 } from "../hash.js";
import { RULE_REGISTRY, RULE_PACK_VERSION } from "@shared/rules";

/**
 * Per-wallet user settings: strictness, allow/block lists and custom rules.
 * Keyed by a hash of the wallet address (never the raw address). Also serves
 * the authoritative built-in rule pack from the shared registry.
 */

interface SettingsBody {
  owner: string; // wallet address (hashed server-side)
  strictness?: SettingsDoc["strictness"];
  lists?: UserListEntry[];
  rules?: UserRuleEntry[];
}

const DEFAULTS: Omit<SettingsDoc, "ownerHash" | "updatedAt"> = {
  strictness: "balanced",
  lists: [],
  rules: [],
};

export async function registerSettingsRoutes(app: FastifyInstance) {
  // The built-in rule pack (static, authoritative) — always available.
  app.get("/api/rules", async () => ({
    ok: true,
    version: RULE_PACK_VERSION,
    rules: RULE_REGISTRY,
  }));

  // Load a wallet's settings. Returns defaults when none saved / no DB.
  app.get<{ Querystring: { owner?: string } }>("/api/settings", async (request, reply) => {
    const owner = request.query.owner;
    if (!owner) return reply.status(400).send({ ok: false, error: "Missing 'owner' query param." });

    if (!db.connected) {
      return reply.send({ ok: true, persisted: false, settings: DEFAULTS });
    }
    const ownerHash = sha256(owner)!;
    const doc = await db.settings.findOne({ ownerHash });
    return reply.send({
      ok: true,
      persisted: true,
      settings: doc
        ? { strictness: doc.strictness, lists: doc.lists, rules: doc.rules }
        : DEFAULTS,
    });
  });

  // Save a wallet's settings (upsert).
  app.put<{ Body: SettingsBody }>("/api/settings", async (request, reply) => {
    const body = request.body ?? ({} as SettingsBody);
    if (!body.owner) return reply.status(400).send({ ok: false, error: "Missing 'owner'." });
    if (!db.connected) {
      return reply.status(503).send({ ok: false, error: "Settings persistence requires the database." });
    }

    const ownerHash = sha256(body.owner)!;
    const update: Omit<SettingsDoc, "ownerHash"> = {
      strictness: body.strictness ?? DEFAULTS.strictness,
      lists: Array.isArray(body.lists) ? body.lists.slice(0, 500) : [],
      rules: Array.isArray(body.rules) ? body.rules.slice(0, 200) : [],
      updatedAt: new Date(),
    };
    await db.settings.updateOne({ ownerHash }, { $set: { ownerHash, ...update } }, { upsert: true });
    return reply.send({ ok: true, persisted: true });
  });
}
