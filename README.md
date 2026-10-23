# SolShield

A Web3 security firewall for Solana. SolShield sits between a Solana dApp and your wallet:
it intercepts a signing request, decodes it into plain language, scans the programs, wallets
and tokens involved, simulates the outcome, and gives a clear **Allow / Block** decision with
a 0–100 risk score before anything is signed.

## Monorepo layout

| Package     | What it is                                                                       |
| ----------- | -------------------------------------------------------------------------------- |
| `shared/`   | Pure scanner + detection logic and domain types, shared by frontend and backend  |
| `frontend/` | React + Vite UI: dashboard, history, onboarding, and the transaction scanner     |
| `backend/`  | Fastify scanning service: decode + simulate + threat intel + verdict API         |

The scanner engines (Program / Wallet / Token), the PRD scoring model, and the deeper
detection helpers (balance diffing, instruction decoding, lookalike-domain, address
poisoning, SIWS parsing, durable-nonce) all live in `shared/`, so the frontend's in-browser
fail-safe scanner and the backend run **identical** detection logic.

## Quick start

Backend (optional — the frontend falls back to a local scanner if it's absent):

```bash
cd backend
npm install
npm run start        # http://localhost:8787
```

Frontend:

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Point the frontend at the backend by setting `VITE_API_URL=http://localhost:8787` in
`frontend/.env`. See each package's README and `.env.example` for all options.

## How a scan works

1. The real scanner takes a base64 unsigned transaction (+ origin + signer).
2. It decodes legacy/v0 transactions, resolving Address Lookup Tables.
3. It simulates the transaction against Solana RPC (backend uses multi-endpoint failover).
4. It reads live program and token-mint metadata from chain.
5. It enriches counterparties with threat intel (drainer / sanctioned / cluster lists) and
   the origin domain (phishing + lookalike detection).
6. The shared scanner engines produce findings + fired rules, which are scored into a verdict.
7. If the backend is unreachable, the frontend runs the same engines locally (fail-safe mode).

## Deployment

### Local full stack (Docker)

```bash
docker compose up --build
# frontend: http://localhost:8080   backend: http://localhost:8787   mongo: :27017
```

The compose file runs MongoDB + backend + frontend together. Both Dockerfiles use the
**repo root** as build context (the backend/frontend import the sibling `shared/` package).

### Hosted

- **Backend** → Render (see `render.yaml`) or any Docker host. Build with
  `docker build -f backend/Dockerfile -t solshield-backend .`. Set `MONGODB_URI`,
  `CORS_ORIGINS`, and optionally `SOLANA_RPC_URLS` / `API_KEYS` / `ADMIN_KEY` as env vars.
- **Frontend** → Vercel/Netlify (static) via `frontend/vercel.json`, or the
  `frontend/Dockerfile` (nginx). Pass `VITE_API_URL` (your backend URL) and
  `VITE_SOLANA_CLUSTER` at build time.

All persistence and intel features degrade gracefully when `MONGODB_URI` is unset, so the
backend runs even without a database.

## Testing

```bash
cd shared && npm test     # 28 unit tests (scanners, scoring, detection)
cd backend && npm test    # 9 route tests (via Fastify inject)
```

CI runs typecheck + tests + build for all three packages on every push (`.github/workflows/ci.yml`).
