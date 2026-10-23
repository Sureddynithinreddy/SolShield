import type { ListEntry, TxScenario, UserRule } from "./types";

/* ------------------------------------------------------------------ *
 * Signing scenarios — the heart of the demo. Three realistic flows
 * covering Safe, Caution and Dangerous verdicts.
 * ------------------------------------------------------------------ */

export const scenarios: TxScenario[] = [
  /* ---------------------------- SAFE ---------------------------- */
  {
    id: "safe-swap",
    dappName: "Jupiter",
    dappDomain: "jup.ag",
    dappFavicon: "🪐",
    requestType: "signTransaction",
    verdict: "safe",
    score: 8,
    confidence: "high",
    summary:
      "This transaction swaps 2.5 SOL for about 486.2 USDC on Jupiter. No new permissions are granted and all programs are verified.",
    balanceChanges: [
      { symbol: "SOL", name: "Solana", amount: -2.5, usd: -487.5, mono: "So111…11112" },
      { symbol: "USDC", name: "USD Coin", amount: 486.2, usd: 486.2, mono: "EPjFW…Dt1v" },
    ],
    permissions: [
      {
        label: "No new approvals",
        detail: "This transaction does not grant any delegate or authority to the site.",
        severity: "info",
      },
    ],
    firedRules: [
      {
        id: "R-INFO-21",
        title: "Verified routing program",
        severity: "info",
        explanation: "Jupiter Aggregator v6 is on the verified-build allowlist and audited.",
        recommendedAction: "Safe to proceed.",
      },
    ],
    programs: [
      {
        programId: "ComputeBudget111111111111111111111111111111",
        name: "Compute Budget",
        core: true,
        verified: true,
        deployedDaysAgo: null,
        upgradeAuthority: "immutable",
        receivesFunds: false,
      },
      {
        programId: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
        name: "Jupiter Aggregator v6",
        core: false,
        verified: true,
        deployedDaysAgo: 540,
        upgradeAuthority: "multisig-known",
        receivesFunds: true,
      },
      {
        programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        name: "SPL Token Program",
        core: true,
        verified: true,
        deployedDaysAgo: null,
        upgradeAuthority: "immutable",
        receivesFunds: false,
      },
    ],
    walletTargets: [
      {
        address: "9aYourOwnUsdcAtaWa11etZzZ9kQ2vB8hUeppppppppp",
        role: "Your ATA",
        isSelf: true,
      },
    ],
    domain: {
      domain: "jup.ag",
      ageDays: 1460,
      ssl: true,
      onPhishingList: false,
      reputation: 98,
    },
    tokens: [
      {
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        symbol: "USDC",
        name: "USD Coin",
        mintAuthorityActive: true,
        freezeAuthorityActive: false,
        verifiedListed: true,
      },
    ],
    scanners: [
      {
        key: "simulator",
        title: "Simulator",
        findings: [
          { label: "Net balance change", value: "−2.5 SOL / +486.2 USDC", status: "info" },
          { label: "Authority changes", value: "None detected", status: "ok" },
          { label: "Simulation", value: "Succeeded · matches claimed intent", status: "ok" },
        ],
      },
    ],
    instructions: [
      {
        index: 0,
        program: "Compute Budget",
        programId: "ComputeBudget111111111111111111111111111111",
        name: "SetComputeUnitLimit",
        summary: "Set compute unit limit to 180,000",
      },
      {
        index: 1,
        program: "Jupiter v6",
        programId: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
        name: "sharedAccountsRoute",
        summary: "Route 2.5 SOL → USDC via Orca + Meteora pools",
      },
    ],
    feeSol: 0.00041,
    scanMs: 612,
  },

  /* --------------------------- CAUTION --------------------------- */
  {
    id: "caution-mint",
    dappName: "MeteoraMints",
    dappDomain: "meteora-mints.xyz",
    dappFavicon: "🌠",
    requestType: "signTransaction",
    verdict: "caution",
    score: 47,
    confidence: "medium",
    summary:
      "This transaction mints an NFT for 0.8 SOL. The token you receive has an active freeze authority, and the mint program was deployed 5 days ago.",
    balanceChanges: [
      { symbol: "SOL", name: "Solana", amount: -0.8, usd: -156.0, mono: "So111…11112" },
      { symbol: "GLOW", name: "GlowPass #4821", amount: 1, mono: "GLoWp…9kQ2" },
    ],
    permissions: [
      {
        label: "Create associated token account",
        detail: "A new token account will be created and owned by you. Normal for mints.",
        severity: "info",
      },
    ],
    firedRules: [
      // All rules for this scenario are produced live by the scanners:
      //   R-004 / R-PRG-3  → Program Scanner (brand-new, single-key upgrade authority)
      //   R-005            → Token Scanner (active freeze authority)
      //   domain-age warn  → Wallet Scanner
    ],
    programs: [
      {
        programId: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
        name: "Associated Token Account",
        core: true,
        verified: true,
        deployedDaysAgo: null,
        upgradeAuthority: "immutable",
        receivesFunds: false,
      },
      {
        programId: "GLoWm1nTxyz9kQ2vB8hUepqRfD3n6sJ4aZ2wCtE7bLm",
        name: "GlowMint",
        core: false,
        verified: false,
        deployedDaysAgo: 5,
        upgradeAuthority: "single-unknown",
        receivesFunds: true,
      },
    ],
    walletTargets: [
      {
        address: "MmTeoRaM1nTpr0jectWa11etZzZ9kQ2vB8hUeppppppp",
        role: "Mint proceeds",
        ageDays: 11,
        incomingUsd: 156,
      },
    ],
    domain: {
      domain: "meteora-mints.xyz",
      ageDays: 11,
      ssl: true,
      onPhishingList: false,
      reputation: 61,
    },
    tokens: [
      {
        mint: "GLoWpass4821NFTm1ntZzZ9kQ2vB8hUepppppppppppp",
        symbol: "GLOW",
        name: "GlowPass #4821",
        mintAuthorityActive: true,
        freezeAuthorityActive: true,
        isNft: true,
      },
    ],
    scanners: [
      {
        key: "simulator",
        title: "Simulator",
        findings: [
          { label: "Net balance change", value: "−0.8 SOL / +1 GlowPass NFT", status: "info" },
          { label: "Authority changes", value: "None on your accounts", status: "ok" },
          { label: "Simulation", value: "Succeeded", status: "ok" },
        ],
      },
    ],
    instructions: [
      {
        index: 0,
        program: "Associated Token Account",
        programId: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
        name: "Create",
        summary: "Create associated token account for GlowPass",
      },
      {
        index: 1,
        program: "GlowMint",
        programId: "GLoWm1nTxyz9kQ2vB8hUepqRfD3n6sJ4aZ2wCtE7bLm",
        name: "mintNft",
        summary: "Mint 1 GlowPass #4821 for 0.8 SOL",
        flagged: true,
      },
    ],
    feeSol: 0.00052,
    scanMs: 884,
  },

  /* -------------------------- DANGEROUS -------------------------- */
  {
    id: "danger-drainer",
    dappName: "Solana Airdrop Claim",
    dappDomain: "solana-airdrop-claim.net",
    dappFavicon: "🎁",
    requestType: "signTransaction",
    verdict: "dangerous",
    score: 97,
    confidence: "high",
    summary:
      "This site is trying to take control of your USDC and sweep all your SOL to an unknown wallet linked to a confirmed drainer. Do not sign.",
    balanceChanges: [
      { symbol: "SOL", name: "Solana", amount: -18.42, usd: -3591.9, mono: "So111…11112" },
      { symbol: "USDC", name: "USD Coin (delegated)", amount: -2450.0, usd: -2450.0, mono: "EPjFW…Dt1v" },
    ],
    permissions: [
      {
        label: "Unlimited USDC delegate",
        detail:
          "Grants an unknown address permission to move ALL of your USDC, now and in the future.",
        severity: "critical",
      },
      {
        label: "SOL transfer to unknown wallet",
        detail: "Sends 18.42 SOL to a wallet funded by a known drainer cluster.",
        severity: "critical",
      },
    ],
    firedRules: [
      // R-001 (drainer, hard block) + R-007 (lookalike domain) + R-WAL-4 (cluster)
      //   → Wallet Scanner
      // R-003 (unlimited delegate)
      //   → Token Scanner
      // R-PRG-7 (unverified CPI)
      //   → Program Scanner
      // R-010 is a simulator-level large-outflow rule and stays here.
      {
        id: "R-010",
        title: "Large outflow",
        severity: "medium",
        explanation: "Net outflow of 18.42 SOL + 2,450 USDC exceeds your configured threshold.",
        recommendedAction: "Review balance changes carefully.",
      },
    ],
    programs: [
      {
        programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        name: "SPL Token Program",
        core: true,
        verified: true,
        deployedDaysAgo: null,
        upgradeAuthority: "immutable",
        receivesFunds: false,
      },
      {
        programId: "11111111111111111111111111111111",
        name: "System Program",
        core: true,
        verified: true,
        deployedDaysAgo: null,
        upgradeAuthority: "immutable",
        receivesFunds: false,
      },
      {
        programId: "Dra1nerXXXm4L1c10u5pr0gramZzZ9kQ2vB8hUeppppp",
        name: "Unknown program",
        core: false,
        verified: false,
        deployedDaysAgo: 2,
        upgradeAuthority: "single-unknown",
        receivesFunds: true,
        viaCpi: true,
      },
    ],
    walletTargets: [
      {
        address: "7xKqFv2dra1nerWa11etZzZ9kQ2vB8hUeppppppppp9Fv2",
        role: "Recipient",
        drainer: true,
        drainerThefts: 240,
        ageDays: 2,
        incomingUsd: 3591.9,
      },
      {
        address: "Re1ayXm4L1c10u5c1usterWa11etZzZ9kQ2vB8hUeKk3",
        role: "Relay",
        maliciousCluster: true,
        ageDays: 4,
        incomingUsd: 0,
      },
    ],
    domain: {
      domain: "solana-airdrop-claim.net",
      ageDays: 2,
      ssl: true,
      onPhishingList: false,
      lookalikeOf: "solana.com",
      reputation: 4,
    },
    tokens: [
      {
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        symbol: "USDC",
        name: "USD Coin",
        mintAuthorityActive: true,
        freezeAuthorityActive: false,
        verifiedListed: true,
        delegateApproval: {
          amount: "unlimited",
          to: "7xKqFv2dra1nerWa11etZzZ9kQ2vB8hUeppppppppp9Fv2",
          knownDelegate: false,
          worstCaseUsd: 2450,
        },
      },
    ],
    scanners: [
      {
        key: "simulator",
        title: "Simulator",
        findings: [
          { label: "Net balance change", value: "−18.42 SOL / −2,450 USDC", status: "bad" },
          { label: "Authority changes", value: "USDC delegate reassigned to attacker", status: "bad" },
          { label: "Simulation", value: "Succeeded · outcome ≠ claimed 'free airdrop'", status: "bad" },
        ],
      },
    ],
    instructions: [
      {
        index: 0,
        program: "SPL Token",
        programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        name: "Approve",
        summary: "Grant unlimited USDC delegate to 7xKq…9Fv2",
        flagged: true,
      },
      {
        index: 1,
        program: "System Program",
        programId: "11111111111111111111111111111111",
        name: "Transfer",
        summary: "Transfer 18.42 SOL to 7xKq…9Fv2",
        flagged: true,
      },
      {
        index: 2,
        program: "Unknown",
        programId: "Dra1nerXXXm4L1c10u5pr0gramZzZ9kQ2vB8hUeppppp",
        name: "unrecognized",
        summary: "Unverified program invoked via CPI",
        flagged: true,
      },
    ],
    feeSol: 0.00089,
    scanMs: 741,
  },
];

