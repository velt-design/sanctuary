// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/api/staffApi', () => ({ requireStaffContext: vi.fn(), jsonOk: (v: unknown) => Response.json(v), jsonError: (error: string, status: number) => Response.json({ error }, { status }) }));
vi.mock('@/lib/marketingIntegrations/meta/staffRead', () => ({ readStaffMeta: vi.fn() }));
import { requireStaffContext } from '@/lib/api/staffApi';
import { readStaffMeta } from '@/lib/marketingIntegrations/meta/staffRead';
import { GET } from './route';
const staff = vi.mocked(requireStaffContext), read = vi.mocked(readStaffMeta);
beforeEach(() => { vi.resetAllMocks(); staff.mockResolvedValue({ ok: true, session: { user: { email: 'jordan@sanctuarypergolas.co.nz', email_confirmed_at: '2026-01-01' } } } as never); });
it.each(['anonymous', 'other-staff', 'unverified'])('denies %s before source access', async identity => {
  staff.mockResolvedValue(identity === 'anonymous' ? { ok: false, response: new Response(null, { status: 401 }) } as never
    : { ok: true, session: { user: { email: identity === 'other-staff' ? 'staff@example.test' : 'jordan@sanctuarypergolas.co.nz', email_confirmed_at: identity === 'unverified' ? undefined : '2026-01-01' } } } as never);
  const response = await GET(new Request('https://portal.test/api/staff/v1/marketing-performance/meta'));
  expect(response.status).toBe(identity === 'anonymous' ? 401 : 403);
  expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(read).not.toHaveBeenCalled();
});
it('rejects caller actions or account overrides', async () => {
  expect((await GET(new Request('https://portal.test/api/staff/v1/marketing-performance/meta?action=refresh'))).status).toBe(400);
  expect(read).not.toHaveBeenCalled();
});
it('returns explicit missing evidence and hides raw failures', async () => {
  read.mockResolvedValue({ status: 'missing', checkedAt: new Date().toISOString() });
  const request = new Request('https://portal.test/api/staff/v1/marketing-performance/meta');
  const response = await GET(request); expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ evidence: { status: 'missing' } });
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  read.mockRejectedValue(new Error('private credential details'));
  const failure = await GET(request); expect(failure.status).toBe(503); expect(await failure.text()).not.toContain('credential');
});
