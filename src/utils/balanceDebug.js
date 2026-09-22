/** Dev-only balance pipeline logging. Filter console by `[balances]`. */

const ENABLED = Boolean(
  typeof import.meta !== "undefined" && import.meta.env?.DEV,
);

export function balLog(...args) {
  if (ENABLED) console.log("[balances]", ...args);
}

export function balWarn(...args) {
  if (ENABLED) console.warn("[balances]", ...args);
}

export function balError(...args) {
  if (ENABLED) console.error("[balances]", ...args);
}

export function balGroup(label, fn) {
  if (!ENABLED) return fn();
  console.groupCollapsed(`[balances] ${label}`);
  try {
    return fn();
  } finally {
    console.groupEnd();
  }
}
