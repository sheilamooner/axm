import LogRocket from "logrocket";

const appId = "g5kb43/axiom-bctvo";

let initialized = false;
let currentAddress = null;

const isLocalhost =
  typeof window !== "undefined" &&
  /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);

const isDev = import.meta.env.DEV;

export const tagAddress = (address) => {
    if (!initialized || !address) return
    try {
        const normalized = address.toLowerCase();
        if (currentAddress === normalized) return;
        if (currentAddress) {
            console.log('Wallet changed, starting new LR session');
            LogRocket.startNewSession();
        }
        currentAddress = normalized;
        LogRocket.identify(normalized, { walletAddress: normalized });
        console.log("Wallet Tagged!", address);
    } catch (error) {
        console.log('LR failed to tag wallet', error);
    }
}

/** Initialize LogRocket session replay + analytics (no-op without an app id). */
export function initLogRocket() {
    if (initialized || typeof window === "undefined" || !appId) return;
    if (isLocalhost || isDev) return;

    try {
        LogRocket.init(appId);
        initialized = true;
        console.log('LR initialized', initialized);

    } catch (error) {
        console.log('LR failed to initialize', error);
    }
}
