# SolShield — V1 Frontend

A Web3 security firewall for Solana that sits between a dApp and your wallet. It intercepts
every signing request, decodes it into plain language, scans the programs/wallets/tokens
involved, simulates the outcome, and shows a clear **Allow / Block** decision with a 0–100
risk score — all before anything is signed.

This is the **V1 frontend demo**: React + TypeScript + Vite + Tailwind, powered by mock data
so you can walk the full workflow end to end.

## Run it

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

## What's inside

| Route            | Screen                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| `/`              | Landing page — hero, pipeline, scanners, threat model, personas, metrics |
| `/onboarding`    | First-run flow — welcome, how it works, strictness, privacy, ready     |
| `/app`           | Command Center dashboard — stats, scan activity, threats, recent requests |
| `/app/signing`   | **Live Signing demo** — pick a scenario and watch the intercept → scan → verdict flow |
| `/app/history`   | History & Insights — filterable log with outcomes and value protected  |
| `/app/settings`  | Settings — strictness, allow/block lists, custom + built-in rules, privacy |

### The signing overlay (core flow)

Three built-in scenarios demonstrate every verdict:

- 🪐 **Jupiter swap** → `Safe` (score 8)
- 🌠 **MeteoraMints NFT mint** → `Caution` (score 47 — active freeze authority, new program)
- 🎁 **Fake airdrop claim** → `Dangerous` (score 97 — confirmed drainer, unlimited delegate)

The overlay shows a risk gauge, a plain-language summary, "you send / you receive" balance
changes, permissions requested, the rules that fired, and expandable technical details
(program/wallet/token/simulator scanners + raw instructions). Dangerous verdicts require a
deliberate two-step override.

## Real vs. sample data

SolShield uses **live Solana data wherever it is obtainable in the browser**, and only
falls back to sample data where there is no public source.

**Real (read live from Solana mainnet via RPC):**
- Connected wallet address, SOL balance and SPL / Token-2022 balances
- Recent transaction history (signatures, status, fee, programs touched) with explorer links
- The **real transaction scanner**: paste a base64 unsigned transaction and SolShield
  decodes it (legacy + v0, resolving Address Lookup Tables), runs `simulateTransaction`,
  reads live program upgrade authority and token mint/freeze authority + Token-2022
  extensions, and runs the real scanner engines to produce a verdict.

**Sample / seed data (clearly labelled in the UI):**
- The three curated Safe / Caution / Dangerous **example scenarios** (you can't safely
  generate a real drainer transaction to demo)
- The dashboard "Threat intel" and "Scan activity" aggregates (no public fleet-wide source)
- The drainer / phishing **blocklists**, which in production come from the backend
  threat-intel feeds described in the PRD

Configure a dedicated RPC endpoint (recommended, to avoid public rate limits) with a
`.env` file:

```
VITE_SOLANA_RPC=https://your-rpc-endpoint
```

## Tech

- React 18 + React Router 6
- TypeScript (strict)
- Tailwind CSS 3 with a custom "security command center" theme
- `@solana/web3.js` + wallet-adapter for live, read-only on-chain data

> Read-only: SolShield never holds keys and never sends your transaction anywhere. The
> real scanner decodes and simulates on your behalf via a public RPC.
