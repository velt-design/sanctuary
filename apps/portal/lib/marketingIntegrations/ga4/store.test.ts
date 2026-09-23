// @vitest-environment node
import { expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ rpc: vi.fn(), abortSignal: vi.fn() }));
vi.mock('../../supabaseClient', () => ({ supabaseServiceRole: { rpc: f.rpc } }));
import { ga4Store, ga4LifecycleStore, Ga4StoreFailure } from './store';
const id = '10000000-0000-4000-8000-000000000001';
const source = { sourceKey: 'synthetic', connectionId: id, environment: 'test', token: 'synthetic', databaseUrl: 'postgres://unused', databaseSsl: false as const };
it.each(['42501', 'P0001', 'private-secret-code', null])('exposes only allowlisted SQLSTATE %s', async code => {
  f.rpc.mockReturnValue({ abortSignal: f.abortSignal });
  f.abortSignal.mockResolvedValue({ error: { code, message: 'private secret', details: 'provider body' } });
  const command = ga4Store({ actor: id, property: '123', binding: 'a'.repeat(64) }, source);
  let caught: unknown;
  try { await command('complete', id, new AbortController().signal); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(Ga4StoreFailure);
  expect((caught as Ga4StoreFailure).sqlState).toBe(code === '42501' || code === 'P0001' ? code : 'unknown');
  expect(JSON.stringify(caught)).not.toMatch(/private|provider|credential/);
});
it('records known outcomes after request cancellation with a separate bounded signal', async () => {
  const request = new AbortController();
  const command = vi.fn(async () => ({}));
  const store = ga4LifecycleStore(command, id, request.signal);
  await store.before('token_refresh', {});
  request.abort();
  await store.after('token_refresh', { scope: 'readonly' });
  await store.finish('uncertain');
  expect(command.mock.calls[0]).toEqual(['before', id, request.signal, { step: 'token_refresh', evidence: {} }]);
  const calls = command.mock.calls as unknown as Array<[string, string, AbortSignal, unknown]>;
  expect(calls[1][2]).not.toBe(request.signal);
  expect(calls[1][2].aborted).toBe(false);
  expect(calls[2][2].aborted).toBe(false);
});
