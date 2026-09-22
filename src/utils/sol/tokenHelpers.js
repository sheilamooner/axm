import { PublicKey, LAMPORTS_PER_SOL, Connection } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import {
  getSolanaConnection,
  getSolanaRpcUrl,
  SOLANA_PUBLIC_RPC,
} from "./chains";
import { balLog, balWarn } from "../balanceDebug";

/** Wrapped SOL mint. */
export const WSOL_MINT = "So11111111111111111111111111111111111111112";

/** System program — prjx/LiFi native SOL address. */
export const SOL_NATIVE_MINT = "11111111111111111111111111111111";

export function isNativeSolMint(mint) {
  if (mint == null || mint === "") return true;
  const m = String(mint).trim();
  const lower = m.toLowerCase();
  return (
    lower === "0x0000000000000000000000000000000000000000" ||
    lower === WSOL_MINT.toLowerCase() ||
    m === SOL_NATIVE_MINT ||
    lower === "sol" ||
    lower === "native"
  );
}

function asPublicKey(owner) {
  return owner instanceof PublicKey ? owner : new PublicKey(String(owner));
}

/** Primary RPC, then public backup. */
async function rpcCall(fn) {
  const primary = getSolanaRpcUrl();
  try {
    return await fn(getSolanaConnection());
  } catch (err) {
    balWarn("sol rpc primary failed, trying public", err?.message || err);
    if (primary === SOLANA_PUBLIC_RPC) throw err;
    return fn(
      new Connection(SOLANA_PUBLIC_RPC, {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000,
      }),
    );
  }
}

/** Native SOL (lamports → UI). */
export async function getNativeSolBalance(owner) {
  const pubkey = asPublicKey(owner);
  return rpcCall(async (conn) => {
    const lamports = await conn.getBalance(pubkey);
    return lamports / LAMPORTS_PER_SOL;
  });
}

/**
 * Load SOL + all SPL / Token-2022 balances via token accounts.
 * One getBalance + two getParsedTokenAccountsByOwner — no per-mint ATA guesses.
 *
 * @returns {Record<string, number>} mint → ui amount
 *   also `native`, WSOL_MINT, SOL_NATIVE_MINT for native SOL
 */
export async function loadSolanaBalances(owner, mints = []) {
  const ownerKey = asPublicKey(owner);

  return rpcCall(async (conn) => {
    const entries = {};

    const lamports = await conn.getBalance(ownerKey);
    const sol = lamports / LAMPORTS_PER_SOL;
    entries.native = sol;
    entries[WSOL_MINT] = sol;
    entries[SOL_NATIVE_MINT] = sol;

    const programs = [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID];
    let accountCount = 0;

    for (const programId of programs) {
      const { value } = await conn.getParsedTokenAccountsByOwner(ownerKey, {
        programId,
      });
      accountCount += value.length;

      for (const { account } of value) {
        const info = account?.data?.parsed?.info;
        const mint = info?.mint;
        if (!mint) continue;
        const ui = Number(info?.tokenAmount?.uiAmount ?? 0);
        if (!Number.isFinite(ui)) continue;
        // Same mint shouldn't appear twice; sum defensively.
        entries[mint] = (entries[mint] ?? 0) + ui;
      }
    }

    // Ensure every requested mint has a key (0 if no token account).
    for (const raw of mints) {
      const mint = String(raw ?? "").trim();
      if (!mint) continue;
      if (entries[mint] != null) continue;
      entries[mint] = isNativeSolMint(mint) ? sol : 0;
    }

    const positive = Object.entries(entries).filter(
      ([k, v]) => k !== "native" && v > 0,
    );
    balLog("loadSolanaBalances", {
      owner: ownerKey.toBase58(),
      rpc: conn.rpcEndpoint?.slice?.(0, 40),
      tokenAccounts: accountCount,
      positiveMints: positive.length,
      sample: positive.slice(0, 8),
      requested: mints.length,
    });

    return entries;
  });
}

/** Single mint helper — uses token-account map under the hood. */
export async function getSplTokenBalance(mint, owner) {
  if (isNativeSolMint(mint)) return getNativeSolBalance(owner);
  const map = await loadSolanaBalances(owner, [mint]);
  return map[String(mint).trim()] ?? 0;
}
