import { MongoClient, type Db, type Collection } from "mongodb";
import { config } from "./config.js";

/* ------------------------------------------------------------------ *
 * MongoDB connection.
 *
 * Optional: if MONGODB_URI is unset or the connection fails, the service
 * still runs — persistence-backed features (scan log, analytics, reports,
 * community intel) simply report "not available" instead of crashing.
 * ------------------------------------------------------------------ */

export interface ScanDoc {
  _id?: unknown;
  createdAt: Date;
  origin: string | null;
  signerHash: string | null; // sha-256 hash; never store raw addresses
  verdict: "safe" | "caution" | "dangerous";
  score: number;
  ruleIds: string[];
  hardBlock: boolean;
  outflowUsd: number;
  scanMs: number;
  source: "backend" | "local";
  cacheHit: boolean;
}

export interface ReportDoc {
  _id?: unknown;
  createdAt: Date;
  kind: "address" | "domain";
  value: string;
  reason: string;
  reporterHash: string | null;
  status: "pending" | "confirmed" | "rejected";
  confirmations: number;
}

export interface IntelAddressDoc {
  _id?: unknown;
  address: string;
  category: "drainer" | "sanctioned" | "cluster";
  label: string;
  thefts?: number;
  source: "community" | "feed" | "seed";
  addedAt: Date;
}

export interface IntelDomainDoc {
  _id?: unknown;
  domain: string;
  category: "phishing";
  source: "community" | "feed" | "seed";
  addedAt: Date;
}

class Database {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private status: "disabled" | "connecting" | "connected" | "error" = "disabled";
  private lastError: string | null = null;

  async connect(): Promise<void> {
    if (!config.mongoUri) {
      this.status = "disabled";
      return;
    }
    this.status = "connecting";
    try {
      this.client = new MongoClient(config.mongoUri, {
        serverSelectionTimeoutMS: 5000,
      });
      await this.client.connect();
      this.db = this.client.db(config.mongoDb);
      await this.ensureIndexes();
      this.status = "connected";
    } catch (err) {
      this.status = "error";
      this.lastError = err instanceof Error ? err.message : String(err);
      this.client = null;
      this.db = null;
    }
  }

  private async ensureIndexes() {
    if (!this.db) return;
    await Promise.all([
      this.scans.createIndex({ createdAt: -1 }),
      this.reports.createIndex({ kind: 1, value: 1 }),
      this.intelAddresses.createIndex({ address: 1 }, { unique: true }),
      this.intelDomains.createIndex({ domain: 1 }, { unique: true }),
    ]).catch(() => {
      /* index creation is best-effort */
    });
  }

  get connected(): boolean {
    return this.status === "connected" && this.db != null;
  }

  info() {
    return { status: this.status, db: config.mongoDb, error: this.lastError };
  }

  private coll<T extends import("mongodb").Document>(name: string): Collection<T> {
    if (!this.db) throw new Error("Database not connected");
    return this.db.collection<T>(name);
  }

  get scans() {
    return this.coll<ScanDoc>("scans");
  }
  get reports() {
    return this.coll<ReportDoc>("reports");
  }
  get intelAddresses() {
    return this.coll<IntelAddressDoc>("intel_addresses");
  }
  get intelDomains() {
    return this.coll<IntelDomainDoc>("intel_domains");
  }

  async close() {
    await this.client?.close().catch(() => {});
  }
}

export const db = new Database();
