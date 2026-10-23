# @solshield/sdk

A tiny, dependency-free TypeScript client for the SolShield API. Scan Solana transactions,
check domain reputation and address intel, and report scams from any app, wallet or service.

## Install

This SDK lives in the SolShield monorepo (`packages/sdk`). To use it elsewhere, publish it or
copy `src/index.ts` — it has no runtime dependencies (just the Fetch API).

## Usage

```ts
import { SolShieldClient } from "@solshield/sdk";

const sol = new SolShieldClient({
  baseUrl: "https://api.solshield.example",
  apiKey: "your-key", // omit if the API is open
});

// Scan a transaction before signing
const result = await sol.scan({ transaction: base64UnsignedTx, origin: "jup.ag" });
if (result.scenario?.verdict === "dangerous") {
  console.log("Blocked:", result.scenario.summary);
}

// Check a domain
const rep = await sol.reputation("solana-airdrop-claim.net"); // -> verdict: "dangerous"

// Look up an address
const intel = await sol.address("7xKq…9Fv2"); // -> drainer: true

// Report a scam
await sol.report({ kind: "domain", value: "scam-site.example", reason: "wallet drainer" });
```

## API

| Method                | Returns             |
| --------------------- | ------------------- |
| `scan(input)`         | `ScanResult`        |
| `reputation(domain)`  | `ReputationResult`  |
| `address(address)`    | `AddressResult`     |
| `report(input)`       | `{ ok, status, confirmations }` |
| `health()`            | service status      |

All methods throw `SolShieldError` (with an optional `.status`) on failure.
