import { useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { isActionUserRejection } from "../utils/hookClient";
import { resolveSolanaWallet } from "../utils/sol/solanaWalletLookup";
import { connectSolanaAdapter } from "../utils/sol/connectSolanaAdapter";

const SOLANA_CONNECT_TIMEOUT_MS = 45_000;

/**
 * Connect a Solana wallet from the Axiom WalletModal.
 */
export default function useSolanaConnect() {
  const {
    wallets: solWallets,
    select: solSelect,
    disconnect: solDisconnect,
    connected: solConnected,
  } = useWallet();

  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState(null);
  const [notDetected, setNotDetected] = useState(null);

  const clearConnectFeedback = useCallback(() => {
    setConnectError(null);
    setNotDetected(null);
  }, []);

  const connectSolanaWallet = useCallback(
    async (wallet) => {
      setNotDetected(null);
      const resolution = resolveSolanaWallet(wallet.id, solWallets);

      if (resolution.kind === "not_detected") {
        setConnectError(null);
        setNotDetected({
          wallet,
          message: resolution.message,
          installUrl: resolution.installUrl,
        });
        return { success: false, kind: "not_detected" };
      }

      if (resolution.kind === "unavailable") {
        setConnectError(resolution.message);
        return { success: false, kind: "unavailable" };
      }

      const { entry } = resolution;
      const { adapter } = entry;

      setConnectError(null);
      setIsConnecting(true);

      try {
        if (solConnected) {
          try {
            await solDisconnect();
          } catch {
            // ignore
          }
        }

        const connectPromise = connectSolanaAdapter({
          entry,
          solSelect,
        });

        await Promise.race([
          connectPromise,
          new Promise((_, reject) => {
            setTimeout(
              () => reject(new Error("Connection timed out. Try again.")),
              SOLANA_CONNECT_TIMEOUT_MS,
            );
          }),
        ]);

        setConnectError(null);
        setNotDetected(null);
        return { success: true };
      } catch (error) {
        if (!isActionUserRejection(error)) {
          setConnectError(
            error instanceof Error ? error.message : "Failed to connect wallet",
          );
        }
        try {
          await adapter.disconnect();
        } catch {
          // ignore
        }
        try {
          await solDisconnect();
        } catch {
          // ignore
        }
        return { success: false, kind: "error", error };
      } finally {
        setIsConnecting(false);
      }
    },
    [solConnected, solDisconnect, solSelect, solWallets],
  );

  return {
    connectSolanaWallet,
    isConnecting,
    connectError,
    notDetected,
    clearConnectFeedback,
  };
}
