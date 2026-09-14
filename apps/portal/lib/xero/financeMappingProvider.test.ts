import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ access: vi.fn(), config: vi.fn() }));
vi.mock('./store', () => ({ access: mocks.access }));
vi.mock('./security', async original => ({ ...await original<typeof import('./security')>(), config: mocks.config }));
import { financeMappingProvider } from './financeMappingProvider';
const id = '11111111-1111-4111-8111-111111111111';
beforeEach(() => {
  vi.resetAllMocks(); mocks.config.mockReturnValue({ tenantId: id });
  mocks.access.mockResolvedValue({ accessToken: 'synthetic', scopes: ['accounting.contacts.read', 'accounting.settings.read'] });
});
afterEach(() => vi.unstubAllGlobals());
it('returns only active revenue accounts and applicable taxes, without assuming default codes', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ Accounts: [
    { AccountID: id, Code: '475', Name: 'Custom sales', Type: 'REVENUE', Status: 'ACTIVE', TaxType: 'TAX001', BankAccountNumber: 'private' },
    { Type: 'BANK', Status: 'ACTIVE' }, { Type: 'REVENUE', Status: 'ARCHIVED' },
  ] })).mockResolvedValueOnce(Response.json({ TaxRates: [
    { TaxType: 'TAX001', Name: 'Custom GST', Status: 'ACTIVE', CanApplyToRevenue: true, EffectiveRate: 15 },
    { TaxType: 'INPUT2', Status: 'ACTIVE', CanApplyToRevenue: false },
  ] })); vi.stubGlobal('fetch', fetcher);
  const result = await financeMappingProvider.accounting(id);
  expect(result.accounts).toEqual([{ id, code: '475', name: 'Custom sales', defaultTaxType: 'TAX001' }]);
  expect(result.taxes).toEqual([{ type: 'TAX001', name: 'Custom GST', effectiveRate: 15 }]);
  expect(JSON.stringify(result)).not.toContain('private');
  expect(fetcher.mock.calls.every(([, options]) => options.method === undefined && options.redirect === 'error')).toBe(true);
});
it('rechecks exact contact identity and refuses archived or merged contacts', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ Contacts: [{ ContactID: id, Name: 'Example', ContactStatus: 'ARCHIVED' }] }))
    .mockResolvedValueOnce(Response.json({ Contacts: [{ ContactID: id, Name: 'Example', ContactStatus: 'ACTIVE', MergedToContactID: id }] }));
  vi.stubGlobal('fetch', fetcher);
  await expect(financeMappingProvider.contact(id, id)).rejects.toThrow('XERO_CONTACT_REVIEW_REQUIRED');
  await expect(financeMappingProvider.contact(id, id)).rejects.toThrow('XERO_CONTACT_REVIEW_REQUIRED');
});
it('bounds exact-name search, escapes quotes and strips non-review contact details', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ Contacts: [{ ContactID: id, Name: 'A "B"', ContactStatus: 'ACTIVE', BankAccountDetails: 'private' }] }));
  vi.stubGlobal('fetch', fetcher);
  expect((await financeMappingProvider.contacts(id, 'A "B"')).contacts).toEqual([{ id, name: 'A "B"', email: '' }]);
  expect(fetcher.mock.calls[0][0].searchParams.get('where')).toBe('Name=="A ""B"""');
});
it('refuses wrong tenants and missing settings consent before provider requests', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  await expect(financeMappingProvider.accounting('22222222-2222-4222-8222-222222222222')).rejects.toThrow('XERO_TENANT_MISMATCH');
  mocks.access.mockResolvedValue({ accessToken: 'old', scopes: ['accounting.contacts.read'] });
  await expect(financeMappingProvider.accounting(id)).rejects.toThrow('INSUFFICIENT_SCOPE');
  expect(fetcher).not.toHaveBeenCalled();
});
