// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { AuthExpiredError, RateLimitExceededError } from '@1password/sdk';
import { observeGa4Vault } from './vault-failure';
afterEach(() => vi.restoreAllMocks());

const canary = 'SYNTHETIC-PRIVATE-ITEM-AND-CREDENTIAL';
it.each(['vault_auth', 'vault_read'] as const)('%s projects only closed SDK classes, never text or arbitrary fields', async stage => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  for (const [error, code] of [
    [new AuthExpiredError(canary), 'auth_expired'], [new RateLimitExceededError(canary), 'rate_limited'],
    [new DOMException(canary, 'TimeoutError'), 'timeout'], [new DOMException(canary, 'AbortError'), 'aborted'],
    [Object.assign(new Error(canary, { cause: canary }), { name: 'RateLimitExceededError', code: 'rate_limited', item: canary }), 'unavailable'],
  ] as const) {
    warn.mockClear();
    const action = vi.fn().mockRejectedValue(error);
    await expect(observeGa4Vault(stage, action)).rejects.toBe(error);
    expect(action).toHaveBeenCalledOnce();
    expect(warn.mock.calls).toEqual([[{ event: 'sanctuary_ga4_vault_failure', stage, code }]]);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(canary);
  }
});
it('distinguishes item validation without exposing validator details and preserves failure when logging fails', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const error = new Error(canary);
  await expect(observeGa4Vault('item_validation', async () => { throw error; })).rejects.toBe(error);
  expect(warn.mock.calls).toEqual([[{ event: 'sanctuary_ga4_vault_failure', stage: 'item_validation', code: 'invalid_item' }]]);
  warn.mockImplementation(() => { throw Error('logger unavailable'); });
  await expect(observeGa4Vault('vault_read', async () => { throw error; })).rejects.toBe(error);
});
it('does not report successful work or change its return value', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const result = { private: canary };
  expect(await observeGa4Vault('vault_read', async () => result)).toBe(result);
  expect(warn).not.toHaveBeenCalled();
});
