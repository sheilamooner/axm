/** App UI helpers — extend in consumer apps. hookClient + evm/helpers import devLog from here. */
export function devLog(...args) {
  if (import.meta.env?.DEV) {
    console.log(...args);
  }
}
