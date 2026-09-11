import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), run: vi.fn(), list: vi.fn(), enabled: vi.fn() }));
vi.mock('@/lib/api/adminApi', async (original) => ({ ...await original<typeof import('@/lib/api/adminApi')>(), requireAdminContext: mocks.auth }));
vi.mock('@/lib/invoices/drafts', () => ({ runInvoiceDraftCommand: mocks.run, listInvoiceDrafts: mocks.list, invoiceDraftCreationEnabled: mocks.enabled }));
import { GET, POST } from './route';
const context = { params: Promise.resolve({ projectId: 'proj_10000000-0000-4000-8000-000000000001' }) };
const request = (body: unknown) => new Request('http://localhost/api/admin/projects/test/invoice-drafts', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ ok: true, supabase: {}, session: { user: { id: 'admin' } } }); mocks.enabled.mockReturnValue(true); });
describe('admin draft route', () => {
  it('rejects staff before accessing draft storage', async () => {
    mocks.auth.mockResolvedValue({ ok: false, response: Response.json({ error: 'Forbidden' }, { status: 403 }) });
    expect((await GET(request({}), context)).status).toBe(403);
    expect((await POST(request({}), context)).status).toBe(403);
    expect(mocks.run).not.toHaveBeenCalled(); expect(mocks.list).not.toHaveBeenCalled();
  });
  it('supports deploying compatible readers before the database expansion', async () => {
    mocks.enabled.mockReturnValue(false);
    const response = await GET(request({}), context);
    expect(await response.json()).toEqual({ enabled: false, drafts: [] });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it('requires a stable issue identifier and reports stale revisions as conflicts', async () => {
    expect((await POST(request({ action: 'issue' }),context)).status).toBe(400);
    mocks.run.mockRejectedValue({ code: '40001', message: 'Draft changed; reload before issuing' });
    const response = await POST(request({ action: 'issue', commandId: '50000000-0000-4000-8000-000000000001' }),context);
    expect(response.status).toBe(409);
  });
});
