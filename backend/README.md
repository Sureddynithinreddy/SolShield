# SolShield Backend

The transaction-scanning service. It decodes a transaction, resolves Address Lookup
Tables, simulates it against Solana RPC (with multi-endpoint failover), pulls live program
and token metadata, enriches counterparties with threat intel, runs the shared scanner
engines, and returns a verdict + risk score + findings.

## Run

```bash
cd backend
npm install
cp .env.example .env   # optional; works with public RPC by default
npm run start          # or: npm run dev  (watch mode)
```

Listens on `http://localhost:8787`.

## Endpoints

| Method | Path                         | Purpose                                             |
| ------ | ---------------------------- | --------------------------------------------------- |
| GET    | `/api/health`                | Service + RPC + intel status                        |
| POST   | `/api/scan`                  | `{ transaction, origin?, signer? }` → full verdict  |
| GET    | `/api/reputation?domain=`    | Domain reputation (phishing + lookalike)            |
| GET    | `/api/address?address=`      | Address intel (drainer / sanctioned / cluster)      |

## Threat intel

Seed lists live in `intel/*.json` (drainers, sanctioned, programs, domains) and are loaded
with an in-memory cache + TTL. In production these would be replaced by live feeds. The
scanner logic itself is shared with the frontend via the `shared/` package, so detection
is identical on both sides.
