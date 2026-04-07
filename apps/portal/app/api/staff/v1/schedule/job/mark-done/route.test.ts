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

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return {
    ...actual,
    parseJsonBody,
    requireStaffSession,
  };
});

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
              return { single: () => crewDowntimesInsertSingle(payload) };
            },
          }),
        };
      }
      if (table === 'crew_schedule_items') {
        return {
          insert: (payload: unknown) => ({
            select: (selection: string) => {
              if (selection !== 'id') throw new Error(`Unexpected select ${selection}`);
              return { single: () => crewScheduleItemsInsertSingle(payload) };
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

describe('POST /api/staff/v1/schedule/job/mark-done failures', () => {
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

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });
    parseJsonBody.mockResolvedValue({ ok: true, body: { job_id: 'job-1' } });
    isMissingSchemaError.mockReturnValue(false);
    scheduledJobsByProjectMaybeSingle.mockResolvedValue({
      data: {
        id: 'scheduled-job-1',
        crew_id: 'crew-1',
        forecast_start: '2026-04-08',
        forecast_end_exclusive: '2026-04-15',
        forecast_duration_days: 5,
        actual_start: null,
      },
      error: null,
    });
    loadScheduleContext.mockResolvedValue({ today: '2026-04-10', calendar: {} });
    buildCrewContext.mockReturnValue({
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
    });
    ensureActualStart.mockReturnValue('2026-04-09');
    snapToday.mockReturnValue('2026-04-10');
    workingDaysBetween.mockReturnValue(0);
    addWorkingDays.mockReturnValue('2026-04-15');
    recomputeForCrew.mockReturnValue({ job_updates: [{ id: 'job-update-1' }] });
    buildJobMetaMap.mockReturnValue(new Map());
    computeCommitImpacts.mockReturnValue([]);
    formatCrewScheduleBlocks.mockReturnValue({ lanes: [], conflicts: [], next_available_date: '2026-04-14' });
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

  it('returns 500 when the normal mark-done update fails', async () => {
    scheduledJobsUpdateEq.mockResolvedValue({ data: null, error: { message: 'update failed' } });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/mark-done', {
        method: 'POST',
        headers: { 'x-request-id': 'req_mark_done_fail' },
      }),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to mark scheduled job done' });
    expect(res.headers.get('x-portal-request-id')).toBe('req_mark_done_fail');
    expect(applyJobForecastUpdates).not.toHaveBeenCalled();
  });

  it('returns 500 when keep_schedule reindexing fails and does not update forecasts', async () => {
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: { job_id: 'job-1', finish_early_action: 'keep_schedule', force: true },
    });
    workingDaysBetween.mockReturnValue(2);
    recomputeForCrew
      .mockReturnValueOnce({ job_updates: [{ id: 'job-update-1' }] })
      .mockReturnValueOnce({ job_updates: [{ id: 'job-update-buffer' }] })
      .mockReturnValueOnce({ job_updates: [{ id: 'job-update-final' }] });
    crewScheduleItemsUpdateEq.mockResolvedValueOnce({ data: null, error: { message: 'reindex failed' } });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/mark-done', {
        method: 'POST',
        headers: { 'x-request-id': 'req_mark_done_reindex_fail' },
      }),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to reindex schedule items after finish-early buffer' });
    expect(res.headers.get('x-portal-request-id')).toBe('req_mark_done_reindex_fail');
    expect(crewScheduleItemsUpdateEq).toHaveBeenCalledTimes(1);
    expect(applyJobForecastUpdates).not.toHaveBeenCalled();
  });
});
