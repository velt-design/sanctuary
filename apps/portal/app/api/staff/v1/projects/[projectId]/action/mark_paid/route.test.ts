import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requireStaffContext: vi.fn(), rpc: vi.fn(), runEvent: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/api/staffApi', () => ({
  requireStaffContext: (...args: unknown[]) => mocks.requireStaffContext(...args),
  jsonError: (message: string, status = 400) => Response.json({ error: message }, { status }),
  jsonOk: (payload: object, status = 200) => Response.json(payload, { status }),
}));
vi.mock('@/lib/supabase/mappers', () => ({ uuidFromAppId: () => 'project-uuid' }));
vi.mock('@/lib/automation/AutomationRunner', () => ({ automationRunner: { runEvent: (...args: unknown[]) => mocks.runEvent(...args) } }));

async function invoke() {
  const { POST } = await import('./route');
  return POST(new Request('http://localhost/action', { method: 'POST' }), {
    params: Promise.resolve({ projectId: 'proj_1' }),
  });
}

describe('mark project paid commercial projection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffContext.mockResolvedValue({ ok: true, supabase: { rpc: mocks.rpc } });
    mocks.rpc.mockResolvedValue({ data: [{ changed: true, paid_date: '2026-08-13' }], error: null });
    mocks.runEvent.mockResolvedValue(undefined);
  });

  it('uses the locked settlement command then emits transition events', async () => {
    expect((await invoke()).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('commercial_mark_project_paid', { p_project_id: 'project-uuid' });
    expect(mocks.runEvent).toHaveBeenCalledTimes(2);
  });

  it('blocks an unsettled accepted balance', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'The accepted job balance is not fully paid or open invoices remain' } });
    expect((await invoke()).status).toBe(409);
    expect(mocks.runEvent).not.toHaveBeenCalled();
  });

  it('treats an already-paid command as an idempotent replay', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ changed: false, paid_date: '2026-08-13' }], error: null });
    const response = await invoke();
    await expect(response.json()).resolves.toEqual({ ok: true, replayed: true });
    expect(mocks.runEvent).not.toHaveBeenCalled();
  });

  it('reports committed settlement success when follow-up automation fails', async () => {
    const error = new Error('automation unavailable');
    mocks.runEvent.mockRejectedValueOnce(error);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await invoke();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, replayed: false });
    expect(spy).toHaveBeenCalledWith('[mark_paid] automation follow-up failed', error);
    spy.mockRestore();
  });
});
