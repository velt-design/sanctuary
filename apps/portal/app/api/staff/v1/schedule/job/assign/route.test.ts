import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSession = vi.fn();
const parseJsonBody = vi.fn();

const applyScheduleItemPositions = vi.fn();
const buildCrewContext = vi.fn();
const buildJobMetaMap = vi.fn();
const computeCommitImpacts = vi.fn();
const durationDaysFromEstimate = vi.fn();
const ensureForecastDurationDays = vi.fn();
const formatCrewScheduleBlocks = vi.fn();
const getLatestSchedulableEstimate = vi.fn();
const insertItemAtPosition = vi.fn();
const isMissingSchemaError = vi.fn();
const loadScheduleContext = vi.fn();
const removeItem = vi.fn();
const recomputeForCrew = vi.fn();

const scheduledJobsByProjectMaybeSingle = vi.fn();
const projectsMaybeSingle = vi.fn();
const estimatesEq = vi.fn();
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
  durationDaysFromEstimate,
  ensureForecastDurationDays,
  formatCrewScheduleBlocks,
  getLatestSchedulableEstimate,
  insertItemAtPosition,
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
            eq: (column: string, value: string) => {
              if (column !== 'job_id') throw new Error(`Unexpected scheduled_jobs column ${column}`);
              return { maybeSingle: () => scheduledJobsByProjectMaybeSingle(value) };
            },
          }),
        };
      }
      if (table === 'projects') {
        return {
          select: () => ({
            eq: (column: string, value: string) => {
              if (column !== 'id') throw new Error(`Unexpected projects column ${column}`);
              return { maybeSingle: () => projectsMaybeSingle(value) };
            },
          }),
        };
      }
      if (table === 'estimates') {
        return {
          select: () => ({
            eq: (column: string, value: string) => {
              if (column !== 'project_id') throw new Error(`Unexpected estimates column ${column}`);
              return estimatesEq(value);
            },
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
    rpc,
  },
  supabaseServiceRole: {
    rpc,
  },
}));

