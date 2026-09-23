import { expect, it, vi } from 'vitest';
import { readPositionPage, type PositionRead } from './financePositionProvider';
import { XERO_SCOPES } from './security';
const tenantId = '10000000-0000-4000-8000-000000000001';
const input: PositionRead = { family: 'profitAndLoss', tenantId, page: 1, query: { from: '2026-09-01', to: '2026-09-23', basis: 'cash' } };
function fixture(scopes = ['accounting.reports.profitandloss.read']) {
  return { config: () => ({ tenantId }) as ReturnType<typeof import('./security').config>,
    access: vi.fn(async () => ({ accessToken: 'synthetic', refreshToken: 'synthetic', expiresAt: Date.now() + 60000, scopes })),
    fetch: vi.fn(async () => Response.json({ Reports: [] })) as unknown as typeof fetch };
}
it('uses fixed GET reports and exact tenant/date/basis; no caller-controlled paths or report layout', async () => {
  const deps = fixture(); await readPositionPage(input, new AbortController().signal, deps);
  const [url, options] = vi.mocked(deps.fetch).mock.calls[0];
  expect(String(url)).toContain('https://api.xero.com/api.xro/2.0/Reports/ProfitAndLoss?');
  expect(new URL(String(url)).searchParams.get('standardLayout')).toBe('true');
  expect(new URL(String(url)).searchParams.get('paymentsOnly')).toBe('true');
  expect(options).toMatchObject({ method: 'GET', redirect: 'error', cache: 'no-store', headers: { 'Xero-tenant-id': tenantId } });
});
it('missing reports scope makes no provider call while legacy invoice scopes still work', async () => {
  const deps = fixture(XERO_SCOPES.split(' '));
  await expect(readPositionPage(input, new AbortController().signal, deps)).rejects.toMatchObject({ reason: 'missing_scope' }); expect(deps.fetch).not.toHaveBeenCalled();
  vi.mocked(deps.fetch).mockResolvedValue(Response.json({ Invoices: [] }));
  await readPositionPage({ ...input, family: 'payables' }, new AbortController().signal, deps);
  const url = new URL(String(vi.mocked(deps.fetch).mock.calls[0][0])); expect(url.searchParams.get('where')).toBe('Type=="ACCPAY"&&Status=="AUTHORISED"&&AmountDue>0');
  expect(url.searchParams.get('pageSize')).toBe('100');
});
it('denies mismatched tenant and invalid pages before credentials', async () => {
  const deps = fixture();
  await expect(readPositionPage({ ...input, tenantId: 'other' }, new AbortController().signal, deps)).rejects.toThrow();
  await expect(readPositionPage({ ...input, page: 52 }, new AbortController().signal, deps)).rejects.toThrow(); expect(deps.access).not.toHaveBeenCalled();
});
it('403, malformed and oversized responses remain unavailable, never empty success', async () => {
  for (const [response, reason] of [[new Response('', { status: 403 }), 'provider_denied'], [Response.json({ Reports: null }), 'invalid_response'],
    [new Response('x'.repeat(2 * 1024 * 1024 + 1)), 'limit_exceeded']] as const) {
    const deps = fixture(); vi.mocked(deps.fetch).mockResolvedValue(response);
    await expect(readPositionPage(input, new AbortController().signal, deps)).rejects.toMatchObject({ reason });
  }
});
it('caller cancellation stops before credential access', async () => {
  const deps = fixture(), abort = new AbortController(); abort.abort();
  await expect(readPositionPage(input, abort.signal, deps)).rejects.toThrow(); expect(deps.access).not.toHaveBeenCalled();
});
