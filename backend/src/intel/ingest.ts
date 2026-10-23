import { config } from "../config.js";
import { db } from "../db.js";
import { intel } from "./store.js";

/* ------------------------------------------------------------------ *
 * Live threat-intel ingestion.
 *
 * Fetches each configured feed URL (INTEL_FEEDS), expects JSON of shape:
 *   {
 *     addresses?: [{ address, category?: "drainer"|"sanctioned"|"cluster",
 *                    label?, thefts? }],
 *     domains?:   [{ domain } | "domain-string"]
 *   }
 * and upserts entries into the Mongo intel collections, then reloads the
 * in-memory intel store. No-ops gracefully when no feeds or no DB.
 * ------------------------------------------------------------------ */

interface FeedAddress {
  address: string;
  category?: "drainer" | "sanctioned" | "cluster";
  label?: string;
  thefts?: number;
}
interface FeedPayload {
  addresses?: FeedAddress[];
  domains?: Array<string | { domain: string }>;
}

export interface IngestResult {
  feeds: number;
  addressesAdded: number;
  domainsAdded: number;
  errors: string[];
}

async function fetchFeed(url: string): Promise<FeedPayload | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    return (await res.json()) as FeedPayload;
  } catch {
    return null;
  }
}

export async function ingestIntelFeeds(): Promise<IngestResult> {
  const result: IngestResult = { feeds: 0, addressesAdded: 0, domainsAdded: 0, errors: [] };
  if (config.intelFeeds.length === 0) return result;
  if (!db.connected) {
    result.errors.push("database not connected");
    return result;
  }

  for (const url of config.intelFeeds) {
    const payload = await fetchFeed(url);
    if (!payload) {
      result.errors.push(`feed unreachable: ${url}`);
      continue;
    }
    result.feeds++;

    for (const a of payload.addresses ?? []) {
      if (!a?.address) continue;
      await db.intelAddresses
        .updateOne(
          { address: a.address },
          {
            $set: {
              address: a.address,
              category: a.category ?? "drainer",
              label: a.label ?? "Feed",
              thefts: a.thefts ?? 0,
              source: "feed",
              addedAt: new Date(),
            },
          },
          { upsert: true }
        )
        .then(() => {
          result.addressesAdded++;
        })
        .catch(() => {});
    }

    for (const d of payload.domains ?? []) {
      const domain = (typeof d === "string" ? d : d?.domain)?.toLowerCase();
      if (!domain) continue;
      await db.intelDomains
        .updateOne(
          { domain },
          { $set: { domain, category: "phishing", source: "feed", addedAt: new Date() } },
          { upsert: true }
        )
        .then(() => {
          result.domainsAdded++;
        })
        .catch(() => {});
    }
  }

  // Refresh the in-memory store so new entries take effect immediately.
  await intel.load(true);
  return result;
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Starts the periodic ingestion loop if feeds are configured. */
export function startIntelIngestion(log?: { info: (m: string) => void }): void {
  if (config.intelFeeds.length === 0 || timer) return;
  const run = () => {
    ingestIntelFeeds()
      .then((r) => log?.info(`Intel ingest: ${r.feeds} feeds, +${r.addressesAdded} addr, +${r.domainsAdded} domains`))
      .catch(() => {});
  };
  run(); // initial run
  timer = setInterval(run, config.intelRefreshMs);
  if (typeof timer.unref === "function") timer.unref();
}