describe('POST /api/staff/v1/schedule/job/assign', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffSession.mockReset();
    parseJsonBody.mockReset();
    applyScheduleItemPositions.mockReset();
    buildCrewContext.mockReset();
    buildJobMetaMap.mockReset();
    computeCommitImpacts.mockReset();
    durationDaysFromEstimate.mockReset();
    ensureForecastDurationDays.mockReset();
    formatCrewScheduleBlocks.mockReset();
    getLatestSchedulableEstimate.mockReset();
    insertItemAtPosition.mockReset();
    isMissingSchemaError.mockReset();
    loadScheduleContext.mockReset();
    removeItem.mockReset();
    recomputeForCrew.mockReset();
    scheduledJobsByProjectMaybeSingle.mockReset();
    projectsMaybeSingle.mockReset();
    estimatesEq.mockReset();
    rpc.mockReset();

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });
    parseJsonBody.mockResolvedValue({ ok: true, body: { job_id: 'project-1', crew_id: 'crew-new', position: 1 } });
    isMissingSchemaError.mockReturnValue(false);
    ensureForecastDurationDays.mockImplementation((value: number | null | undefined, fallback: number) =>
      typeof value === 'number' ? value : fallback,
    );
    getLatestSchedulableEstimate.mockReturnValue({ id: 'est-1' });
    durationDaysFromEstimate.mockReturnValue(3);
    scheduledJobsByProjectMaybeSingle.mockResolvedValue({ data: null, error: null });
    projectsMaybeSingle.mockResolvedValue({ data: { id: 'project-1', pipeline_stage: 'DEPOSIT' }, error: null });
    estimatesEq.mockResolvedValue({ data: [{ id: 'est-1', project_id: 'project-1' }], error: null });
    loadScheduleContext.mockResolvedValue({
      today: '2026-04-10',
      calendar: {},
      jobs: [],
    });
    buildCrewContext.mockReturnValue({
      crewRow: { id: 'crew-new', calendar_region: 'Auckland' },
      items: [{ id: 'target-item-1', crewId: 'crew-new', itemType: 'job', jobId: 'scheduled-job-2', downtimeId: null, position: 0 }],
      jobs: [{ id: 'scheduled-job-2', jobId: 'project-2', crewId: 'crew-new', forecastDurationDays: 2 }],
      downtimes: [],
      recompute: { before: true },
      downtimesById: new Map(),
    });
    insertItemAtPosition.mockImplementation((items: any[], item: any, position: number) => {
      const next = items.slice();
      next.splice(position, 0, { ...item });
      return next.map((entry, index) => ({ ...entry, position: index }));
    });
    removeItem.mockImplementation((items: any[], predicate: (item: any) => boolean) =>
      items.filter((item) => !predicate(item)).map((item, index) => ({ ...item, position: index })),
    );
    applyScheduleItemPositions.mockImplementation((items: Array<{ id: string; position: number }>) =>
      items.map((item) => ({ id: item.id, position: item.position })),
    );
    recomputeForCrew.mockReturnValue({
      job_updates: [{ id: 'scheduled-job-1', forecast_start: '2026-04-15', forecast_end_exclusive: '2026-04-18', forecast_duration_days: 3 }],
    });
    buildJobMetaMap.mockReturnValue(new Map());
    computeCommitImpacts.mockReturnValue([]);
    formatCrewScheduleBlocks.mockReturnValue({
      crew_id: 'crew-new',
      items: [{ id: 'item-new' }],
      conflicts: [],
      next_available_date: '2026-04-19',
    });
    rpc.mockResolvedValue({
      data: {
        scheduled_job_id: 'scheduled-job-1',
        schedule_item_id: 'item-new',
        source_crew_id: null,
        updated_target_items: 1,
        updated_source_items: 0,
        updated_forecasts: 1,
      },
      error: null,
    });
  });

  it('returns 401 when staff auth is missing', async () => {
    requireStaffSession.mockResolvedValueOnce(null);

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/assign', { method: 'POST' }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 when job_id or crew_id is missing', async () => {
    parseJsonBody.mockResolvedValueOnce({ ok: true, body: { job_id: 'project-1' } });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/assign', { method: 'POST' }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'job_id and crew_id are required' });
  });

  it('returns confirmation before any RPC call', async () => {
    computeCommitImpacts.mockReturnValueOnce([{ job_id: 'project-1' }]);

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/assign', {
        method: 'POST',
        headers: { 'x-request-id': 'req_assign_confirm' },
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      requires_confirmation: true,
      impacts: [{ job_id: 'project-1' }],
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(res.headers.get('x-portal-request-id')).toBe('req_assign_confirm');
  });

  it('commits a new assignment through one RPC call on success', async () => {
    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/assign', {
        method: 'POST',
        headers: { 'x-request-id': 'req_assign_ok' },
      }),
    );

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('schedule_v2_assign_job', {
      p_target_crew_id: 'crew-new',
      p_target_insert_position: 1,
      p_target_positions: [{ id: 'target-item-1', position: 0 }],
      p_target_forecast_updates: [
        {
          id: 'scheduled-job-1',
          forecast_start: '2026-04-15',
          forecast_end_exclusive: '2026-04-18',
          forecast_duration_days: 3,
        },
      ],
      p_assignment: {
        job_id: 'project-1',
        forecast_duration_days: 3,
      },
      p_move: null,
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      crew_id: 'crew-new',
      schedule: {
        crew_id: 'crew-new',
        items: [{ id: 'item-new' }],
        conflicts: [],
        next_available_date: '2026-04-19',
      },
      conflicts: [],
      next_available_date: '2026-04-19',
    });
    expect(res.headers.get('x-portal-request-id')).toBe('req_assign_ok');
  });

  it('commits a cross-crew move through one RPC call and preserves source schedule output', async () => {
    parseJsonBody.mockResolvedValueOnce({ ok: true, body: { job_id: 'project-1', crew_id: 'crew-new', position: 1, force: true } });
    scheduledJobsByProjectMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'scheduled-job-1',
        crew_id: 'crew-old',
        forecast_duration_days: 2,
      },
      error: null,
    });
    const movedJob = {
      id: 'scheduled-job-1',
      jobId: 'project-1',
      crewId: 'crew-old',
      mode: 'floating',
      forecastStart: '2026-04-12',
      forecastDurationDays: 2,
      forecastEndExclusive: '2026-04-14',
      actualStart: null,
      actualFinish: null,
      status: 'not_started',
      daysRemaining: null,
    };
    loadScheduleContext.mockResolvedValueOnce({
      today: '2026-04-10',
      calendar: {},
      jobs: [movedJob],
    });
    buildCrewContext.mockImplementation((_ctx: any, id: string) => {
      if (id === 'crew-new') {
        return {
          crewRow: { id: 'crew-new', calendar_region: 'Auckland' },
          items: [{ id: 'target-item-1', crewId: 'crew-new', itemType: 'job', jobId: 'scheduled-job-2', downtimeId: null, position: 0 }],
          jobs: [{ id: 'scheduled-job-2', jobId: 'project-2', crewId: 'crew-new', forecastDurationDays: 2 }],
          downtimes: [],
          recompute: { before: true },
          downtimesById: new Map(),
        };
      }
      if (id === 'crew-old') {
        return {
          crewRow: { id: 'crew-old', calendar_region: 'Auckland' },
          items: [
            { id: 'source-item-1', crewId: 'crew-old', itemType: 'job', jobId: 'scheduled-job-1', downtimeId: null, position: 0 },
            { id: 'source-item-2', crewId: 'crew-old', itemType: 'job', jobId: 'scheduled-job-3', downtimeId: null, position: 1 },
          ],
          jobs: [
            movedJob,
            { id: 'scheduled-job-3', jobId: 'project-3', crewId: 'crew-old', forecastDurationDays: 2 },
          ],
          downtimes: [],
          recompute: { before: true },
          downtimesById: new Map(),
        };
      }
      return null;
    });
    recomputeForCrew
      .mockReturnValueOnce({
        job_updates: [{ id: 'scheduled-job-1', forecast_start: '2026-04-15', forecast_end_exclusive: '2026-04-17', forecast_duration_days: 2 }],
      })
      .mockReturnValueOnce({
        job_updates: [{ id: 'scheduled-job-3', forecast_start: '2026-04-18', forecast_end_exclusive: '2026-04-20', forecast_duration_days: 2 }],
      })
      .mockReturnValueOnce({
        job_updates: [{ id: 'scheduled-job-1', forecast_start: '2026-04-15', forecast_end_exclusive: '2026-04-17', forecast_duration_days: 2 }],
      });
    formatCrewScheduleBlocks
      .mockReturnValueOnce({
        crew_id: 'crew-old',
        items: [{ id: 'source-item-2' }],
        conflicts: [],
        next_available_date: '2026-04-14',
      })
      .mockReturnValueOnce({
        crew_id: 'crew-new',
        items: [{ id: 'item-new' }],
        conflicts: [],
        next_available_date: '2026-04-19',
      });
    rpc.mockResolvedValueOnce({
      data: {
        scheduled_job_id: 'scheduled-job-1',
        schedule_item_id: 'item-new',
        source_crew_id: 'crew-old',
        updated_target_items: 1,
        updated_source_items: 1,
        updated_forecasts: 2,
      },
      error: null,
    });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/assign', {
        method: 'POST',
        headers: { 'x-request-id': 'req_assign_move_ok' },
      }),
    );

    expect(rpc).toHaveBeenCalledWith('schedule_v2_assign_job', {
      p_target_crew_id: 'crew-new',
      p_target_insert_position: 1,
      p_target_positions: [{ id: 'target-item-1', position: 0 }],
      p_target_forecast_updates: [
        {
          id: 'scheduled-job-1',
          forecast_start: '2026-04-15',
          forecast_end_exclusive: '2026-04-17',
          forecast_duration_days: 2,
        },
      ],
      p_assignment: {
        scheduled_job_id: 'scheduled-job-1',
      },
      p_move: {
        source_crew_id: 'crew-old',
        source_job_item_id: 'source-item-1',
        source_positions: [{ id: 'source-item-2', position: 0 }],
        source_forecast_updates: [
          {
            id: 'scheduled-job-3',
            forecast_start: '2026-04-18',
            forecast_end_exclusive: '2026-04-20',
            forecast_duration_days: 2,
          },
        ],
      },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      crew_id: 'crew-new',
      schedule: {
        crew_id: 'crew-new',
        items: [{ id: 'item-new' }],
        conflicts: [],
        next_available_date: '2026-04-19',
      },
      conflicts: [],
      next_available_date: '2026-04-19',
      source_crew_id: 'crew-old',
      source_schedule: {
        crew_id: 'crew-old',
        items: [{ id: 'source-item-2' }],
        conflicts: [],
        next_available_date: '2026-04-14',
      },
    });
    expect(res.headers.get('x-portal-request-id')).toBe('req_assign_move_ok');
  });

  it('returns 501 when the command function is missing', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.schedule_v2_assign_job' } });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/assign', {
        method: 'POST',
        headers: { 'x-request-id': 'req_assign_schema' },
      }),
    );

    expect(res.status).toBe(501);
    await expect(res.json()).resolves.toEqual({
      error: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.',
    });
    expect(res.headers.get('x-portal-request-id')).toBe('req_assign_schema');
  });

  it('returns 500 on a generic RPC failure', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/assign', {
        method: 'POST',
        headers: { 'x-request-id': 'req_assign_fail' },
      }),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to assign scheduled job' });
    expect(res.headers.get('x-portal-request-id')).toBe('req_assign_fail');
  });
});
