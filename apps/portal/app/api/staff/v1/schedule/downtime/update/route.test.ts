import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSession = vi.fn();
const parseJsonBody = vi.fn();

const buildCrewContext = vi.fn();
const buildJobMetaMap = vi.fn();
const computeCommitImpacts = vi.fn();
const formatCrewScheduleBlocks = vi.fn();
const isMissingSchemaError = vi.fn();
const loadScheduleContext = vi.fn();
const recomputeForCrew = vi.fn();

const downtimeMaybeSingle = vi.fn();
const rpc = vi.fn();

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return {
    ...actual,
    parseJsonBody,
    requireStaffSession,
  };
});

vi.mock('@/lib/scheduling/scheduleV2Server', () => ({
  buildCrewContext,
  buildJobMetaMap,
  computeCommitImpacts,
  formatCrewScheduleBlocks,
  isMissingSchemaError,
  loadScheduleContext,
  recomputeForCrew,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServer: {
    from: (table: string) => {
      if (table !== 'crew_downtimes') throw new Error(`Unexpected table ${table}`);
      return {
        select: () => ({
          eq: (column: string) => {
            if (column !== 'id') throw new Error(`Unexpected select eq column ${column}`);
            return { maybeSingle: downtimeMaybeSingle };
          },
        }),
      };
    },
    rpc,
  },
}));

describe('POST /api/staff/v1/schedule/downtime/update', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffSession.mockReset();
    parseJsonBody.mockReset();
    buildCrewContext.mockReset();
    buildJobMetaMap.mockReset();
    computeCommitImpacts.mockReset();
    formatCrewScheduleBlocks.mockReset();
    isMissingSchemaError.mockReset();
    loadScheduleContext.mockReset();
    recomputeForCrew.mockReset();
    downtimeMaybeSingle.mockReset();
    rpc.mockReset();

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });
    parseJsonBody.mockResolvedValue({ ok: true, body: { downtime_id: 'dt-1', duration_days: 3, reason: 'TRAVEL', note: ' Buffer ' } });
    isMissingSchemaError.mockReturnValue(false);
    downtimeMaybeSingle.mockResolvedValue({ data: { id: 'dt-1', crew_id: 'crew-1' }, error: null });
    loadScheduleContext.mockResolvedValue({ today: '2026-04-10', calendar: {} });
    buildCrewContext.mockReturnValue({
      crewRow: { id: 'crew-1', calendar_region: 'Auckland' },
      items: [{ id: 'item-1' }],
      jobs: [{ id: 'job-1' }],
      downtimes: [{ id: 'dt-1', durationDays: 1, reason: 'site', note: 'Old note' }],
      recompute: { before: true },
      downtimesById: new Map([['dt-1', { id: 'dt-1', durationDays: 1 }]]),
      jobsById: new Map([['job-1', { id: 'job-1' }]]),
    });
    recomputeForCrew.mockReturnValue({
      job_updates: [
        {
          id: 'job-update-1',
          forecast_start: '2026-04-12',
          forecast_end_exclusive: '2026-04-15',
          forecast_duration_days: 3,
        },
      ],
    });
    buildJobMetaMap.mockReturnValue(new Map());
    computeCommitImpacts.mockReturnValue([]);
    formatCrewScheduleBlocks.mockReturnValue({
      crew_id: 'crew-1',
      items: [{ id: 'item-1' }],
      conflicts: [],
      next_available_date: '2026-04-14',
    });
    rpc.mockResolvedValue({
      data: { updated_downtime: 'dt-1', updated_forecasts: 1 },
      error: null,
    });
  });

  it('returns 401 when staff auth is missing', async () => {
    requireStaffSession.mockResolvedValueOnce(null);

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/downtime/update', { method: 'POST' }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 when downtime_id is missing', async () => {
    parseJsonBody.mockResolvedValueOnce({ ok: true, body: { duration_days: 2 } });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/downtime/update', { method: 'POST' }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'downtime_id is required' });
  });

  it('returns 404 when the downtime row is missing', async () => {
    downtimeMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/downtime/update', { method: 'POST' }));

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Downtime not found' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns confirmation before any RPC call', async () => {
    computeCommitImpacts.mockReturnValueOnce([{ job_id: 'job-1' }]);

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/downtime/update', {
        method: 'POST',
        headers: { 'x-request-id': 'req_downtime_update_confirm' },
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      requires_confirmation: true,
      impacts: [{ job_id: 'job-1' }],
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(res.headers.get('x-portal-request-id')).toBe('req_downtime_update_confirm');
  });

  it('commits downtime updates through one RPC call on success', async () => {
    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/downtime/update', {
        method: 'POST',
        headers: { 'x-request-id': 'req_downtime_update_ok' },
      }),
    );

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('schedule_v2_update_downtime', {
      p_downtime_id: 'dt-1',
      p_patch: {
        duration_days: 3,
        reason: 'travel',
        note: 'Buffer',
      },
      p_forecast_updates: [
        {
          id: 'job-update-1',
          forecast_start: '2026-04-12',
          forecast_end_exclusive: '2026-04-15',
          forecast_duration_days: 3,
        },
      ],
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      crew_id: 'crew-1',
      schedule: {
        crew_id: 'crew-1',
        items: [{ id: 'item-1' }],
        conflicts: [],
        next_available_date: '2026-04-14',
      },
      conflicts: [],
      next_available_date: '2026-04-14',
    });
    expect(res.headers.get('x-portal-request-id')).toBe('req_downtime_update_ok');
  });

  it('returns 501 when the command function is missing', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.schedule_v2_update_downtime' } });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/downtime/update', {
        method: 'POST',
        headers: { 'x-request-id': 'req_downtime_update_schema' },
      }),
    );

    expect(res.status).toBe(501);
    await expect(res.json()).resolves.toEqual({
      error: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.',
    });
    expect(res.headers.get('x-portal-request-id')).toBe('req_downtime_update_schema');
  });

  it('returns 500 on a generic RPC failure', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'update failed' } });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/downtime/update', {
        method: 'POST',
        headers: { 'x-request-id': 'req_downtime_update_fail' },
      }),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to update downtime' });
    expect(res.headers.get('x-portal-request-id')).toBe('req_downtime_update_fail');
  });
});
