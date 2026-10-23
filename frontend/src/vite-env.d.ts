/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOLANA_RPC?: string;
  readonly VITE_SOLANA_CLUSTER?: "mainnet-beta" | "devnet" | "testnet";
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
