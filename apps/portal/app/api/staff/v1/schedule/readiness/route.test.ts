import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSession = vi.fn();
const verifyScheduleReadiness = vi.fn();

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return {
    ...actual,
    requireStaffSession,
  };
});

vi.mock('@/lib/scheduling/scheduleReadiness', () => ({
  REQUIRED_SCHEDULE_RPC_FUNCTIONS: ['schedule_v2_reorder_queue', 'schedule_v2_update_downtime'],
  verifyScheduleReadiness,
}));

describe('GET /api/staff/v1/schedule/readiness', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffSession.mockReset();
    verifyScheduleReadiness.mockReset();
    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });
  });

  it('returns 401 when unauthorized', async () => {
    requireStaffSession.mockResolvedValueOnce(null);

    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/staff/v1/schedule/readiness'));

    expect(res.status).toBe(401);
    expect(res.headers.get('x-portal-request-id')).toBeTruthy();
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(verifyScheduleReadiness).not.toHaveBeenCalled();
  });

  it('returns 200 when the schedule read path and RPC contract are ready', async () => {
    verifyScheduleReadiness.mockResolvedValueOnce({
      ok: true,
      missingFunctions: [],
      readinessChecks: [
        { kind: 'read', name: 'loadScheduleContext', ok: true },
        { kind: 'rpc', name: 'schedule_v2_reorder_queue', ok: true },
      ],
    });

    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/staff/v1/schedule/readiness'));

    expect(res.status).toBe(200);
    expect(res.headers.get('x-portal-request-id')).toBeTruthy();
    expect(res.headers.get('server-timing')).toContain('total;dur=');
    await expect(res.json()).resolves.toEqual({
      ok: true,
      checked_at: expect.any(String),
      required_functions: ['schedule_v2_reorder_queue', 'schedule_v2_update_downtime'],
    });
  });

  it('returns 501 and names missing required functions when RPCs are absent', async () => {
    verifyScheduleReadiness.mockResolvedValueOnce({
      ok: false,
      missingFunctions: ['schedule_v2_update_downtime'],
      readinessChecks: [{ kind: 'rpc', name: 'schedule_v2_update_downtime', ok: false, detail: 'missing function' }],
      message: 'Schedule schema is not upgraded yet. Missing required functions: schedule_v2_update_downtime. Run latest schedule migrations then refresh.',
    });

    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/staff/v1/schedule/readiness'));

    expect(res.status).toBe(501);
    expect(res.headers.get('x-portal-request-id')).toBeTruthy();
    await expect(res.json()).resolves.toEqual({
      error: 'Schedule schema is not upgraded yet. Missing required functions: schedule_v2_update_downtime. Run latest schedule migrations then refresh.',
    });
  });

  it('returns 501 when the schedule read model is not upgraded', async () => {
    verifyScheduleReadiness.mockResolvedValueOnce({
      ok: false,
      missingFunctions: [],
      readinessChecks: [{ kind: 'read', name: 'loadScheduleContext', ok: false, detail: 'missing schema' }],
      message: 'Schedule schema/read model is not upgraded yet. Run latest schedule migrations then refresh.',
    });

    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/staff/v1/schedule/readiness'));

    expect(res.status).toBe(501);
    expect(res.headers.get('x-portal-request-id')).toBeTruthy();
    await expect(res.json()).resolves.toEqual({
      error: 'Schedule schema/read model is not upgraded yet. Run latest schedule migrations then refresh.',
    });
  });

  it('returns 500 on unexpected verifier failures', async () => {
    verifyScheduleReadiness.mockRejectedValueOnce(new Error('boom'));

    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/staff/v1/schedule/readiness'));

    expect(res.status).toBe(500);
    expect(res.headers.get('x-portal-request-id')).toBeTruthy();
    await expect(res.json()).resolves.toEqual({
      error: 'Failed to verify schedule readiness',
    });
  });
});
