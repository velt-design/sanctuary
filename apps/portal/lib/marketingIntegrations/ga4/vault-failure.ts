import 'server-only';
import { AuthExpiredError, RateLimitExceededError } from '@1password/sdk';

type VaultStage = 'vault_auth' | 'vault_read' | 'item_validation';
type VaultCode = 'auth_expired' | 'rate_limited' | 'timeout' | 'aborted' | 'invalid_item' | 'unavailable';
const observed = new WeakMap<object, { stage: VaultStage; code: VaultCode }>();
export function ga4VaultFailure(error: unknown): { stage: VaultStage; code: VaultCode } {
  return (typeof error === 'object' && error !== null ? observed.get(error) : undefined)
    ?? { stage: 'vault_read', code: 'unavailable' };
}

function failureCode(stage: VaultStage, error: unknown): VaultCode {
  if (stage === 'item_validation') return 'invalid_item';
  if (error instanceof AuthExpiredError) return 'auth_expired';
  if (error instanceof RateLimitExceededError) return 'rate_limited';
  if (error instanceof DOMException && error.name === 'TimeoutError') return 'timeout';
  if (error instanceof DOMException && error.name === 'AbortError') return 'aborted';
  return 'unavailable';
}

/** Observe existing work only. No SDK text, item fields, identifiers or retries. */
export async function observeGa4Vault<T>(stage: VaultStage, action: () => Promise<T>): Promise<T> {
  try { return await action(); }
  catch (error) {
    const classification = { stage, code: failureCode(stage, error) };
    if (typeof error === 'object' && error !== null) observed.set(error, classification);
    try { console.warn({ event: 'sanctuary_ga4_vault_failure', ...classification }); }
    catch { /* Logging must not change credential bookkeeping. */ }
    throw error;
  }
}
