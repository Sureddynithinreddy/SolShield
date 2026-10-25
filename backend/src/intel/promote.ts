import { db } from "../db.js";

/** Promote a confirmed report into the appropriate intel collection. */
export async function promoteToIntel(kind: "address" | "domain", value: string): Promise<void> {
  if (!db.connected) return;
  if (kind === "address") {
    await db.intelAddresses.updateOne(
      { address: value },
      {
        $setOnInsert: {
          address: value,
          category: "drainer",
          label: "Community-reported",
          source: "community",
          addedAt: new Date(),
        },
      },
      { upsert: true }
    );
  } else {
    await db.intelDomains.updateOne(
      { domain: value },
      {
        $setOnInsert: {
          domain: value,
          category: "phishing",
          source: "community",
          addedAt: new Date(),
        },
      },
      { upsert: true }
    );
  }
}
