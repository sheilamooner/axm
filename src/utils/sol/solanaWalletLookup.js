import { WalletReadyState } from "@solana/wallet-adapter-base";

/** Explicitly registered @solana/wallet-adapter-wallets names. */
export const SOLANA_LEGACY_ADAPTER_NAMES = {
  phantom: "Phantom",
  solflare: "Solflare",
  coinbase: "Coinbase Wallet",
  trust: "Trust",
  ledger: "Ledger",
  backpack: "Backpack",
  glow: "Glow",
  slope: "Slope",
};

/**
 * Modal id → adapter name hints (legacy + Wallet Standard auto-detected).
 * Matches axiom-app WALLETS ids.
 */
export const SOLANA_WALLET_ALIASES = {
  phantom: ["Phantom"],
  solflare: ["Solflare"],
  backpack: ["Backpack"],
  glow: ["Glow"],
  slope: ["Slope"],
  coinbase: ["Coinbase Wallet", "Coinbase"],
  trust: ["Trust", "Trust Wallet"],
  ledger: ["Ledger"],
};

export const SOLANA_WALLET_INSTALL_URLS = {
  phantom: "https://phantom.app/download",
  solflare: "https://solflare.com/download",
  backpack: "https://backpack.app/download",
  glow: "https://glow.app",
  slope: "https://slope.finance",
  coinbase: "https://www.coinbase.com/wallet/downloads",
  trust: "https://trustwallet.com/download",
  ledger: "https://www.ledger.com/ledger-live",
};

function notDetectedMessage(label) {
  return `${label} is not detected on your device. If you have it installed, make sure to disable all other wallet extensions that may be conflicting. If it's not installed, download the wallet from the official website.`;
}

function notDetectedResolution(modalId, label, installUrl) {
  return {
    kind: "not_detected",
    label,
    installUrl: installUrl ?? SOLANA_WALLET_INSTALL_URLS[modalId],
    message: notDetectedMessage(label),
  };
}

function normalizeToken(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchesAlias(adapterName, alias) {
  const name = adapterName.toLowerCase();
  const hint = alias.toLowerCase();
  return name === hint || name.includes(hint) || hint.includes(name);
}

function findByAliases(wallets, aliases) {
  for (const alias of aliases) {
    const exact = wallets.find((w) => w.adapter.name === alias);
    if (exact) return exact;
  }
  for (const alias of aliases) {
    const partial = wallets.find((w) => matchesAlias(w.adapter.name, alias));
    if (partial) return partial;
  }
  return undefined;
}

function findByModalId(wallets, modalId) {
  const token = normalizeToken(modalId);
  return wallets.find((w) => {
    const nameToken = normalizeToken(w.adapter.name);
    return (
      nameToken.includes(token) ||
      token.includes(nameToken) ||
      nameToken.endsWith(token)
    );
  });
}

function isMissingExtension(entry) {
  return (
    entry.readyState === WalletReadyState.NotDetected ||
    entry.readyState === WalletReadyState.Unsupported
  );
}

/**
 * Resolve a WalletModal Solana wallet id to a runtime adapter entry.
 */
export function resolveSolanaWallet(modalId, wallets) {
  const legacyName = SOLANA_LEGACY_ADAPTER_NAMES[modalId];
  if (legacyName) {
    const legacy = wallets.find((w) => w.adapter.name === legacyName);
    if (legacy) {
      if (isMissingExtension(legacy)) {
        return notDetectedResolution(
          modalId,
          legacy.adapter.name,
          legacy.adapter.url,
        );
      }
      return { kind: "connect", entry: legacy };
    }
  }

  const aliases = SOLANA_WALLET_ALIASES[modalId];
  const byAlias = aliases ? findByAliases(wallets, aliases) : undefined;
  const entry = byAlias ?? findByModalId(wallets, modalId);

  if (entry) {
    if (isMissingExtension(entry)) {
      return notDetectedResolution(
        modalId,
        entry.adapter.name,
        entry.adapter.url,
      );
    }
    return { kind: "connect", entry };
  }

  const label =
    SOLANA_WALLET_ALIASES[modalId]?.[0] ?? legacyName ?? modalId;
  return notDetectedResolution(modalId, label);
}
