import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ access: vi.fn(), config: vi.fn() }));
vi.mock('./store', () => ({ access: mocks.access }));
vi.mock('./security', () => ({ config: mocks.config }));
import { readSummaryPage, summaryQuery } from './financeSummaryProvider';
const period = { from: '2026-09-10', to: '2026-09-16' };
beforeEach(() => {
  mocks.config.mockReturnValue({ tenantId: '11111111-1111-4111-8111-111111111111' });
  mocks.access.mockResolvedValue({ accessToken: 'synthetic', scopes: ['accounting.invoices', 'accounting.payments.read'] });
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('uses fixed GET-only URLs with pinned tenant, pagination, stable ordering and no redirects', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ Invoices: [] })); vi.stubGlobal('fetch', fetcher);
  await readSummaryPage('invoiced', period, 2, new AbortController().signal);
  const [url, options] = fetcher.mock.calls[0];
  expect(url.pathname).toBe('/api.xro/2.0/Invoices');
  expect(url.searchParams.get('page')).toBe('2');
  expect(url.searchParams.get('pageSize')).toBe('250');
  expect(url.searchParams.get('where')).toContain('Date<DateTime(2026,9,17)');
  expect(options).toMatchObject({ method: 'GET', redirect: 'error', cache: 'no-store' });
  expect(summaryQuery('outstanding', period).where).not.toContain('Date');
  expect(summaryQuery('receipts', period).where).toContain('ACCRECPAYMENT');
});
it('denies missing scopes, invalid periods and excessive pages before provider access', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  mocks.access.mockResolvedValue({ scopes: ['accounting.invoices'] });
  await expect(readSummaryPage('receipts', period, 1, new AbortController().signal)).rejects.toThrow();
  await expect(readSummaryPage('invoiced', { ...period, from: 'DateTime(1)' }, 1, new AbortController().signal)).rejects.toThrow();
  await expect(readSummaryPage('invoiced', period, 11, new AbortController().signal)).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
it('rejects provider errors and malformed pages without exposing the provider body', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('private customer details', { status: 429 })); vi.stubGlobal('fetch', fetcher);
  await expect(readSummaryPage('invoiced', period, 1, new AbortController().signal)).rejects.toThrow('SUMMARY_UNAVAILABLE');
  fetcher.mockResolvedValue(Response.json({ Invoices: {} }));
  await expect(readSummaryPage('invoiced', period, 1, new AbortController().signal)).rejects.toThrow('SUMMARY_UNAVAILABLE');
});
