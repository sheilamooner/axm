import { Connection } from "@solana/web3.js";

const ankrKey =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_ANKR_KEY
    ? String(import.meta.env.VITE_ANKR_KEY).trim()
    : "";

/** Public Solana mainnet — backup when Ankr is unset / failing. */
export const SOLANA_PUBLIC_RPC = "https://api.mainnet-beta.solana.com";

/** Primary: VITE_SOLANA_RPC → Ankr (VITE_ANKR_KEY) → public. */
export function getSolanaRpcUrl() {
  const override =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_SOLANA_RPC
      ? String(import.meta.env.VITE_SOLANA_RPC).trim()
      : "";
  if (override) return override;
  if (ankrKey) return `https://rpc.ankr.com/solana/${ankrKey}`;
  return SOLANA_PUBLIC_RPC;
}

export function getSolanaConnection(commitment = "confirmed") {
  return new Connection(getSolanaRpcUrl(), {
    commitment,
    confirmTransactionInitialTimeout: 60000,
  });
}

/** @deprecated use getSolanaRpcUrl */
export const solRpcList = {
  solana: getSolanaRpcUrl(),
  solanaDev: ["https://api.devnet.solana.com", "wss://api.devnet.solana.com"],
};
