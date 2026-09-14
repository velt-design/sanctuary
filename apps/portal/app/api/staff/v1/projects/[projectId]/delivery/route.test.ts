import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn(), done: vi.fn(), reopen: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/api/staffApi', async (original) => ({ ...await original<typeof import('@/lib/api/staffApi')>(), requireStaffContext: mocks.auth }));
vi.mock('@/lib/projects/deliveryCompletion', () => ({ readDeliveryCompletion: mocks.read }));
vi.mock('@/app/api/staff/v1/schedule/job/mark-done/route', () => ({ POST: mocks.done }));
vi.mock('@/app/api/staff/v1/schedule/job/mark-in-progress/route', () => ({ POST: mocks.reopen }));
import { POST } from './route';
const id = '11111111-1111-4111-8111-111111111111';
const commandId = '22222222-2222-4222-8222-222222222222';
const context = { params: Promise.resolve({ projectId: 'proj_' + id }) };
function request(body: object) { return new Request('https://portal.test/api/delivery', { method: 'POST', body: JSON.stringify({ commandId, action: 'complete', ...body }) }); }
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ ok: true, supabase: { rpc: mocks.rpc } });
  mocks.read.mockResolvedValue({ scheduled: false, completed: false, archived: false });
  mocks.rpc.mockResolvedValue({ data: { completed: true }, error: null });
});
describe('delivery command boundary', () => {
  it('denies unauthenticated calls before reading or writing', async () => {
    mocks.auth.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    expect((await POST(request({}), context)).status).toBe(401);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it('validates manual evidence and commits through the audited RPC', async () => {
    expect((await POST(request({ completedDate: '2026-02-30', note: 'Done' }), context)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
    const response = await POST(request({ completedDate: '2026-01-01', note: 'Collected' }), context);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.rpc).toHaveBeenCalledWith('project_record_delivery_completion', { p_project_id: id, p_command_id: commandId, p_completed_date: '2026-01-01', p_note: 'Collected' });
  });
  it('delegates scheduled completion and preserves the early-finish response', async () => {
    mocks.read.mockResolvedValue({ scheduled: true, completed: false });
    mocks.done.mockResolvedValue(Response.json({ requires_finish_early: true, freed_days: 2 }));
    const response = await POST(request({}), context);
    expect(await response.json()).toEqual({ requires_finish_early: true, freed_days: 2 });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(await mocks.done.mock.calls[0][0].json()).toEqual({ job_id: id });
  });
  it('does not repeat a completed schedule command on an ambiguous retry', async () => {
    mocks.read.mockResolvedValue({ scheduled: true, completed: true });
    expect(await (await POST(request({}), context)).json()).toMatchObject({ ok: true, alreadyCompleted: true });
    expect(mocks.done).not.toHaveBeenCalled();
  });
  it('reopens through the schedule owner and reports database conflicts', async () => {
    mocks.read.mockResolvedValue({ scheduled: true, completed: true });
    mocks.reopen.mockResolvedValue(Response.json({ ok: true }));
    expect((await POST(request({ action: 'reopen' }), context)).status).toBe(200);
    expect(mocks.reopen).toHaveBeenCalledOnce();
    mocks.read.mockRejectedValue({ code: '40001', message: 'Stale project' });
    expect((await POST(request({}), context)).status).toBe(409);
  });
});