export const scenarioById = (id: string) => scenarios.find((s) => s.id === id) ?? scenarios[0];

/* ------------------------------------------------------------------ *
 * Allow / block lists + user rules.
 *
 * These are real local configuration (the user's own allow/block lists and
 * rules), not fabricated activity. The seed drainer/phishing entries stand in
 * for the backend threat-intel feeds described in the PRD, which have no public
 * frontend-accessible source.
 * ------------------------------------------------------------------ */

export const listEntries: ListEntry[] = [
  { value: "jup.ag", label: "Jupiter", kind: "domain", type: "allow" },
  { value: "app.kamino.finance", label: "Kamino Finance", kind: "domain", type: "allow" },
  { value: "tensor.trade", label: "Tensor", kind: "domain", type: "allow" },
  { value: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", label: "Jupiter v6", kind: "program", type: "allow" },
  { value: "solana-airdrop-claim.net", label: "Known phishing", kind: "domain", type: "block" },
  { value: "free-sol-reward.app", label: "Known phishing", kind: "domain", type: "block" },
  { value: "7xKqFv2dra1nerWa11etZzZ9kQ2vB8hUeppppppppp", label: "Confirmed drainer", kind: "address", type: "block" },
  { value: "Dra1nerXXXm4L1c10u5pr0gramZzZ9kQ2vB8hUeppppp", label: "Malicious program", kind: "program", type: "block" },
];

export const userRules: UserRule[] = [
  { id: "u1", text: "Never approve unlimited token delegates", enabled: true, severity: "critical" },
  { id: "u2", text: "Block transfers above 5 SOL to unknown wallets", enabled: true, severity: "high" },
  { id: "u3", text: "Warn when a program was deployed in the last 72 hours", enabled: true, severity: "medium" },
  { id: "u4", text: "Block tokens with an active freeze authority", enabled: false, severity: "medium" },
  { id: "u5", text: "Require two-step confirm for Token-2022 permanent delegate", enabled: true, severity: "high" },
];

/* Built-in rule pack (read-only display) */
export const rulePack: UserRule[] = [
  { id: "R-001", text: "Drainer destination — recipient on confirmed drainer list", enabled: true, severity: "critical" },
  { id: "R-002", text: "Wallet authority takeover — token account owner changed", enabled: true, severity: "critical" },
  { id: "R-003", text: "Unlimited delegate — Approve amount ≥ balance or max", enabled: true, severity: "high" },
  { id: "R-004", text: "Brand-new program — age under 72h receiving funds", enabled: true, severity: "high" },
  { id: "R-005", text: "Active freeze authority on received token", enabled: true, severity: "medium" },
  { id: "R-006", text: "Token-2022 permanent delegate extension", enabled: true, severity: "high" },
  { id: "R-007", text: "Lookalike domain above similarity threshold", enabled: true, severity: "high" },
  { id: "R-008", text: "Address poisoning — destination mimics recent counterparty", enabled: true, severity: "high" },
  { id: "R-009", text: "Durable nonce from an untrusted dApp", enabled: true, severity: "medium" },
  { id: "R-010", text: "Large outflow above user threshold", enabled: true, severity: "medium" },
];

/* ------------------------------------------------------------------ *
 * Sample aggregates — shown in the dashboard's "Threat intel" and "Scan
 * activity" panels and explicitly labelled "Sample data" in the UI. There
 * is no public backend to source fleet-wide analytics from.
 * ------------------------------------------------------------------ */

// 14-day scan volume (safe / caution / dangerous)
export const scanTrend = [
  { d: "D1", safe: 120, caution: 18, dangerous: 4 },
  { d: "D2", safe: 142, caution: 22, dangerous: 6 },
  { d: "D3", safe: 98, caution: 14, dangerous: 3 },
  { d: "D4", safe: 165, caution: 28, dangerous: 9 },
  { d: "D5", safe: 180, caution: 24, dangerous: 7 },
  { d: "D6", safe: 155, caution: 31, dangerous: 11 },
  { d: "D7", safe: 210, caution: 26, dangerous: 8 },
  { d: "D8", safe: 190, caution: 20, dangerous: 5 },
  { d: "D9", safe: 172, caution: 33, dangerous: 12 },
  { d: "D10", safe: 205, caution: 27, dangerous: 6 },
  { d: "D11", safe: 230, caution: 29, dangerous: 10 },
  { d: "D12", safe: 198, caution: 22, dangerous: 7 },
  { d: "D13", safe: 221, caution: 25, dangerous: 9 },
  { d: "D14", safe: 142, caution: 19, dangerous: 9 },
];

export const threatBreakdown = [
  { label: "Wallet drainer", count: 38, color: "#f43f5e" },
  { label: "Unlimited delegate", count: 24, color: "#fb923c" },
  { label: "Lookalike domain", count: 19, color: "#fbbf24" },
  { label: "Address poisoning", count: 12, color: "#a78bfa" },
  { label: "Rug / honeypot token", count: 9, color: "#22d3ee" },
];
