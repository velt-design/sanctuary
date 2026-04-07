import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const parseJsonBody = vi.fn();

const applyScheduleItemPositions = vi.fn();
const buildCrewContext = vi.fn();
const buildJobMetaMap = vi.fn();
const computeCommitImpacts = vi.fn();
const formatCrewScheduleBlocks = vi.fn();
const isMissingSchemaError = vi.fn();
const loadScheduleContext = vi.fn();
const removeItem = vi.fn();
const recomputeForCrew = vi.fn();

const downtimeMaybeSingle = vi.fn();
const rpc = vi.fn();

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return {
    ...actual,
    parseJsonBody,
    requireStaffContext,
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
  removeItem,
  recomputeForCrew,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServiceRole: {
    rpc,
  },
}));

describe('POST /api/staff/v1/schedule/downtime/delete', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffContext.mockReset();
    parseJsonBody.mockReset();
    applyScheduleItemPositions.mockReset();
    buildCrewContext.mockReset();
    buildJobMetaMap.mockReset();
    computeCommitImpacts.mockReset();
    formatCrewScheduleBlocks.mockReset();
    isMissingSchemaError.mockReset();
    loadScheduleContext.mockReset();
    removeItem.mockReset();
    recomputeForCrew.mockReset();
    downtimeMaybeSingle.mockReset();
    rpc.mockReset();

    requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { email: 'ops@example.com' }, role: 'staff' },
      supabase: {
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
      },
    });
    parseJsonBody.mockResolvedValue({ ok: true, body: { downtime_id: 'dt-1' } });
    isMissingSchemaError.mockReturnValue(false);
    downtimeMaybeSingle.mockResolvedValue({ data: { id: 'dt-1', crew_id: 'crew-1' }, error: null });
    loadScheduleContext.mockResolvedValue({ today: '2026-04-10', calendar: {} });
    buildCrewContext.mockReturnValue({
      crewRow: { id: 'crew-1', calendar_region: 'Auckland' },
      items: [
        { id: 'item-dt-1', itemType: 'downtime', downtimeId: 'dt-1', position: 0 },
        { id: 'item-job-1', itemType: 'job', jobId: 'scheduled-job-1', position: 1 },
      ],
      jobs: [{ id: 'scheduled-job-1' }],
      downtimes: [{ id: 'dt-1' }],
      recompute: { before: true },
      jobsById: new Map([['scheduled-job-1', { id: 'scheduled-job-1' }]]),
    });
    removeItem.mockReturnValue([{ id: 'item-job-1', itemType: 'job', jobId: 'scheduled-job-1', position: 0 }]);
    applyScheduleItemPositions.mockReturnValue([{ id: 'item-job-1', position: 0 }]);
    recomputeForCrew.mockReturnValue({ job_updates: [{ id: 'scheduled-job-1', forecast_start: '2026-04-11', forecast_end_exclusive: '2026-04-12', forecast_duration_days: 1 }] });
    buildJobMetaMap.mockReturnValue(new Map());
    computeCommitImpacts.mockReturnValue([]);
    formatCrewScheduleBlocks.mockReturnValue({
      crew_id: 'crew-1',
      items: [{ id: 'item-job-1' }],
      conflicts: [],
      next_available_date: '2026-04-14',
    });
    rpc.mockResolvedValue({ data: { deleted_downtime: 'dt-1' }, error: null });
  });

  it('commits downtime delete through one RPC call on success', async () => {
    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/downtime/delete', {
        method: 'POST',
        headers: { 'x-request-id': 'req_downtime_delete_ok' },
      }),
    );

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('schedule_v2_delete_downtime', {
      p_downtime_id: 'dt-1',
      p_downtime_item_id: 'item-dt-1',
      p_positions: [{ id: 'item-job-1', position: 0 }],
      p_forecast_updates: [
        { id: 'scheduled-job-1', forecast_start: '2026-04-11', forecast_end_exclusive: '2026-04-12', forecast_duration_days: 1 },
      ],
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      crew_id: 'crew-1',
      schedule: {
        crew_id: 'crew-1',
        items: [{ id: 'item-job-1' }],
        conflicts: [],
        next_available_date: '2026-04-14',
      },
      conflicts: [],
      next_available_date: '2026-04-14',
    });
    expect(res.headers.get('x-portal-request-id')).toBe('req_downtime_delete_ok');
  });

  it('returns confirmation before any RPC call', async () => {
    computeCommitImpacts.mockReturnValue([{ job_id: 'scheduled-job-1' }]);

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/downtime/delete', { method: 'POST' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      requires_confirmation: true,
      impacts: [{ job_id: 'scheduled-job-1' }],
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns 404 before any RPC call when the downtime is absent', async () => {
    downtimeMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/downtime/delete', { method: 'POST' }));

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Downtime not found' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns 501 when the command function is missing', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.schedule_v2_delete_downtime' } });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/downtime/delete', {
        method: 'POST',
        headers: { 'x-request-id': 'req_downtime_delete_schema' },
      }),
    );

    expect(res.status).toBe(501);
    await expect(res.json()).resolves.toEqual({
      error: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.',
    });
    expect(res.headers.get('x-portal-request-id')).toBe('req_downtime_delete_schema');
  });

  it('returns 500 on a generic RPC failure', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'rpc failed' } });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/downtime/delete', {
        method: 'POST',
        headers: { 'x-request-id': 'req_downtime_delete_fail' },
      }),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to delete downtime' });
    expect(res.headers.get('x-portal-request-id')).toBe('req_downtime_delete_fail');
  });
});
