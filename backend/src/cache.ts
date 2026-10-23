/* ------------------------------------------------------------------ *
 * Tiny in-memory LRU + TTL cache. Caches scan results by a key derived
 * from the transaction + origin so repeated scans of the same request
 * are instant and avoid re-hitting the RPC (PRD scalability section).
 * ------------------------------------------------------------------ */

interface Entry<V> {
  value: V;
  expires: number;
}

export class TtlCache<V> {
  private map = new Map<string, Entry<V>>();
  private hits = 0;
  private misses = 0;

  constructor(
    private ttlMs: number,
    private maxEntries = 1000
  ) {}

  get(key: string): V | undefined {
    const e = this.map.get(key);
    if (!e) {
      this.misses++;
      return undefined;
    }
    if (Date.now() > e.expires) {
      this.map.delete(key);
      this.misses++;
      return undefined;
    }
    // Refresh recency (LRU): re-insert to move to the end.
    this.map.delete(key);
    this.map.set(key, e);
    this.hits++;
    return e.value;
  }

  set(key: string, value: V): void {
    if (this.map.size >= this.maxEntries) {
      // Evict the oldest (first) entry.
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
  }

  stats() {
    const total = this.hits + this.misses;
    return {
      size: this.map.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total ? Number((this.hits / total).toFixed(3)) : 0,
    };
  }
}
