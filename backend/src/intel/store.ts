import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "../config.js";
import { checkLookalikeDomain } from "@shared/detection";
import type { DomainMeta } from "@shared/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INTEL_DIR = join(__dirname, "..", "..", "intel");

interface DrainerEntry {
  address: string;
  label: string;
  thefts: number;
}

interface IntelData {
  drainers: Map<string, DrainerEntry>;
  clusters: Set<string>;
  sanctioned: Set<string>;
  programsAllow: Map<string, { name: string; verified: boolean }>;
  programsBlock: Map<string, { name: string }>;
  phishingDomains: Set<string>;
  knownDomains: string[];
}

async function readJson<T>(name: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(join(INTEL_DIR, name), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

class IntelStore {
  private data: IntelData = {
    drainers: new Map(),
    clusters: new Set(),
    sanctioned: new Set(),
    programsAllow: new Map(),
    programsBlock: new Map(),
    phishingDomains: new Set(),
    knownDomains: [],
  };
  private loadedAt = 0;

  async load(force = false): Promise<void> {
    if (!force && this.loadedAt && Date.now() - this.loadedAt < config.intelTtlMs) return;

    const [drainers, sanctioned, programs, domains] = await Promise.all([
      readJson<{ addresses: DrainerEntry[]; clusters: string[] }>("drainers.json", {
        addresses: [],
        clusters: [],
      }),
      readJson<{ addresses: string[] }>("sanctioned.json", { addresses: [] }),
      readJson<{
        allow: { programId: string; name: string; verified: boolean }[];
        block: { programId: string; name: string }[];
      }>("programs.json", { allow: [], block: [] }),
      readJson<{ phishing: string[]; known: string[] }>("domains.json", {
        phishing: [],
        known: [],
      }),
    ]);

    this.data = {
      drainers: new Map(drainers.addresses.map((d) => [d.address, d])),
      clusters: new Set(drainers.clusters),
      sanctioned: new Set(sanctioned.addresses),
      programsAllow: new Map(programs.allow.map((p) => [p.programId, { name: p.name, verified: p.verified }])),
      programsBlock: new Map(programs.block.map((p) => [p.programId, { name: p.name }])),
      phishingDomains: new Set(domains.phishing.map((d) => d.toLowerCase())),
      knownDomains: domains.known,
    };
    this.loadedAt = Date.now();
  }

  /* ---- address lookups ---- */
  drainer(address: string): DrainerEntry | undefined {
    return this.data.drainers.get(address);
  }
  isCluster(address: string): boolean {
    return this.data.clusters.has(address);
  }
  isSanctioned(address: string): boolean {
    return this.data.sanctioned.has(address);
  }

  /* ---- program lookups ---- */
  programAllow(id: string) {
    return this.data.programsAllow.get(id);
  }
  programBlock(id: string) {
    return this.data.programsBlock.get(id);
  }

  /* ---- domain reputation ---- */
  evaluateDomain(domain: string): DomainMeta {
    const host = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
    const onPhishingList = this.data.phishingDomains.has(host);
    const look = checkLookalikeDomain(host, this.data.knownDomains);
    const known = this.data.knownDomains.includes(host);

    let reputation = 80;
    if (known) reputation = 98;
    else if (onPhishingList) reputation = 0;
    else if (look.lookalikeOf) reputation = 8;

    return {
      domain: host,
      ageDays: known ? 1460 : onPhishingList || look.lookalikeOf ? 2 : 365,
      ssl: true,
      onPhishingList,
      lookalikeOf: look.lookalikeOf,
      reputation,
    };
  }

  summary() {
    return {
      drainers: this.data.drainers.size,
      clusters: this.data.clusters.size,
      sanctioned: this.data.sanctioned.size,
      programsAllow: this.data.programsAllow.size,
      programsBlock: this.data.programsBlock.size,
      phishingDomains: this.data.phishingDomains.size,
      knownDomains: this.data.knownDomains.length,
      loadedAt: this.loadedAt ? new Date(this.loadedAt).toISOString() : null,
    };
  }
}

export const intel = new IntelStore();
