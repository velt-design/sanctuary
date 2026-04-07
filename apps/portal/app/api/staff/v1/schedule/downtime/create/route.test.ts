import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSession = vi.fn();
const parseJsonBody = vi.fn();

const applyScheduleItemPositions = vi.fn();
const buildCrewContext = vi.fn();
const buildJobMetaMap = vi.fn();
const computeCommitImpacts = vi.fn();
const formatCrewScheduleBlocks = vi.fn();
const insertItemAtPosition = vi.fn();
const isMissingSchemaError = vi.fn();
const loadScheduleContext = vi.fn();
const recomputeForCrew = vi.fn();

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
  applyScheduleItemPositions,
  buildCrewContext,
  buildJobMetaMap,
  computeCommitImpacts,
  formatCrewScheduleBlocks,
  insertItemAtPosition,
  isMissingSchemaError,
  loadScheduleContext,
  recomputeForCrew,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServer: {
    rpc,
  },
}));

describe('POST /api/staff/v1/schedule/downtime/create', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffSession.mockReset();
    parseJsonBody.mockReset();
    applyScheduleItemPositions.mockReset();
    buildCrewContext.mockReset();
    buildJobMetaMap.mockReset();
    computeCommitImpacts.mockReset();
    formatCrewScheduleBlocks.mockReset();
    insertItemAtPosition.mockReset();
    isMissingSchemaError.mockReset();
    loadScheduleContext.mockReset();
    recomputeForCrew.mockReset();
    rpc.mockReset();

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: { crew_id: 'crew-1', position: 1, duration_days: 2, reason: 'weather', note: 'Storm delay' },
    });
    isMissingSchemaError.mockReturnValue(false);
    loadScheduleContext.mockResolvedValue({ today: '2026-04-10', calendar: {} });
    buildCrewContext.mockReturnValue({
      crewRow: { id: 'crew-1', calendar_region: 'Auckland' },
      items: [{ id: 'item-1', crewId: 'crew-1', itemType: 'job', jobId: 'job-1', downtimeId: null, position: 0 }],
      jobs: [{ id: 'job-1' }],
      downtimes: [],
      recompute: { before: true },
      jobsById: new Map([['job-1', { id: 'job-1' }]]),
    });
    insertItemAtPosition.mockImplementation((items: any[], item: any, position: number) => {
      const next = items.slice();
      next.splice(position, 0, { ...item });
      return next.map((entry, index) => ({ ...entry, position: index }));
    });
    applyScheduleItemPositions.mockImplementation((items: Array<{ id: string; position: number }>) =>
      items.map((item) => ({ id: item.id, position: item.position })),
    );
    recomputeForCrew.mockReturnValue({
      job_updates: [{ id: 'job-1', forecast_start: '2026-04-15', forecast_end_exclusive: '2026-04-17', forecast_duration_days: 2 }],
    });
    buildJobMetaMap.mockReturnValue(new Map());
    computeCommitImpacts.mockReturnValue([]);
    formatCrewScheduleBlocks.mockReturnValue({
      crew_id: 'crew-1',
      items: [{ id: 'item-dt-1' }],
      conflicts: [],
      next_available_date: '2026-04-18',
    });
    rpc.mockResolvedValue({
      data: {
        downtime_id: 'dt-1',
        schedule_item_id: 'item-dt-1',
        updated_items: 1,
        updated_forecasts: 1,
      },
      error: null,
    });
  });

  it('returns 401 when staff auth is missing', async () => {
    requireStaffSession.mockResolvedValueOnce(null);

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/downtime/create', { method: 'POST' }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 when crew_id is missing', async () => {
    parseJsonBody.mockResolvedValueOnce({ ok: true, body: {} });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/downtime/create', { method: 'POST' }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'crew_id is required' });
  });

  it('returns confirmation before any RPC call', async () => {
    computeCommitImpacts.mockReturnValueOnce([{ job_id: 'job-1' }]);

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/downtime/create', {
        method: 'POST',
        headers: { 'x-request-id': 'req_dt_create_confirm' },
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      requires_confirmation: true,
      impacts: [{ job_id: 'job-1' }],
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(res.headers.get('x-portal-request-id')).toBe('req_dt_create_confirm');
  });

  it('commits downtime create through one RPC call on success', async () => {
    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/downtime/create', {
        method: 'POST',
        headers: { 'x-request-id': 'req_dt_create_ok' },
      }),
    );

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('schedule_v2_create_downtime', {
      p_crew_id: 'crew-1',
      p_duration_days: 2,
      p_reason: 'weather',
      p_note: 'Storm delay',
      p_insert_position: 1,
      p_positions: [{ id: 'item-1', position: 0 }],
      p_forecast_updates: [
        {
          id: 'job-1',
          forecast_start: '2026-04-15',
          forecast_end_exclusive: '2026-04-17',
          forecast_duration_days: 2,
        },
      ],
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      crew_id: 'crew-1',
      schedule: {
        crew_id: 'crew-1',
        items: [{ id: 'item-dt-1' }],
        conflicts: [],
        next_available_date: '2026-04-18',
      },
      conflicts: [],
      next_available_date: '2026-04-18',
    });
    expect(res.headers.get('x-portal-request-id')).toBe('req_dt_create_ok');
  });

  it('returns 501 when the command function is missing', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.schedule_v2_create_downtime' } });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/downtime/create', {
        method: 'POST',
        headers: { 'x-request-id': 'req_dt_create_schema' },
      }),
    );

    expect(res.status).toBe(501);
    await expect(res.json()).resolves.toEqual({
      error: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.',
    });
    expect(res.headers.get('x-portal-request-id')).toBe('req_dt_create_schema');
  });

  it('returns 500 on a generic RPC failure', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/downtime/create', {
        method: 'POST',
        headers: { 'x-request-id': 'req_dt_create_fail' },
      }),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to create downtime' });
    expect(res.headers.get('x-portal-request-id')).toBe('req_dt_create_fail');
  });
});
