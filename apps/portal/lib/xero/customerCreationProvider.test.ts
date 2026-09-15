import { createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { newXeroCustomer, type FrozenCustomerCreation } from './customerCreation';
import { customerCreationProvider } from './customerCreationProvider';
const mocks = vi.hoisted(() => ({ access: vi.fn(), config: vi.fn() }));
vi.mock('./store', () => ({ access: mocks.access }));
vi.mock('./security', async original => ({ ...await original<typeof import('./security')>(), config: mocks.config }));
const tenantId = '11111111-1111-4111-8111-111111111111';
const sourceContactId = '22222222-2222-4222-8222-222222222222';
const contactId = '33333333-3333-4333-8333-333333333333';
function frozen(): FrozenCustomerCreation {
  const customer = newXeroCustomer({ tenantId, sourceContactId, name: 'Example' });
  const body = JSON.stringify({ Contacts: [customer] }); const preparedAt = Date.now();
  return { tenantId, sourceContactId, customer, body, bodyHash: createHash('sha256').update(body).digest('hex'),
    idempotencyKey: 'synthetic-customer-request', preparedAt, expiresAt: preparedAt + 300_000,
    dispatchStarted: true, providerContactId: null };
}
beforeEach(() => {
  vi.resetAllMocks(); mocks.config.mockReturnValue({ tenantId });
  mocks.access.mockResolvedValue({ accessToken: 'synthetic', scopes: ['accounting.contacts'] });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('creates only with PUT using the frozen request, key and pinned organisation', async () => {
  vi.stubEnv('XERO_CUSTOMER_CREATION_ENABLED', 'true'); const request = frozen();
  const fetcher = vi.fn().mockResolvedValue(Response.json({ Contacts: [{ ContactID: contactId }] })); vi.stubGlobal('fetch', fetcher);
  expect(await customerCreationProvider.create(request)).toEqual({ contactId });
  expect(fetcher).toHaveBeenCalledExactlyOnceWith('https://api.xero.com/api.xro/2.0/Contacts', expect.objectContaining({
    method: 'PUT', body: request.body, cache: 'no-store', redirect: 'error', headers: expect.objectContaining({
      'Xero-tenant-id': tenantId, 'Idempotency-Key': request.idempotencyKey,
    }),
  }));
});
it('requires both the separate creation flag and recorded contact-write consent', async () => {
  const request = frozen(); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  vi.stubEnv('XERO_CUSTOMER_CREATION_ENABLED', 'false');
  await expect(customerCreationProvider.create(request)).rejects.toThrow('XERO_CUSTOMER_CREATION_DISABLED');
  vi.stubEnv('XERO_CUSTOMER_CREATION_ENABLED', 'true');
  mocks.access.mockResolvedValue({ accessToken: 'synthetic', scopes: ['accounting.contacts.read'] });
  await expect(customerCreationProvider.create(request)).rejects.toThrow('INSUFFICIENT_SCOPE'); expect(fetcher).not.toHaveBeenCalled();
});
it('refuses changed payloads, wrong tenants, missing dispatch, bound identities and expired windows before network writes', async () => {
  vi.stubEnv('XERO_CUSTOMER_CREATION_ENABLED', 'true'); const request = frozen(); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  for (const change of [{ tenantId: sourceContactId }, { body: '{}' }, { bodyHash: 'wrong' },
    { dispatchStarted: false }, { providerContactId: contactId }, { expiresAt: request.preparedAt + 1000 }]) {
    await expect(customerCreationProvider.create({ ...request, ...change })).rejects.toThrow();
  }
  expect(fetcher).not.toHaveBeenCalled();
});
it('includes archived contacts in bounded duplicate checks and keeps private fields out of returned evidence', async () => {
  mocks.access.mockResolvedValue({ accessToken: 'synthetic', scopes: ['accounting.contacts.read'] });
  const fetcher = vi.fn().mockResolvedValue(Response.json({ Contacts: [{ ContactID: contactId, ContactStatus: 'ARCHIVED',
    Name: 'A "B"', EmailAddress: 'private@example.test', BankAccountDetails: 'private', ValidationErrors: [{ Message: 'private' }] }] }));
  vi.stubGlobal('fetch', fetcher);
  const rows = await customerCreationProvider.findByName(tenantId, 'A "B"');
  const url = fetcher.mock.calls[0][0] as URL;
  expect(url.searchParams.get('where')).toBe('Name=="A ""B"""');
  expect(url.searchParams.get('includeArchived')).toBe('true'); expect(url.searchParams.get('pageSize')).toBe('2');
  expect(rows).toEqual([expect.objectContaining({ ContactID: contactId, ContactStatus: 'ARCHIVED', HasErrors: true })]);
  expect(JSON.stringify(rows)).not.toContain('private');
});
it('rejects provider errors, excessive results, validation failures and wrong exact identities', async () => {
  vi.stubEnv('XERO_CUSTOMER_CREATION_ENABLED', 'true');
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  for (const response of [new Response('private provider text', { status: 500 }),
    Response.json({ Contacts: [{ ContactID: contactId, HasValidationErrors: true }] }),
    Response.json({ Contacts: [{ ContactID: contactId }, { ContactID: contactId }, { ContactID: contactId }] })]) {
    fetcher.mockResolvedValue(response); await expect(customerCreationProvider.create(frozen())).rejects.toThrow(/XERO_CUSTOMER_REQUEST_FAILED|INVALID_PROVIDER_RESPONSE/);
  }
  fetcher.mockResolvedValue(Response.json({ Contacts: [{ ContactID: sourceContactId }] }));
  await expect(customerCreationProvider.read(tenantId, contactId)).rejects.toThrow('INVALID_PROVIDER_RESPONSE');
});
