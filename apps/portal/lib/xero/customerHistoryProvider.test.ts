import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ access: vi.fn(), config: vi.fn() }));
vi.mock('./store', () => ({ access: mocks.access }));
vi.mock('./security', () => ({ config: mocks.config }));
import { readHistoryPage, type HistoryRead } from './customerHistoryProvider';
const id = '10000000-0000-4000-8000-000000000001';
const query: HistoryRead = { resource: 'Invoices', tenantId: id, contactId: id, period: { from: '2026-09-01', to: '2026-09-22' }, page: 1 };
const signal = () => new AbortController().signal;
beforeEach(() => { mocks.config.mockReturnValue({ tenantId: id }); mocks.access.mockResolvedValue({ accessToken: 'synthetic-only', scopes: ['accounting.invoices.read'] }); });
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('uses fixed GET tenant broker transport without redirects, caching or accounting writes', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ Invoices: [] })); vi.stubGlobal('fetch', fetcher);
  expect(await readHistoryPage(query, signal())).toEqual([]);
  expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'GET', redirect: 'error', cache: 'no-store', headers: { 'Xero-tenant-id': id } });
});
it('denies tenant changes, unsupported scope, invalid date and page before provider access', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  await expect(readHistoryPage({ ...query, tenantId: '20000000-0000-4000-8000-000000000001' }, signal())).rejects.toThrow();
  await expect(readHistoryPage({ ...query, resource: 'BankTransactions' }, signal())).rejects.toThrow();
  await expect(readHistoryPage({ ...query, page: 11 }, signal())).rejects.toThrow();
  await expect(readHistoryPage({ ...query, period: { ...query.period, from: 'invalid' } }, signal())).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
it('does not expose provider error bodies or accept malformed/oversized pages', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('private provider detail', { status: 429 })); vi.stubGlobal('fetch', fetcher);
  await expect(readHistoryPage(query, signal())).rejects.toThrow('HISTORY_UNAVAILABLE');
  fetcher.mockResolvedValue(Response.json({ Invoices: Array(101).fill({}) }));
  await expect(readHistoryPage(query, signal())).rejects.toThrow('HISTORY_UNAVAILABLE');
  fetcher.mockResolvedValue(new Response('x'.repeat(2_000_001)));
  await expect(readHistoryPage(query, signal())).rejects.toThrow('HISTORY_LIMIT');
});
