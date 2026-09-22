/**
 * Connect a Solana wallet adapter from the Axiom connect modal.
 */
export async function connectSolanaAdapter({ entry, solSelect }) {
  const { adapter } = entry;
  solSelect(adapter.name);
  await adapter.connect();
}
