import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), origin: vi.fn(), summary: vi.fn() }));
vi.mock('./pilotAccess', () => ({ getPaymentPilotSession: mocks.session }));
vi.mock('./http', () => ({ sameOrigin: mocks.origin, json: (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } }) }));
vi.mock('./financeSummary', () => ({ readFinanceSummary: mocks.summary }));
import { POST } from '../../app/api/payments/xero/summary/route';
const period = { from: '2026-09-10', to: '2026-09-16' };
const request = (body: unknown) => new Request('https://portal.test/api/payments/xero/summary', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); mocks.session.mockResolvedValue({ user: { id: 'finance' } }); mocks.origin.mockReturnValue(true); });
it('denies missing finance permission and cross-origin calls before any summary reads', async () => {
  mocks.session.mockResolvedValueOnce(null);
  expect((await POST(request(period))).status).toBe(403);
  mocks.origin.mockReturnValueOnce(false);
  expect((await POST(request(period))).status).toBe(403);
  expect(mocks.summary).not.toHaveBeenCalled();
});
it.each([{ ...period, tenantId: 'other' }, { ...period, from: '2026-02-30' }, { from: '2020-01-01', to: '2026-09-16' }, { from: 'x'.repeat(250), to: period.to }])('rejects invalid scope or dates before reads', async body => {
  expect((await POST(request(body))).status).toBe(400);
  expect(mocks.summary).not.toHaveBeenCalled();
});
it('returns a complete private summary and never leaks provider errors or partial totals', async () => {
  mocks.summary.mockResolvedValueOnce({ complete: true, currencies: [] });
  const response = await POST(request(period));
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.json()).toEqual({ complete: true, currencies: [] });
  mocks.summary.mockRejectedValueOnce(new Error('secret provider data'));
  const failed = await POST(request(period));
  expect(failed.status).toBe(503);
  expect(JSON.stringify(await failed.json())).not.toContain('secret');
});
