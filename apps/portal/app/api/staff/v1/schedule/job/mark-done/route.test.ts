import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSession = vi.fn();
const parseJsonBody = vi.fn();

const applyJobForecastUpdates = vi.fn();
const buildCrewContext = vi.fn();
const buildJobMetaMap = vi.fn();
const computeCommitImpacts = vi.fn();
const ensureActualStart = vi.fn();
const formatCrewScheduleBlocks = vi.fn();
const insertItemAtPosition = vi.fn();
const isMissingSchemaError = vi.fn();
const loadScheduleContext = vi.fn();
const recomputeForCrew = vi.fn();
const snapToday = vi.fn();

const addWorkingDays = vi.fn();
const workingDaysBetween = vi.fn();

const scheduledJobsByProjectMaybeSingle = vi.fn();
const scheduledJobsByIdMaybeSingle = vi.fn();
const scheduledJobsUpdateEq = vi.fn();
const crewDowntimesInsertSingle = vi.fn();
const crewScheduleItemsInsertSingle = vi.fn();
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
  ensureActualStart,
  formatCrewScheduleBlocks,
  insertItemAtPosition,
  isMissingSchemaError,
  loadScheduleContext,
  recomputeForCrew,
  snapToday,
}));

vi.mock('@/lib/scheduling/workingDays', () => ({
  addWorkingDays,
  workingDaysBetween,
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
              throw new Error(`Unexpected select eq column ${column}`);
            },
          }),
          update: (payload: unknown) => ({
            eq: (column: string, id: string) => {
              if (column !== 'id') throw new Error(`Unexpected update eq column ${column}`);
              return scheduledJobsUpdateEq(payload, id);
            },
          }),
        };
      }
      if (table === 'crew_downtimes') {
        return {
          insert: (payload: unknown) => ({
            select: (selection: string) => {
              if (selection !== 'id') throw new Error(`Unexpected select ${selection}`);
              return {
                single: () => crewDowntimesInsertSingle(payload),
              };
            },
          }),
        };
      }
      if (table === 'crew_schedule_items') {
        return {
          insert: (payload: unknown) => ({
            select: (selection: string) => {
              if (selection !== 'id') throw new Error(`Unexpected select ${selection}`);
              return {
                single: () => crewScheduleItemsInsertSingle(payload),
              };
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

describe('POST /api/staff/v1/schedule/job/mark-done', () => {
  const missingSchemaError = new Error('missing schema');
  const ctx = { today: '2026-04-10', calendar: {} };
  const jobRow = {
    id: 'scheduled-job-1',
    crew_id: 'crew-1',
    forecast_start: '2026-04-08',
    forecast_end_exclusive: '2026-04-15',
    forecast_duration_days: 5,
    actual_start: null,
  };
  const crewCtx = {
    crewRow: { calendar_region: 'Auckland' },
    items: [
      { id: 'item-job-1', crewId: 'crew-1', itemType: 'job', jobId: 'scheduled-job-1', downtimeId: null, position: 0 },
      { id: 'item-job-2', crewId: 'crew-1', itemType: 'job', jobId: 'scheduled-job-2', downtimeId: null, position: 1 },
    ],
    jobs: [
      { id: 'scheduled-job-1', status: 'in_progress' },
      { id: 'scheduled-job-2', status: 'tentative' },
    ],
    downtimes: [],
    recompute: { before: true },
    downtimesById: new Map(),
  };
  const afterRecompute = { job_updates: [{ id: 'job-update-1' }] };
  const bufferRecompute = { job_updates: [{ id: 'job-update-buffer' }] };
  const finalRecompute = { job_updates: [{ id: 'job-update-final' }] };
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
    ensureActualStart.mockReset();
    formatCrewScheduleBlocks.mockReset();
    insertItemAtPosition.mockReset();
    isMissingSchemaError.mockReset();
    loadScheduleContext.mockReset();
    recomputeForCrew.mockReset();
    snapToday.mockReset();
    addWorkingDays.mockReset();
    workingDaysBetween.mockReset();
    scheduledJobsByProjectMaybeSingle.mockReset();
    scheduledJobsByIdMaybeSingle.mockReset();
    scheduledJobsUpdateEq.mockReset();
    crewDowntimesInsertSingle.mockReset();
    crewScheduleItemsInsertSingle.mockReset();
    crewScheduleItemsUpdateEq.mockReset();

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' } });
    parseJsonBody.mockResolvedValue({ ok: true, body: { job_id: 'job-1' } });
    isMissingSchemaError.mockImplementation((error: unknown) => error === missingSchemaError);
    scheduledJobsByProjectMaybeSingle.mockResolvedValue({ data: jobRow, error: null });
    loadScheduleContext.mockResolvedValue(ctx);
    buildCrewContext.mockReturnValue(crewCtx);
    ensureActualStart.mockReturnValue('2026-04-09');
    snapToday.mockReturnValue('2026-04-10');
    workingDaysBetween.mockReturnValue(0);
    addWorkingDays.mockReturnValue('2026-04-15');
    recomputeForCrew.mockReturnValue(afterRecompute);
    buildJobMetaMap.mockReturnValue(new Map());
    computeCommitImpacts.mockReturnValue([]);
    formatCrewScheduleBlocks.mockReturnValue(formatted);
    applyJobForecastUpdates.mockResolvedValue(undefined);
    scheduledJobsUpdateEq.mockResolvedValue({ data: null, error: null });
    crewDowntimesInsertSingle.mockResolvedValue({ data: { id: 'dt-real-1' }, error: null });
    crewScheduleItemsInsertSingle.mockResolvedValue({ data: { id: 'item-real-1' }, error: null });
    crewScheduleItemsUpdateEq.mockResolvedValue({ data: null, error: null });
    insertItemAtPosition.mockImplementation((items: any[], item: any, position: number) => {
      const next = items.slice();
      next.splice(position, 0, { ...item });
      return next.map((entry, index) => ({ ...entry, position: index }));
    });
  });

  it('returns 400 when job_id is missing', async () => {
    parseJsonBody.mockResolvedValue({ ok: true, body: {} });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/mark-done', { method: 'POST' }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'job_id is required' });
  });

  it('returns 400 when finish_early_action is invalid', async () => {
    parseJsonBody.mockResolvedValue({ ok: true, body: { job_id: 'job-1', finish_early_action: 'shrug' } });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/mark-done', { method: 'POST' }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'finish_early_action must be pull_forward or keep_schedule',
    });
  });

  it('returns finish-early guidance when the job frees working days and no action is chosen', async () => {
    workingDaysBetween.mockReturnValue(2);
    computeCommitImpacts.mockReturnValue([{ type: 'pull-forward' }]);

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/mark-done', { method: 'POST' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      requires_finish_early: true,
      freed_days: 2,
      actual_finish: '2026-04-10',
      forecast_end_exclusive: '2026-04-15',
      impacts: [{ type: 'pull-forward' }],
    });
    expect(scheduledJobsUpdateEq).not.toHaveBeenCalled();
    expect(applyJobForecastUpdates).not.toHaveBeenCalled();
  });

  it('returns the updated schedule for the normal mark-done path', async () => {
    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/mark-done', { method: 'POST' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      crew_id: 'crew-1',
      schedule: formatted,
      conflicts: formatted.conflicts,
      next_available_date: formatted.next_available_date,
    });
    expect(scheduledJobsUpdateEq).toHaveBeenCalledWith(
      { status: 'done', actual_finish: '2026-04-10', actual_start: '2026-04-08' },
      'scheduled-job-1',
    );
    expect(applyJobForecastUpdates).toHaveBeenCalledWith(afterRecompute.job_updates);
  });

  it('returns the updated schedule for keep_schedule and persists the downtime buffer', async () => {
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: { job_id: 'job-1', finish_early_action: 'keep_schedule', force: true },
    });
    workingDaysBetween.mockReturnValue(2);
    recomputeForCrew.mockReturnValueOnce(afterRecompute).mockReturnValueOnce(bufferRecompute).mockReturnValueOnce(finalRecompute);
    computeCommitImpacts.mockReturnValue([]);

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/mark-done', { method: 'POST' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      crew_id: 'crew-1',
      schedule: formatted,
      conflicts: formatted.conflicts,
      next_available_date: formatted.next_available_date,
    });
    expect(scheduledJobsUpdateEq).toHaveBeenCalledWith(
      { status: 'done', actual_finish: '2026-04-10', actual_start: '2026-04-08' },
      'scheduled-job-1',
    );
    expect(crewDowntimesInsertSingle).toHaveBeenCalledWith({
      crew_id: 'crew-1',
      duration_days: 2,
      reason: 'other',
      note: 'Finish early buffer (2 working days).',
    });
    expect(crewScheduleItemsInsertSingle).toHaveBeenCalledWith({
      crew_id: 'crew-1',
      item_type: 'downtime',
      downtime_id: 'dt-real-1',
      position: 1,
    });
    expect(crewScheduleItemsUpdateEq).toHaveBeenCalledWith({ position: 0 }, 'item-job-1');
    expect(crewScheduleItemsUpdateEq).toHaveBeenCalledWith({ position: 2 }, 'item-job-2');
    expect(applyJobForecastUpdates).toHaveBeenCalledWith(finalRecompute.job_updates);
  });
});
