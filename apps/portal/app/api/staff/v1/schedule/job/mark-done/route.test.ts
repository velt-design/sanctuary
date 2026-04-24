import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const parseJsonBody = vi.fn();

const applyScheduleItemPositions = vi.fn();
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
  supabaseServiceRole: {
    rpc,
  },
}));

describe('POST /api/staff/v1/schedule/job/mark-done', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffContext.mockReset();
    parseJsonBody.mockReset();
    applyScheduleItemPositions.mockReset();
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
    rpc.mockReset();

    requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { email: 'ops@example.com' }, role: 'staff' },
      supabase: {
        from: (table: string) => {
          if (table !== 'scheduled_jobs') throw new Error(`Unexpected table ${table}`);
          return {
            select: () => ({
              eq: (column: string) => {
                if (column === 'job_id') return { maybeSingle: scheduledJobsByProjectMaybeSingle };
                if (column === 'id') return { maybeSingle: scheduledJobsByIdMaybeSingle };
                throw new Error(`Unexpected select eq column ${column}`);
              },
            }),
          };
        },
      },
    });
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
      crewRow: { id: 'crew-1', calendar_region: 'Auckland' },
      items: [
        { id: 'item-job-1', crewId: 'crew-1', itemType: 'job', jobId: 'scheduled-job-1', downtimeId: null, position: 0 },
        { id: 'item-job-2', crewId: 'crew-1', itemType: 'job', jobId: 'scheduled-job-2', downtimeId: null, position: 1 },
      ],
      jobs: [
        { id: 'scheduled-job-1', status: 'in_progress', forecastStart: '2026-04-08', actualStart: null },
        { id: 'scheduled-job-2', status: 'tentative', forecastStart: '2026-04-12', actualStart: null },
      ],
      downtimes: [],
      recompute: { before: true },
      downtimesById: new Map(),
    });
    ensureActualStart.mockReturnValue('2026-04-09');
    snapToday.mockReturnValue('2026-04-10');
    workingDaysBetween.mockReturnValue(0);
    addWorkingDays.mockReturnValue('2026-04-15');
    recomputeForCrew.mockReturnValue({ job_updates: [{ id: 'scheduled-job-1', forecast_start: '2026-04-08', forecast_end_exclusive: '2026-04-10', forecast_duration_days: 2 }] });
    buildJobMetaMap.mockReturnValue(new Map());
    computeCommitImpacts.mockReturnValue([]);
    formatCrewScheduleBlocks.mockReturnValue({
      crew_id: 'crew-1',
      items: [{ id: 'item-job-1' }],
      conflicts: [],
      next_available_date: '2026-04-14',
    });
    applyScheduleItemPositions.mockImplementation((items: Array<{ id: string; position: number }>) =>
      items.map((item) => ({ id: item.id, position: item.position })),
    );
    rpc.mockResolvedValue({
      data: {
        updated_job: 'scheduled-job-1',
        created_downtime_id: null,
        created_item_id: null,
        updated_items: 0,
        updated_forecasts: 1,
      },
      error: null,
    });
    insertItemAtPosition.mockImplementation((items: any[], item: any, position: number) => {
      const next = items.slice();
      next.splice(position, 0, { ...item });
      return next.map((entry, index) => ({ ...entry, position: index }));
    });
  });

  it('commits normal mark-done through one RPC call on success', async () => {
    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/mark-done', {
        method: 'POST',
        headers: { 'x-request-id': 'req_mark_done_ok' },
      }),
    );

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('schedule_v2_mark_done', {
      p_scheduled_job_id: 'scheduled-job-1',
      p_actual_start: '2026-04-09',
      p_actual_finish: '2026-04-10',
      p_forecast_updates: [
        {
          id: 'scheduled-job-1',
          forecast_start: '2026-04-08',
          forecast_end_exclusive: '2026-04-10',
          forecast_duration_days: 2,
        },
      ],
      p_finish_early: null,
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
    expect(res.headers.get('x-portal-request-id')).toBe('req_mark_done_ok');
  });

  it('returns requires_finish_early before any RPC call', async () => {
    workingDaysBetween.mockReturnValue(2);

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/mark-done', { method: 'POST' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      requires_finish_early: true,
      freed_days: 2,
      actual_finish: '2026-04-10',
      forecast_end_exclusive: '2026-04-15',
      impacts: [],
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('commits keep_schedule mark-done through one RPC call on success', async () => {
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: { job_id: 'job-1', finish_early_action: 'keep_schedule', force: true },
    });
    workingDaysBetween.mockReturnValue(2);
    recomputeForCrew
      .mockReturnValueOnce({
        job_updates: [
          { id: 'scheduled-job-1', forecast_start: '2026-04-08', forecast_end_exclusive: '2026-04-10', forecast_duration_days: 2 },
        ],
      })
      .mockReturnValueOnce({
        job_updates: [
          { id: 'scheduled-job-1', forecast_start: '2026-04-08', forecast_end_exclusive: '2026-04-12', forecast_duration_days: 4 },
        ],
      })
      .mockReturnValueOnce({
        job_updates: [
          { id: 'scheduled-job-1', forecast_start: '2026-04-08', forecast_end_exclusive: '2026-04-12', forecast_duration_days: 4 },
        ],
      });
    rpc.mockResolvedValueOnce({
      data: {
        updated_job: 'scheduled-job-1',
        created_downtime_id: 'dt-real-1',
        created_item_id: 'item-real-1',
        updated_items: 2,
        updated_forecasts: 1,
      },
      error: null,
    });
    formatCrewScheduleBlocks.mockReturnValueOnce({
      crew_id: 'crew-1',
      items: [{ id: 'item-real-1' }],
      conflicts: [],
      next_available_date: '2026-04-16',
    });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/mark-done', {
        method: 'POST',
        headers: { 'x-request-id': 'req_mark_done_keep_ok' },
      }),
    );

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('schedule_v2_mark_done', {
      p_scheduled_job_id: 'scheduled-job-1',
      p_actual_start: '2026-04-09',
      p_actual_finish: '2026-04-10',
      p_forecast_updates: [
        {
          id: 'scheduled-job-1',
          forecast_start: '2026-04-08',
          forecast_end_exclusive: '2026-04-12',
          forecast_duration_days: 4,
        },
      ],
      p_finish_early: {
        crew_id: 'crew-1',
        freed_days: 2,
        buffer_note: 'Finish early buffer (2 working days).',
        insert_position: 1,
        existing_positions: [
          { id: 'item-job-1', position: 0 },
          { id: 'item-job-2', position: 2 },
        ],
      },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      crew_id: 'crew-1',
      schedule: {
        crew_id: 'crew-1',
        items: [{ id: 'item-real-1' }],
        conflicts: [],
        next_available_date: '2026-04-16',
      },
      conflicts: [],
      next_available_date: '2026-04-16',
    });
    expect(res.headers.get('x-portal-request-id')).toBe('req_mark_done_keep_ok');
  });

  it('returns keep_schedule confirmation before any RPC call', async () => {
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: { job_id: 'job-1', finish_early_action: 'keep_schedule' },
    });
    workingDaysBetween.mockReturnValue(2);
    computeCommitImpacts
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ job_id: 'scheduled-job-2' }]);

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/mark-done', { method: 'POST' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      requires_confirmation: true,
      impacts: [{ job_id: 'scheduled-job-2' }],
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns 501 when the command function is missing', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.schedule_v2_mark_done' } });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/mark-done', {
        method: 'POST',
        headers: { 'x-request-id': 'req_mark_done_schema' },
      }),
    );

    expect(res.status).toBe(501);
    await expect(res.json()).resolves.toEqual({
      error: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.',
    });
    expect(res.headers.get('x-portal-request-id')).toBe('req_mark_done_schema');
  });

  it('returns 500 on a keep_schedule RPC failure', async () => {
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: { job_id: 'job-1', finish_early_action: 'keep_schedule', force: true },
    });
    workingDaysBetween.mockReturnValue(2);
    recomputeForCrew
      .mockReturnValueOnce({
        job_updates: [
          { id: 'scheduled-job-1', forecast_start: '2026-04-08', forecast_end_exclusive: '2026-04-10', forecast_duration_days: 2 },
        ],
      })
      .mockReturnValueOnce({
        job_updates: [
          { id: 'scheduled-job-1', forecast_start: '2026-04-08', forecast_end_exclusive: '2026-04-12', forecast_duration_days: 4 },
        ],
      });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'rpc failed' } });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/mark-done', {
        method: 'POST',
        headers: { 'x-request-id': 'req_mark_done_buffer_fail' },
      }),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to create finish-early buffer' });
    expect(res.headers.get('x-portal-request-id')).toBe('req_mark_done_buffer_fail');
  });
});
