import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
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
const estimatesSelect = vi.fn();
const estimatesEq = vi.fn();
const rpc = vi.fn();
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

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
  supabaseServiceRole: {
    rpc,
  },
}));

describe('POST /api/staff/v1/schedule/job/assign', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffContext.mockReset();
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
    estimatesSelect.mockReset();
    estimatesEq.mockReset();
    rpc.mockReset();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { email: 'ops@example.com' }, role: 'staff' },
      supabase: {
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
              select: (columns: string) => {
                estimatesSelect(columns);
                return {
                  eq: (column: string, value: string) => {
                    if (column !== 'project_id') throw new Error(`Unexpected estimates column ${column}`);
                    return estimatesEq(value);
                  },
                };
              },
            };
          }
          throw new Error(`Unexpected table ${table}`);
        },
      },
    });
    parseJsonBody.mockResolvedValue({ ok: true, body: { job_id: 'project-1', crew_id: 'crew-new', position: 1 } });
    isMissingSchemaError.mockReturnValue(false);
    ensureForecastDurationDays.mockImplementation((value: number | null | undefined, fallback: number) =>
      typeof value === 'number' ? value : fallback,
    );
    getLatestSchedulableEstimate.mockReturnValue({ id: 'est-1' });
    durationDaysFromEstimate.mockReturnValue(3);
    scheduledJobsByProjectMaybeSingle.mockResolvedValue({ data: null, error: null });
    projectsMaybeSingle.mockResolvedValue({ data: { id: 'project-1', pipeline_stage: 'DEPOSIT' }, error: null });
    estimatesEq.mockResolvedValue({ data: [{ id: 'est-1', project_id: 'project-1', duration_days: 2, crew_hours: 16 }], error: null });
    loadScheduleContext.mockResolvedValue({
      today: '2026-04-10',
      calendar: {},
      jobs: [],
    });
    buildCrewContext.mockReturnValue({
      crewRow: { id: 'crew-new', calendar_region: 'Auckland' },
      items: [{ id: 'target-item-1', crewId: 'crew-new', itemType: 'job', jobId: '00000000-0000-4000-8000-000000000402', downtimeId: null, position: 0 }],
      jobs: [{ id: '00000000-0000-4000-8000-000000000402', jobId: 'project-2', crewId: 'crew-new', forecastDurationDays: 2 }],
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
      job_updates: [{ id: '00000000-0000-4000-8000-000000000401', forecast_start: '2026-04-15', forecast_end_exclusive: '2026-04-18', forecast_duration_days: 3 }],
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
        scheduled_job_id: '00000000-0000-4000-8000-000000000401',
        schedule_item_id: 'item-new',
        source_crew_id: null,
        updated_target_items: 1,
        updated_source_items: 0,
        updated_forecasts: 1,
      },
      error: null,
    });
  });

  afterEach(() => {
    consoleWarnSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();
  });

  it('returns 401 when staff auth is missing', async () => {
    requireStaffContext.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    });

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
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[portal]',
      expect.objectContaining({
        event: 'schedule.assign.validation_failed',
        requestId: expect.any(String),
        route: '/api/staff/v1/schedule/job/assign',
        status: 400,
        reason: 'missing_job_or_crew',
        jobId: 'project-1',
        crewId: null,
        requestedPosition: null,
      }),
    );
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
          id: '00000000-0000-4000-8000-000000000401',
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

  it('uses selected estimate duration fields for new assignments', async () => {
    estimatesEq.mockResolvedValueOnce({
      data: [{ id: 'est-duration', project_id: 'project-1', duration_days: 1.5233333333333334, crew_hours: 13.71 }],
      error: null,
    });
    getLatestSchedulableEstimate.mockImplementationOnce((estimates: any[]) => estimates[0]);
    durationDaysFromEstimate.mockImplementationOnce((estimate: { duration_days: number }) => Math.ceil(estimate.duration_days));

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/assign', {
        method: 'POST',
        headers: { 'x-request-id': 'req_assign_duration' },
      }),
    );

    expect(res.status).toBe(200);
    expect(estimatesSelect).toHaveBeenCalledWith(expect.stringContaining('duration_days'));
    expect(estimatesSelect).toHaveBeenCalledWith(expect.stringContaining('crew_hours'));
    expect(durationDaysFromEstimate).toHaveBeenCalledWith(
      expect.objectContaining({
        duration_days: 1.5233333333333334,
        crew_hours: 13.71,
      }),
    );
    const [, rpcArgs] = rpc.mock.calls[0];
    expect(rpcArgs.p_assignment).toEqual({
      job_id: 'project-1',
      forecast_duration_days: 2,
    });
  });

  it('moves new assignment temp forecasts into p_assignment before commit', async () => {
    recomputeForCrew.mockImplementationOnce((input: { jobs: Array<{ id: string }> }) => {
      const tempJob = input.jobs.find((job) => job.id.startsWith('temp_job_'));
      if (!tempJob) throw new Error('Expected a temp scheduled job during assignment recompute');
      return {
        job_updates: [
          {
            id: tempJob.id,
            forecast_start: '2026-04-15',
            forecast_end_exclusive: '2026-04-18',
            forecast_duration_days: 3,
          },
          {
            id: '00000000-0000-4000-8000-000000000402',
            forecast_start: '2026-04-18',
            forecast_end_exclusive: '2026-04-20',
            forecast_duration_days: 2,
          },
        ],
      };
    });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/assign', {
        method: 'POST',
        headers: { 'x-request-id': 'req_assign_temp_forecast' },
      }),
    );

    expect(res.status).toBe(200);
    const [, rpcArgs] = rpc.mock.calls[0];
    expect(rpcArgs.p_target_forecast_updates).toEqual([
      {
        id: '00000000-0000-4000-8000-000000000402',
        forecast_start: '2026-04-18',
        forecast_end_exclusive: '2026-04-20',
        forecast_duration_days: 2,
      },
    ]);
    expect(rpcArgs.p_target_forecast_updates.some((update: { id: string }) => update.id.startsWith('temp_job_'))).toBe(false);
    expect(rpcArgs.p_assignment).toEqual({
      job_id: 'project-1',
      forecast_duration_days: 3,
      forecast_start: '2026-04-15',
      forecast_end_exclusive: '2026-04-18',
    });
    expect(res.headers.get('x-portal-request-id')).toBe('req_assign_temp_forecast');
  });

  it('commits a cross-crew move through one RPC call and preserves source schedule output', async () => {
    parseJsonBody.mockResolvedValueOnce({ ok: true, body: { job_id: 'project-1', crew_id: 'crew-new', position: 1, force: true } });
    scheduledJobsByProjectMaybeSingle.mockResolvedValueOnce({
      data: {
        id: '00000000-0000-4000-8000-000000000401',
        crew_id: 'crew-old',
        forecast_duration_days: 2,
      },
      error: null,
    });
    const movedJob = {
      id: '00000000-0000-4000-8000-000000000401',
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
          items: [{ id: 'target-item-1', crewId: 'crew-new', itemType: 'job', jobId: '00000000-0000-4000-8000-000000000402', downtimeId: null, position: 0 }],
          jobs: [{ id: '00000000-0000-4000-8000-000000000402', jobId: 'project-2', crewId: 'crew-new', forecastDurationDays: 2 }],
          downtimes: [],
          recompute: { before: true },
          downtimesById: new Map(),
        };
      }
      if (id === 'crew-old') {
        return {
          crewRow: { id: 'crew-old', calendar_region: 'Auckland' },
          items: [
            { id: 'source-item-1', crewId: 'crew-old', itemType: 'job', jobId: '00000000-0000-4000-8000-000000000401', downtimeId: null, position: 0 },
            { id: 'source-item-2', crewId: 'crew-old', itemType: 'job', jobId: '00000000-0000-4000-8000-000000000403', downtimeId: null, position: 1 },
          ],
          jobs: [
            movedJob,
            { id: '00000000-0000-4000-8000-000000000403', jobId: 'project-3', crewId: 'crew-old', forecastDurationDays: 2 },
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
        job_updates: [
          { id: '00000000-0000-4000-8000-000000000401', forecast_start: '2026-04-15', forecast_end_exclusive: '2026-04-17', forecast_duration_days: 2 },
          { id: 'temp_job_target', forecast_start: '2026-04-17', forecast_end_exclusive: '2026-04-18', forecast_duration_days: 1 },
        ],
      })
      .mockReturnValueOnce({
        job_updates: [
          { id: '00000000-0000-4000-8000-000000000403', forecast_start: '2026-04-18', forecast_end_exclusive: '2026-04-20', forecast_duration_days: 2 },
          { id: 'temp_job_source', forecast_start: '2026-04-20', forecast_end_exclusive: '2026-04-21', forecast_duration_days: 1 },
        ],
      })
      .mockReturnValueOnce({
        job_updates: [{ id: '00000000-0000-4000-8000-000000000401', forecast_start: '2026-04-15', forecast_end_exclusive: '2026-04-17', forecast_duration_days: 2 }],
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
        scheduled_job_id: '00000000-0000-4000-8000-000000000401',
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
          id: '00000000-0000-4000-8000-000000000401',
          forecast_start: '2026-04-15',
          forecast_end_exclusive: '2026-04-17',
          forecast_duration_days: 2,
        },
      ],
      p_assignment: {
        scheduled_job_id: '00000000-0000-4000-8000-000000000401',
      },
      p_move: {
        source_crew_id: 'crew-old',
        source_job_item_id: 'source-item-1',
        source_positions: [{ id: 'source-item-2', position: 0 }],
        source_forecast_updates: [
          {
            id: '00000000-0000-4000-8000-000000000403',
            forecast_start: '2026-04-18',
            forecast_end_exclusive: '2026-04-20',
            forecast_duration_days: 2,
          },
        ],
      },
    });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[portal]',
      expect.objectContaining({
        event: 'schedule.assign.forecast_updates_sanitized',
        requestId: 'req_assign_move_ok',
        status: 200,
        reason: 'non_uuid_forecast_updates_filtered',
        assignmentKind: 'move',
        targetRawForecastCount: 2,
        targetForecastCount: 1,
        targetForecastNonUuidCount: 1,
        sourceRawForecastCount: 2,
        sourceForecastCount: 1,
        sourceForecastNonUuidCount: 1,
        jobId: 'project-1',
        crewId: 'crew-new',
        scheduledJobId: '00000000-0000-4000-8000-000000000401',
        sourceCrewId: 'crew-old',
        requestedPosition: 1,
      }),
    );
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

  it('returns 409 when an existing scheduled job already has a same-crew queue item', async () => {
    scheduledJobsByProjectMaybeSingle.mockResolvedValueOnce({
      data: { id: '00000000-0000-4000-8000-000000000401', crew_id: 'crew-new', forecast_duration_days: 2 },
      error: null,
    });
    buildCrewContext.mockReturnValueOnce({
      crewRow: { id: 'crew-new', calendar_region: 'Auckland' },
      items: [{ id: 'target-item-1', crewId: 'crew-new', itemType: 'job', jobId: '00000000-0000-4000-8000-000000000401', downtimeId: null, position: 0 }],
      jobs: [{ id: '00000000-0000-4000-8000-000000000401', jobId: 'project-1', crewId: 'crew-new', forecastDurationDays: 2 }],
      downtimes: [],
      recompute: { before: true },
      downtimesById: new Map(),
    });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/assign', {
        method: 'POST',
        headers: { 'x-request-id': 'req_assign_same_crew_existing' },
      }),
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: 'Job is already scheduled in this crew. Refresh the board.' });
    expect(rpc).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[portal]',
      expect.objectContaining({
        event: 'schedule.assign.validation_failed',
        requestId: 'req_assign_same_crew_existing',
        status: 409,
        reason: 'already_scheduled_same_crew',
        jobId: 'project-1',
        crewId: 'crew-new',
        scheduledJobId: '00000000-0000-4000-8000-000000000401',
        targetItemPresent: true,
        sourceItemPresent: true,
      }),
    );
  });

  it('repairs an existing same-crew scheduled job that is missing a queue item', async () => {
    scheduledJobsByProjectMaybeSingle.mockResolvedValueOnce({
      data: { id: '00000000-0000-4000-8000-000000000401', crew_id: 'crew-new', forecast_duration_days: 2 },
      error: null,
    });
    loadScheduleContext.mockResolvedValueOnce({
      today: '2026-04-10',
      calendar: {},
      jobs: [{ id: '00000000-0000-4000-8000-000000000401', jobId: 'project-1', crewId: 'crew-new', forecastDurationDays: 2 }],
    });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/assign', {
        method: 'POST',
        headers: { 'x-request-id': 'req_assign_same_crew_repair' },
      }),
    );

    expect(rpc).toHaveBeenCalledWith('schedule_v2_assign_job', {
      p_target_crew_id: 'crew-new',
      p_target_insert_position: 1,
      p_target_positions: [{ id: 'target-item-1', position: 0 }],
      p_target_forecast_updates: [
        {
          id: '00000000-0000-4000-8000-000000000401',
          forecast_start: '2026-04-15',
          forecast_end_exclusive: '2026-04-18',
          forecast_duration_days: 3,
        },
      ],
      p_assignment: { scheduled_job_id: '00000000-0000-4000-8000-000000000401' },
      p_move: null,
    });
    expect(res.status).toBe(200);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[portal]',
      expect.objectContaining({
        event: 'schedule.assign.consistency_repair',
        requestId: 'req_assign_same_crew_repair',
        reason: 'missing_target_queue_item_repaired',
        jobId: 'project-1',
        crewId: 'crew-new',
        scheduledJobId: '00000000-0000-4000-8000-000000000401',
        sourceCrewId: 'crew-new',
        targetItemPresent: false,
      }),
    );
  });

  it('returns 501 when the assign repair RPC migration is missing during same-crew repair', async () => {
    scheduledJobsByProjectMaybeSingle.mockResolvedValueOnce({
      data: { id: '00000000-0000-4000-8000-000000000401', crew_id: 'crew-new', forecast_duration_days: 2 },
      error: null,
    });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'p_assignment.job_id is required' } });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/assign', {
        method: 'POST',
        headers: { 'x-request-id': 'req_assign_old_rpc_revision' },
      }),
    );

    expect(res.status).toBe(501);
    await expect(res.json()).resolves.toEqual({
      error: expect.stringContaining('20260414_000001_schedule_v2_assign_existing_job_repair.sql'),
    });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[portal]',
      expect.objectContaining({
        event: 'schedule.assign.schema_revision_missing',
        requestId: 'req_assign_old_rpc_revision',
        status: 501,
        reason: 'old_assign_repair_rpc_revision',
        jobId: 'project-1',
        crewId: 'crew-new',
        scheduledJobId: '00000000-0000-4000-8000-000000000401',
      }),
    );
  });

  it('repairs an existing cross-crew scheduled job when the source queue item is missing', async () => {
    scheduledJobsByProjectMaybeSingle.mockResolvedValueOnce({
      data: { id: '00000000-0000-4000-8000-000000000401', crew_id: 'crew-old', forecast_duration_days: 2 },
      error: null,
    });
    loadScheduleContext.mockResolvedValueOnce({
      today: '2026-04-10',
      calendar: {},
      jobs: [{ id: '00000000-0000-4000-8000-000000000401', jobId: 'project-1', crewId: 'crew-old', forecastDurationDays: 2 }],
    });
    buildCrewContext.mockImplementation((_ctx: any, id: string) => {
      if (id === 'crew-new') {
        return {
          crewRow: { id: 'crew-new', calendar_region: 'Auckland' },
          items: [{ id: 'target-item-1', crewId: 'crew-new', itemType: 'job', jobId: '00000000-0000-4000-8000-000000000402', downtimeId: null, position: 0 }],
          jobs: [{ id: '00000000-0000-4000-8000-000000000402', jobId: 'project-2', crewId: 'crew-new', forecastDurationDays: 2 }],
          downtimes: [],
          recompute: { before: true },
          downtimesById: new Map(),
        };
      }
      if (id === 'crew-old') {
        return {
          crewRow: { id: 'crew-old', calendar_region: 'Auckland' },
          items: [{ id: 'source-item-2', crewId: 'crew-old', itemType: 'job', jobId: '00000000-0000-4000-8000-000000000403', downtimeId: null, position: 0 }],
          jobs: [{ id: '00000000-0000-4000-8000-000000000401', jobId: 'project-1', crewId: 'crew-old', forecastDurationDays: 2 }],
          downtimes: [],
          recompute: { before: true },
          downtimesById: new Map(),
        };
      }
      return null;
    });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/assign', {
        method: 'POST',
        headers: { 'x-request-id': 'req_assign_source_missing_repair' },
      }),
    );

    expect(rpc).toHaveBeenCalledWith('schedule_v2_assign_job', {
      p_target_crew_id: 'crew-new',
      p_target_insert_position: 1,
      p_target_positions: [{ id: 'target-item-1', position: 0 }],
      p_target_forecast_updates: [
        {
          id: '00000000-0000-4000-8000-000000000401',
          forecast_start: '2026-04-15',
          forecast_end_exclusive: '2026-04-18',
          forecast_duration_days: 3,
        },
      ],
      p_assignment: { scheduled_job_id: '00000000-0000-4000-8000-000000000401' },
      p_move: null,
    });
    expect(res.status).toBe(200);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[portal]',
      expect.objectContaining({
        event: 'schedule.assign.consistency_repair',
        requestId: 'req_assign_source_missing_repair',
        reason: 'missing_source_queue_item_repaired',
        jobId: 'project-1',
        crewId: 'crew-new',
        scheduledJobId: '00000000-0000-4000-8000-000000000401',
        sourceCrewId: 'crew-old',
        sourceItemPresent: false,
      }),
    );
  });

  it('logs project-not-found assignment failures with a structured reason', async () => {
    projectsMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/assign', {
        method: 'POST',
        headers: { 'x-request-id': 'req_assign_project_missing' },
      }),
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Project not found' });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[portal]',
      expect.objectContaining({
        event: 'schedule.assign.validation_failed',
        requestId: 'req_assign_project_missing',
        status: 404,
        reason: 'project_not_found',
        jobId: 'project-1',
        crewId: 'crew-new',
      }),
    );
  });

  it('logs not-ready project assignment failures with a structured reason', async () => {
    projectsMaybeSingle.mockResolvedValueOnce({ data: { id: 'project-1', pipeline_stage: 'NEW' }, error: null });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/assign', {
        method: 'POST',
        headers: { 'x-request-id': 'req_assign_not_ready' },
      }),
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: 'Only deposit-stage projects can be scheduled.' });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[portal]',
      expect.objectContaining({
        event: 'schedule.assign.validation_failed',
        requestId: 'req_assign_not_ready',
        status: 409,
        reason: 'project_not_scheduling_ready',
        jobId: 'project-1',
        crewId: 'crew-new',
      }),
    );
  });

  it('logs crew-not-found assignment failures with a structured reason', async () => {
    buildCrewContext.mockReturnValueOnce(null);

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/assign', {
        method: 'POST',
        headers: { 'x-request-id': 'req_assign_crew_missing' },
      }),
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Crew not found' });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[portal]',
      expect.objectContaining({
        event: 'schedule.assign.validation_failed',
        requestId: 'req_assign_crew_missing',
        status: 404,
        reason: 'crew_not_found',
        jobId: 'project-1',
        crewId: 'crew-new',
      }),
    );
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

  it('returns a phase diagnostic when schedule context loading fails', async () => {
    loadScheduleContext.mockRejectedValueOnce({ code: 'P0001', message: 'context boom', details: 'context detail', hint: 'context hint' });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/assign', {
        method: 'POST',
        headers: { 'x-request-id': 'req_assign_context_fail' },
      }),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: 'Failed to load schedule data',
      diagnostic: expect.objectContaining({
        phase: 'load_schedule_context',
        requestId: 'req_assign_context_fail',
        errorCode: 'P0001',
        errorMessage: 'context boom',
        errorDetails: 'context detail',
        errorHint: 'context hint',
      }),
    });
    expect(res.headers.get('x-portal-request-id')).toBe('req_assign_context_fail');
  });

  it('returns 500 on a generic RPC failure', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'boom', details: 'detail text', hint: 'hint text' } });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/assign', {
        method: 'POST',
        headers: { 'x-request-id': 'req_assign_fail' },
      }),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: 'Failed to assign scheduled job',
      diagnostic: expect.objectContaining({
        phase: 'commit_rpc',
        requestId: 'req_assign_fail',
        assignmentKind: 'new_assignment',
        targetRawForecastCount: 1,
        targetForecastCount: 1,
        targetForecastNonUuidCount: 0,
        sourceForecastCount: 0,
        sourceForecastNonUuidCount: 0,
        targetPositionCount: 1,
        initialForecastPresent: false,
        sanitizedTempForecastPresent: false,
        errorCode: 'P0001',
        errorMessage: 'boom',
        errorDetails: 'detail text',
        errorHint: 'hint text',
      }),
    });
    expect(res.headers.get('x-portal-request-id')).toBe('req_assign_fail');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[portal]',
      expect.objectContaining({
        event: 'schedule.assign.commit_failed',
        requestId: 'req_assign_fail',
        status: 500,
        reason: 'commit_failed',
        assignmentKind: 'new_assignment',
        targetRawForecastCount: 1,
        targetForecastCount: 1,
        targetForecastNonUuidCount: 0,
        sourceForecastCount: 0,
        sourceForecastNonUuidCount: 0,
        targetPositionCount: 1,
        initialForecastPresent: false,
        sanitizedTempForecastPresent: false,
        jobId: 'project-1',
        crewId: 'crew-new',
        requestedPosition: 1,
        errorCode: 'P0001',
        errorMessage: 'boom',
        errorDetails: 'detail text',
        errorHint: 'hint text',
      }),
    );
  });
});
