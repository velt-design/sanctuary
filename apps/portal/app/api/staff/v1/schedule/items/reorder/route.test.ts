import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSession = vi.fn();
const parseJsonBody = vi.fn();

const applyScheduleItemPositions = vi.fn();
const buildCrewContext = vi.fn();
const buildJobMetaMap = vi.fn();
const computeCommitImpacts = vi.fn();
const formatCrewScheduleBlocks = vi.fn();
const isMissingSchemaError = vi.fn();
const loadScheduleContext = vi.fn();
const reorderItems = vi.fn();
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
  isMissingSchemaError,
  loadScheduleContext,
  reorderItems,
  recomputeForCrew,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServer: {
    rpc,
  },
  supabaseServiceRole: {
    rpc,
  },
}));

describe('POST /api/staff/v1/schedule/items/reorder', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    requireStaffSession.mockReset();
    parseJsonBody.mockReset();
    applyScheduleItemPositions.mockReset();
    buildCrewContext.mockReset();
    buildJobMetaMap.mockReset();
    computeCommitImpacts.mockReset();
    formatCrewScheduleBlocks.mockReset();
    isMissingSchemaError.mockReset();
    loadScheduleContext.mockReset();
    reorderItems.mockReset();
    recomputeForCrew.mockReset();
    rpc.mockReset();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });
    parseJsonBody.mockResolvedValue({ ok: true, body: { crew_id: 'crew-1', ordered_item_ids: ['item-2', 'item-1'] } });
    isMissingSchemaError.mockReturnValue(false);
    loadScheduleContext.mockResolvedValue({ today: '2026-04-10', calendar: {} });
    buildCrewContext.mockReturnValue({
      crewRow: { id: 'crew-1', calendar_region: 'Auckland' },
      items: [
        { id: 'item-1', position: 0 },
        { id: 'item-2', position: 1 },
      ],
      jobs: [{ id: 'job-1' }],
      downtimes: [],
      recompute: { before: true },
      jobsById: new Map([['job-1', { id: 'job-1' }]]),
      downtimesById: new Map(),
    });
    reorderItems.mockReturnValue([
      { id: 'item-2', position: 0 },
      { id: 'item-1', position: 1 },
    ]);
    applyScheduleItemPositions.mockReturnValue([
      { id: 'item-2', position: 0 },
      { id: 'item-1', position: 1 },
    ]);
    recomputeForCrew.mockReturnValue({ job_updates: [{ id: 'job-update-1', forecast_start: '2026-04-14', forecast_end_exclusive: '2026-04-16', forecast_duration_days: 2 }] });
    buildJobMetaMap.mockReturnValue(new Map());
    computeCommitImpacts.mockReturnValue([]);
    formatCrewScheduleBlocks.mockReturnValue({
      crew_id: 'crew-1',
      items: [{ id: 'item-2' }],
      conflicts: [],
      next_available_date: '2026-04-14',
    });
    rpc.mockResolvedValue({ data: { updated_items: 2, updated_forecasts: 1 }, error: null });
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('commits the reorder through one RPC call on success', async () => {
    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/items/reorder', {
        method: 'POST',
        headers: { 'x-request-id': 'req_reorder_ok' },
      }),
    );

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('schedule_v2_reorder_queue', {
      p_crew_id: 'crew-1',
      p_positions: [
        { id: 'item-2', position: 0 },
        { id: 'item-1', position: 1 },
      ],
      p_forecast_updates: [
        {
          id: 'job-update-1',
          forecast_start: '2026-04-14',
          forecast_end_exclusive: '2026-04-16',
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
        items: [{ id: 'item-2' }],
        conflicts: [],
        next_available_date: '2026-04-14',
      },
      conflicts: [],
      next_available_date: '2026-04-14',
    });
    expect(res.headers.get('x-portal-request-id')).toBe('req_reorder_ok');
  });

  it('returns confirmation before any RPC call', async () => {
    computeCommitImpacts.mockReturnValue([{ job_id: 'job-1' }]);

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/items/reorder', {
        method: 'POST',
        headers: { 'x-request-id': 'req_reorder_confirm' },
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      requires_confirmation: true,
      impacts: [{ job_id: 'job-1' }],
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(res.headers.get('x-portal-request-id')).toBe('req_reorder_confirm');
  });

  it('logs validation failures with route diagnostics', async () => {
    parseJsonBody.mockResolvedValueOnce({ ok: true, body: { ordered_item_ids: ['item-2', 'item-1'] } });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/items/reorder', {
        method: 'POST',
        headers: { 'x-request-id': 'req_reorder_validation' },
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'crew_id is required' });
    expect(warnSpy).toHaveBeenCalledWith(
      '[portal]',
      expect.objectContaining({
        event: 'schedule.reorder.validation_failed',
        requestId: 'req_reorder_validation',
        route: '/api/staff/v1/schedule/items/reorder',
        method: 'POST',
        status: 400,
        reason: 'missing_crew_id',
      }),
    );
  });

  it('returns 501 when the command function is missing', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.schedule_v2_reorder_queue' } });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/items/reorder', {
        method: 'POST',
        headers: { 'x-request-id': 'req_reorder_schema' },
      }),
    );

    expect(res.status).toBe(501);
    await expect(res.json()).resolves.toEqual({
      error: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.',
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(res.headers.get('x-portal-request-id')).toBe('req_reorder_schema');
  });

  it('returns 500 on a generic RPC failure', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/items/reorder', {
        method: 'POST',
        headers: { 'x-request-id': 'req_reorder_fail' },
      }),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to reorder schedule items' });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(res.headers.get('x-portal-request-id')).toBe('req_reorder_fail');
    expect(warnSpy).toHaveBeenCalledWith(
      '[portal]',
      expect.objectContaining({
        event: 'schedule.reorder.commit_failed',
        requestId: 'req_reorder_fail',
        route: '/api/staff/v1/schedule/items/reorder',
        method: 'POST',
        status: 500,
        message: 'Failed to reorder schedule items',
        errorMessage: 'boom',
        crewId: 'crew-1',
        positionCount: 2,
        forecastUpdateCount: 1,
      }),
    );
  });
});
