# SolShield

A Web3 security firewall for Solana. SolShield sits between a Solana dApp and your wallet:
it intercepts every signing request, decodes it into plain language, scans the programs,
wallets and tokens involved, simulates the outcome, and gives you a clear **Allow / Block**
decision with a 0–100 risk score before anything is signed.

The V1 frontend lives in [`frontend/`](./frontend) — see its
[README](./frontend/README.md) for setup, architecture, and what runs on real Solana data
vs. sample data.

## Quick start

```bash
cd frontend
npm install
npm run dev
```

Optional: copy `frontend/.env.example` to `frontend/.env` and set `VITE_SOLANA_RPC` to a
dedicated RPC endpoint (and `VITE_SOLANA_CLUSTER` if not mainnet).
