import { useMemo, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import "@solana/wallet-adapter-react-ui/styles.css";

/**
 * Wraps the app in Solana wallet-adapter providers.
 *
 * Phantom, Solflare, Backpack and other modern wallets implement the
 * Wallet Standard, so they are auto-detected without explicit adapters.
 * We default to Devnet to match the PRD's test environment.
 */
export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  // Read-only RPC. Defaults to public mainnet-beta; override with VITE_SOLANA_RPC
  // (any cluster) and VITE_SOLANA_CLUSTER to point at devnet/testnet instead.
  const endpoint = useMemo(
    () => import.meta.env.VITE_SOLANA_RPC || clusterApiUrl("mainnet-beta"),
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
