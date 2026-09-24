// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { ga4Google, ga4Vault, type Ga4VaultSdk } from './providers';
import { GA4_READ_SCOPE } from './lifecycle';

const token = { access_token: 'synthetic-access', refresh_token: 'synthetic-rotation', scope: GA4_READ_SCOPE, token_type: 'Bearer', expires_in: 3600 };
const parameters = () => new URLSearchParams({ grant_type: 'refresh_token', refresh_token: 'synthetic-old' });
afterEach(() => vi.useRealTimers());

it('uses fixed bounded token/property reads and preserves rotated credentials', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(token)).mockResolvedValueOnce(Response.json({ name: 'properties/123' }));
  const provider = ga4Google(fetcher);
  expect(await provider.token(parameters())).toEqual({ accessToken: token.access_token, refreshToken: token.refresh_token, scope: GA4_READ_SCOPE, expiresIn: 3600 });
  await provider.property(token.access_token, '123');
  expect(fetcher.mock.calls.map(call => call[0])).toEqual(['https://oauth2.googleapis.com/token', 'https://analyticsadmin.googleapis.com/v1beta/properties/123']);
  for (const [, options] of fetcher.mock.calls) expect(options).toMatchObject({ cache: 'no-store', redirect: 'error', signal: expect.any(AbortSignal) });
});
it.each([
  { scope: `${GA4_READ_SCOPE} other` }, { scope: 'other' }, { token_type: 'Basic' }, { expires_in: 86401 },
  { expires_in: 0 }, { refresh_token: '' }, { access_token: '' },
])('rejects malformed or widened token authority without retry: %j', async patch => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ...token, ...patch }));
  await expect(ga4Google(fetcher).token(parameters())).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('allows a refresh response without rotation', async () => {
  const { refresh_token: _unused, ...unchanged } = token; void _unused;
  expect((await ga4Google(vi.fn<typeof fetch>().mockResolvedValue(Response.json(unchanged))).token(parameters())).refreshToken).toBeUndefined();
});
it.each([{ name: 'properties/456' }, { name: 'properties/123', deleteTime: '2026-09-01' }, { name: 'properties/123', expireTime: '2026-09-01' }])('rejects wrong/deleted property: %j', async body => {
  await expect(ga4Google(vi.fn<typeof fetch>().mockResolvedValue(Response.json(body))).property('synthetic', '123')).rejects.toThrow();
});
it('rejects invalid paths before fetch and bounded transport errors without retry', async () => {
  const fetcher = vi.fn<typeof fetch>();
  await expect(ga4Google(fetcher).property('synthetic', '../123')).rejects.toThrow(); expect(fetcher).not.toHaveBeenCalled();
  fetcher.mockResolvedValueOnce(new Response('x'.repeat(65537)));
  await expect(ga4Google(fetcher).token(parameters())).rejects.toThrow(); expect(fetcher).toHaveBeenCalledTimes(1);
});

function fixture() {
  const item = { id: 'item', vaultId: 'vault', category: 'ApiCredentials', version: 3, title: 'Synthetic',
    fields: [{ id: 'refresh_token', fieldType: 'Concealed', value: 'synthetic-old' }, { id: 'notes', fieldType: 'Text', value: 'keep' }] };
  const get = vi.fn().mockResolvedValue(item);
  const put = vi.fn().mockImplementation(async (value: typeof item) => ({ ...value, version: 4 }));
  const createClient = vi.fn().mockResolvedValue({ items: { get, put } });
  const sdk: Ga4VaultSdk = { createClient, apiCredentialsCategory: 'ApiCredentials', concealedFieldType: 'Concealed' };
  return { item, get, put, createClient, vault: ga4Vault({ vaultId: 'vault', itemId: 'item', vaultToken: 'synthetic-sdk-auth' }, sdk) };
}
it('preserves item metadata, exact prior version and unrelated fields when rotating', async () => {
  const f = fixture(); await f.vault.authenticate(); expect(await f.vault.read()).toEqual({ refreshToken: 'synthetic-old', version: 3 });
  expect(await f.vault.write('synthetic-new')).toEqual({ version: 4 });
  expect(f.put.mock.calls[0]?.[0]).toEqual({ ...f.item, fields: [{ ...f.item.fields[0], value: 'synthetic-new' }, f.item.fields[1]] });
  await expect(f.vault.write('second')).rejects.toThrow(); expect(f.put).toHaveBeenCalledTimes(1);
});
it.each(['id', 'vault', 'category', 'duplicate', 'visible', 'version'])('rejects invalid vault read %s before any write', async mode => {
  const f = fixture(); const item = structuredClone(f.item);
  if (mode === 'id') item.id = 'other'; if (mode === 'vault') item.vaultId = 'other'; if (mode === 'category') item.category = 'Login';
  if (mode === 'duplicate') item.fields.push({ ...item.fields[0] }); if (mode === 'visible') item.fields[0].fieldType = 'Text'; if (mode === 'version') item.version = 0;
  f.get.mockResolvedValue(item); await f.vault.authenticate(); await expect(f.vault.read()).rejects.toThrow();
  await expect(f.vault.write('new')).rejects.toThrow(); expect(f.put).not.toHaveBeenCalled();
});
it.each(['version', 'token', 'duplicate', 'category', 'id'])('quarantines unconfirmed write acknowledgement %s', async mode => {
  const f = fixture(); await f.vault.authenticate(); await f.vault.read();
  f.put.mockImplementationOnce(async value => {
    const updated = structuredClone(value); updated.version = mode === 'version' ? 3 : 4;
    if (mode === 'token') updated.fields[0].value = 'wrong'; if (mode === 'duplicate') updated.fields.push({ ...updated.fields[0] });
    if (mode === 'category') updated.category = 'Login'; if (mode === 'id') updated.id = 'other'; return updated;
  });
  await expect(f.vault.write('new')).rejects.toThrow(); await expect(f.vault.write('new')).rejects.toThrow(); expect(f.put).toHaveBeenCalledTimes(1);
});
it('times out an SDK write without retrying or accepting its late result', async () => {
  vi.useFakeTimers(); const f = fixture(); await f.vault.authenticate(); await f.vault.read();
  let resolve!: (value: unknown) => void; f.put.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const pending = expect(f.vault.write('new')).rejects.toThrow('uncertain'); await vi.advanceTimersByTimeAsync(15000); await pending;
  resolve({ ...f.item, version: 4 }); await expect(f.vault.write('new')).rejects.toThrow(); expect(f.put).toHaveBeenCalledTimes(1);
});
