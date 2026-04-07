import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSession = vi.fn();
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

const scheduledJobsByProjectMaybeSingle = vi.fn();
const scheduledJobsByIdMaybeSingle = vi.fn();
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
  removeItem,
  recomputeForCrew,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServer: {
    from: (table: string) => {
      if (table !== 'scheduled_jobs') throw new Error(`Unexpected table ${table}`);
      return {
        select: () => ({
          eq: (column: string) => {
            if (column === 'job_id') return { maybeSingle: scheduledJobsByProjectMaybeSingle };
            if (column === 'id') return { maybeSingle: scheduledJobsByIdMaybeSingle };
            throw new Error(`Unexpected eq column ${column}`);
          },
        }),
      };
    },
    rpc,
  },
  supabaseServiceRole: {
    rpc,
  },
}));

describe('POST /api/staff/v1/schedule/job/unassign', () => {
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
    removeItem.mockReset();
    recomputeForCrew.mockReset();
    scheduledJobsByProjectMaybeSingle.mockReset();
    scheduledJobsByIdMaybeSingle.mockReset();
    rpc.mockReset();

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });
    parseJsonBody.mockResolvedValue({ ok: true, body: { job_id: 'job-1' } });
    isMissingSchemaError.mockReturnValue(false);
    scheduledJobsByProjectMaybeSingle.mockResolvedValue({ data: { id: 'scheduled-job-1', crew_id: 'crew-1' }, error: null });
    loadScheduleContext.mockResolvedValue({ today: '2026-04-10', calendar: {} });
    buildCrewContext.mockReturnValue({
      crewRow: { id: 'crew-1', calendar_region: 'Auckland' },
      items: [
        { id: 'item-job-1', itemType: 'job', jobId: 'scheduled-job-1', position: 0 },
        { id: 'item-job-2', itemType: 'job', jobId: 'scheduled-job-2', position: 1 },
      ],
      jobs: [{ id: 'scheduled-job-1' }, { id: 'scheduled-job-2' }],
      downtimes: [],
      recompute: { before: true },
      downtimesById: new Map(),
    });
    removeItem.mockReturnValue([{ id: 'item-job-2', itemType: 'job', jobId: 'scheduled-job-2', position: 0 }]);
    applyScheduleItemPositions.mockReturnValue([{ id: 'item-job-2', position: 0 }]);
    recomputeForCrew.mockReturnValue({ job_updates: [{ id: 'scheduled-job-2', forecast_start: '2026-04-11', forecast_end_exclusive: '2026-04-12', forecast_duration_days: 1 }] });
    buildJobMetaMap.mockReturnValue(new Map());
    computeCommitImpacts.mockReturnValue([]);
    formatCrewScheduleBlocks.mockReturnValue({
      crew_id: 'crew-1',
      items: [{ id: 'item-job-2' }],
      conflicts: [],
      next_available_date: '2026-04-14',
    });
    rpc.mockResolvedValue({ data: { deleted_job: 'scheduled-job-1' }, error: null });
  });

  it('commits unassign through one RPC call on success', async () => {
    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/unassign', {
        method: 'POST',
        headers: { 'x-request-id': 'req_unassign_ok' },
      }),
    );

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('schedule_v2_unassign_job', {
      p_scheduled_job_id: 'scheduled-job-1',
      p_job_item_id: 'item-job-1',
      p_positions: [{ id: 'item-job-2', position: 0 }],
      p_forecast_updates: [
        { id: 'scheduled-job-2', forecast_start: '2026-04-11', forecast_end_exclusive: '2026-04-12', forecast_duration_days: 1 },
      ],
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      crew_id: 'crew-1',
      schedule: {
        crew_id: 'crew-1',
        items: [{ id: 'item-job-2' }],
        conflicts: [],
        next_available_date: '2026-04-14',
      },
      conflicts: [],
      next_available_date: '2026-04-14',
    });
    expect(res.headers.get('x-portal-request-id')).toBe('req_unassign_ok');
  });

  it('returns ok without any RPC call when the job is already absent', async () => {
    scheduledJobsByProjectMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    scheduledJobsByIdMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/unassign', { method: 'POST' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns confirmation before any RPC call', async () => {
    computeCommitImpacts.mockReturnValue([{ job_id: 'job-2' }]);

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/unassign', { method: 'POST' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      requires_confirmation: true,
      impacts: [{ job_id: 'job-2' }],
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns 501 when the command function is missing', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.schedule_v2_unassign_job' } });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/unassign', {
        method: 'POST',
        headers: { 'x-request-id': 'req_unassign_schema' },
      }),
    );

    expect(res.status).toBe(501);
    await expect(res.json()).resolves.toEqual({
      error: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.',
    });
    expect(res.headers.get('x-portal-request-id')).toBe('req_unassign_schema');
  });

  it('returns 500 on a generic RPC failure', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'rpc failed' } });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/unassign', {
        method: 'POST',
        headers: { 'x-request-id': 'req_unassign_fail' },
      }),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to unassign scheduled job' });
    expect(res.headers.get('x-portal-request-id')).toBe('req_unassign_fail');
  });
});
