import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSession = vi.fn();
const parseJsonBody = vi.fn();

const applyJobForecastUpdates = vi.fn();
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
const scheduledJobsDeleteEq = vi.fn();
const crewScheduleItemsDeleteEq = vi.fn();
const crewScheduleItemsUpdateEq = vi.fn();

vi.mock('@/lib/api/staffApi', () => ({
  jsonError: (error: string, status: number) => new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } }),
  jsonOk: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  parseJsonBody,
  requireStaffSession,
}));

vi.mock('@/lib/scheduling/scheduleV2Server', () => ({
  applyJobForecastUpdates,
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
      if (table === 'scheduled_jobs') {
        return {
          select: () => ({
            eq: (column: string) => {
              if (column === 'job_id') return { maybeSingle: scheduledJobsByProjectMaybeSingle };
              if (column === 'id') return { maybeSingle: scheduledJobsByIdMaybeSingle };
              throw new Error(`Unexpected eq column ${column}`);
            },
          }),
          delete: () => ({
            eq: (column: string, id: string) => {
              if (column !== 'id') throw new Error(`Unexpected delete eq column ${column}`);
              return scheduledJobsDeleteEq(id);
            },
          }),
        };
      }
      if (table === 'crew_schedule_items') {
        return {
          delete: () => ({
            eq: (column: string, id: string) => {
              if (column !== 'job_id') throw new Error(`Unexpected delete eq column ${column}`);
              return crewScheduleItemsDeleteEq(id);
            },
          }),
          update: (payload: unknown) => ({
            eq: (column: string, id: string) => {
              if (column !== 'id') throw new Error(`Unexpected update eq column ${column}`);
              return crewScheduleItemsUpdateEq(payload, id);
            },
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  },
}));

describe('POST /api/staff/v1/schedule/job/unassign', () => {
  const missingSchemaError = new Error('missing schema');
  const ctx = { today: '2026-04-10', calendar: {} };
  const jobRow = { id: 'scheduled-job-1', crew_id: 'crew-1' };
  const crewCtx = {
    crewRow: { calendar_region: 'Auckland' },
    items: [{ id: 'item-1' }],
    jobs: [{ id: 'scheduled-job-1' }, { id: 'scheduled-job-2' }],
    downtimes: [],
    recompute: { before: true },
    downtimesById: new Map(),
  };
  const remainingItems = [{ id: 'item-2', position: 0 }];
  const remainingJobs = [{ id: 'scheduled-job-2' }];
  const afterRecompute = { job_updates: [{ id: 'job-update-1' }] };
  const formatted = {
    lanes: [{ id: 'crew-1' }],
    conflicts: [{ code: 'shift' }],
    next_available_date: '2026-04-14',
  };

  beforeEach(() => {
    vi.resetModules();
    requireStaffSession.mockReset();
    parseJsonBody.mockReset();
    applyJobForecastUpdates.mockReset();
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
    scheduledJobsDeleteEq.mockReset();
    crewScheduleItemsDeleteEq.mockReset();
    crewScheduleItemsUpdateEq.mockReset();

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' } });
    parseJsonBody.mockResolvedValue({ ok: true, body: { job_id: 'job-1' } });
    isMissingSchemaError.mockImplementation((error: unknown) => error === missingSchemaError);
    scheduledJobsByProjectMaybeSingle.mockResolvedValue({ data: jobRow, error: null });
    loadScheduleContext.mockResolvedValue(ctx);
    buildCrewContext.mockReturnValue(crewCtx);
    removeItem.mockReturnValue(remainingItems);
    recomputeForCrew.mockReturnValue(afterRecompute);
    buildJobMetaMap.mockReturnValue(new Map());
    computeCommitImpacts.mockReturnValue([]);
    formatCrewScheduleBlocks.mockReturnValue(formatted);
    applyJobForecastUpdates.mockResolvedValue(undefined);
    scheduledJobsDeleteEq.mockResolvedValue({ data: null, error: null });
    crewScheduleItemsDeleteEq.mockResolvedValue({ data: null, error: null });
    crewScheduleItemsUpdateEq.mockResolvedValue({ data: null, error: null });
  });

  it('returns 400 when job_id is missing', async () => {
    parseJsonBody.mockResolvedValue({ ok: true, body: {} });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/unassign', { method: 'POST' }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'job_id is required' });
  });

  it('returns 501 when the scheduled job lookup hits missing schema', async () => {
    scheduledJobsByProjectMaybeSingle.mockResolvedValue({ data: null, error: missingSchemaError });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/unassign', { method: 'POST' }));

    expect(res.status).toBe(501);
    await expect(res.json()).resolves.toEqual({
      error: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.',
    });
  });

  it('returns ok when the scheduled job is already absent', async () => {
    scheduledJobsByProjectMaybeSingle.mockResolvedValue({ data: null, error: null });
    scheduledJobsByIdMaybeSingle.mockResolvedValue({ data: null, error: null });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/unassign', { method: 'POST' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it('returns confirmation payload when impacts exist and force is false', async () => {
    const impacts = [{ type: 'move' }];
    computeCommitImpacts.mockReturnValue(impacts);

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/unassign', { method: 'POST' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ requires_confirmation: true, impacts });
    expect(crewScheduleItemsDeleteEq).not.toHaveBeenCalled();
    expect(scheduledJobsDeleteEq).not.toHaveBeenCalled();
    expect(applyJobForecastUpdates).not.toHaveBeenCalled();
  });

  it('returns the updated schedule and persists deletes plus reindexing', async () => {
    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/unassign', { method: 'POST' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      crew_id: 'crew-1',
      schedule: formatted,
      conflicts: formatted.conflicts,
      next_available_date: formatted.next_available_date,
    });
    expect(crewScheduleItemsDeleteEq).toHaveBeenCalledWith('scheduled-job-1');
    expect(scheduledJobsDeleteEq).toHaveBeenCalledWith('scheduled-job-1');
    expect(crewScheduleItemsUpdateEq).toHaveBeenCalledWith({ position: 0 }, 'item-2');
    expect(applyJobForecastUpdates).toHaveBeenCalledWith(afterRecompute.job_updates);
  });
});
