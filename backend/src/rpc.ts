import { Connection } from "@solana/web3.js";
import { config } from "./config.js";

/**
 * Multi-RPC with simple round-robin failover. Each call tries the current
 * endpoint; on failure it rotates to the next and retries, so a single
 * rate-limited / down provider doesn't take the service down (PRD SIM-9).
 */
class RpcPool {
  private connections: Connection[];
  private idx = 0;

  constructor(endpoints: string[]) {
    this.connections = endpoints.map(
      (url) => new Connection(url, { commitment: "confirmed" })
    );
  }

  get current(): Connection {
    return this.connections[this.idx];
  }

  get endpoints(): string[] {
    return this.connections.map((c) => c.rpcEndpoint);
  }

  private rotate() {
    this.idx = (this.idx + 1) % this.connections.length;
  }

  /** Run an operation with failover across all endpoints. */
  async withFailover<T>(fn: (conn: Connection) => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < this.connections.length; attempt++) {
      try {
        return await fn(this.current);
      } catch (err) {
        lastErr = err;
        this.rotate();
      }
    }
    throw lastErr;
  }

  /** Health: can at least one endpoint return a slot? */
  async health(): Promise<{ healthy: boolean; endpoint: string | null }> {
    for (let i = 0; i < this.connections.length; i++) {
      const conn = this.connections[(this.idx + i) % this.connections.length];
      try {
        await conn.getSlot();
        return { healthy: true, endpoint: conn.rpcEndpoint };
      } catch {
        /* try next */
      }
    }
    return { healthy: false, endpoint: null };
  }
}

export const rpcPool = new RpcPool(config.rpcEndpoints);
