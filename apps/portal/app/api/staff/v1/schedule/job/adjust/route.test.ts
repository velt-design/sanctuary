import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const parseJsonBody = vi.fn();
const buildCrewContext = vi.fn();
const buildJobMetaMap = vi.fn();
const computeCommitImpacts = vi.fn();
const formatCrewScheduleBlocks = vi.fn();
const isMissingSchemaError = vi.fn();
const loadScheduleContext = vi.fn();
const recomputeForCrew = vi.fn();
const snapToday = vi.fn();
const scheduledJobsByProjectMaybeSingle = vi.fn();
const scheduledJobsByIdMaybeSingle = vi.fn();
const rpc = vi.fn();
const PROJECT_UUID = '00000000-0000-4000-8000-000000000101';

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return { ...actual, parseJsonBody, requireStaffContext };
});

vi.mock('@/lib/scheduling/scheduleV2Server', () => ({
  buildCrewContext,
  buildJobMetaMap,
  computeCommitImpacts,
  formatCrewScheduleBlocks,
  isMissingSchemaError,
  loadScheduleContext,
  recomputeForCrew,
  snapToday,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServiceRole: {
    rpc,
  },
}));

describe('POST /api/staff/v1/schedule/job/adjust', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffContext.mockReset();
    parseJsonBody.mockReset();
    buildCrewContext.mockReset();
    buildJobMetaMap.mockReset();
    computeCommitImpacts.mockReset();
    formatCrewScheduleBlocks.mockReset();
    isMissingSchemaError.mockReset();
    loadScheduleContext.mockReset();
    recomputeForCrew.mockReset();
    snapToday.mockReset();
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
                throw new Error(`Unexpected eq column ${column}`);
              },
            }),
          };
        },
      },
    });
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: {
        job_id: PROJECT_UUID,
        requested_start_date: '2026-04-15',
        forecast_duration_days: 4,
      },
    });
    isMissingSchemaError.mockReturnValue(false);
    scheduledJobsByProjectMaybeSingle.mockResolvedValue({
      data: { id: 'scheduled-job-1', crew_id: 'crew-1' },
      error: null,
    });
    scheduledJobsByIdMaybeSingle.mockResolvedValue({ data: null, error: null });
    loadScheduleContext.mockResolvedValue({ today: '2026-04-10', calendar: {} });
    buildCrewContext.mockReturnValue({
      crewRow: { id: 'crew-1', calendar_region: 'Auckland' },
      items: [],
      jobs: [
        {
          id: 'scheduled-job-1',
          jobId: 'job-1',
          crewId: 'crew-1',
          mode: 'floating',
          forecastStart: '2026-04-10',
          forecastDurationDays: 2,
        },
        {
          id: 'scheduled-job-2',
          jobId: 'job-2',
          crewId: 'crew-1',
          mode: 'floating',
          forecastStart: '2026-04-14',
          forecastDurationDays: 2,
        },
      ],
      downtimes: [],
      recompute: { job_updates: [] },
      downtimesById: new Map(),
    });
    recomputeForCrew.mockReturnValue({
      job_updates: [
        {
          id: 'scheduled-job-1',
          forecast_start: '2026-04-15',
          forecast_end_exclusive: '2026-04-21',
          forecast_duration_days: 4,
        },
        {
          id: 'scheduled-job-2',
          forecast_start: '2026-04-21',
          forecast_end_exclusive: '2026-04-23',
          forecast_duration_days: 2,
        },
      ],
    });
    buildJobMetaMap.mockReturnValue(new Map());
    computeCommitImpacts.mockReturnValue([]);
    snapToday.mockReturnValue('2026-04-15');
    formatCrewScheduleBlocks.mockReturnValue({
      crew_id: 'crew-1',
      items: [],
      conflicts: [],
      next_available_date: '2026-04-23',
    });
    rpc.mockResolvedValue({
      data: { updated_job: 'scheduled-job-1', updated_forecasts: 2 },
      error: null,
    });
  });

  it('staff-authenticates before parsing the command', async () => {
    requireStaffContext.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/api/staff/v1/schedule/job/adjust', { method: 'POST' }));

    expect(response.status).toBe(401);
    expect(parseJsonBody).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    [{ job_id: 'job-1', requested_start_date: '2026-04-15', forecast_duration_days: 4 }, 'job_id must be a UUID'],
    [{ requested_start_date: '15/04/2026', forecast_duration_days: 4 }, 'requested_start_date must be a valid YYYY-MM-DD date'],
    [{ requested_start_date: '2026-99-99', forecast_duration_days: 4 }, 'requested_start_date must be a valid YYYY-MM-DD date'],
    [{ requested_start_date: '2026-04-15', forecast_duration_days: 0 }, 'forecast_duration_days must be an integer between 1 and 365'],
    [{ requested_start_date: '2026-04-15', forecast_duration_days: 2.5 }, 'forecast_duration_days must be an integer between 1 and 365'],
    [{ requested_start_date: '2026-04-15', forecast_duration_days: 366 }, 'forecast_duration_days must be an integer between 1 and 365'],
    [{ requested_start_date: '2026-04-15', forecast_duration_days: Number.MAX_SAFE_INTEGER + 1 }, 'forecast_duration_days must be an integer between 1 and 365'],
    [{ requested_start_date: '2026-04-15', forecast_duration_days: 4, force: 'false' }, 'force must be a boolean'],
    [{ requested_start_date: '2026-04-15', forecast_duration_days: 4, today: '2026-02-30' }, 'today must be a valid YYYY-MM-DD date'],
  ])('rejects an invalid adjustment payload %j', async (overrides, error) => {
    parseJsonBody.mockResolvedValueOnce({
      ok: true,
      body: { job_id: PROJECT_UUID, ...overrides },
    });

    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/api/staff/v1/schedule/job/adjust', { method: 'POST' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error });
    expect(scheduledJobsByProjectMaybeSingle).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('previews only other jobs moved by the combined adjustment when force is false', async () => {
    computeCommitImpacts.mockReturnValueOnce([
      { job_id: 'job-1', scheduled_job_id: 'scheduled-job-1', before_start: '2026-04-10', after_start: '2026-04-15' },
      { job_id: 'job-2', scheduled_job_id: 'scheduled-job-2', before_start: '2026-04-14', after_start: '2026-04-21' },
    ]);

    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/api/staff/v1/schedule/job/adjust', { method: 'POST' }));

    expect(recomputeForCrew).toHaveBeenCalledWith(
      expect.objectContaining({
        jobs: expect.arrayContaining([
          expect.objectContaining({
            id: 'scheduled-job-1',
            mode: 'pinned',
            forecastStart: '2026-04-15',
            forecastDurationDays: 4,
          }),
        ]),
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      requires_confirmation: true,
      impacts: [
        {
          job_id: 'job-2',
          scheduled_job_id: 'scheduled-job-2',
          before_start: '2026-04-14',
          after_start: '2026-04-21',
        },
      ],
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(['in_progress', 'paused', 'done'])(
    'rejects a direct timing adjustment for a %s job before recompute or commit',
    async (status) => {
      scheduledJobsByProjectMaybeSingle.mockResolvedValueOnce({
        data: { id: 'scheduled-job-1', crew_id: 'crew-1', status },
        error: null,
      });

      const { POST } = await import('./route');
      const response = await POST(
        new Request('http://localhost/api/staff/v1/schedule/job/adjust', { method: 'POST' }),
      );

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error: 'Only not-started jobs can be moved or resized.',
      });
      expect(loadScheduleContext).not.toHaveBeenCalled();
      expect(recomputeForCrew).not.toHaveBeenCalled();
      expect(rpc).not.toHaveBeenCalled();
    },
  );

  it('commits a target-only change without an unnecessary confirmation', async () => {
    computeCommitImpacts.mockReturnValueOnce([
      { job_id: 'job-1', scheduled_job_id: 'scheduled-job-1', before_start: '2026-04-10', after_start: '2026-04-15' },
    ]);

    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/staff/v1/schedule/job/adjust', {
        method: 'POST',
        headers: { 'x-request-id': 'req_adjust_target_only' },
      }),
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('commits start, pin mode, duration, and forecasts through one RPC call after confirmation', async () => {
    parseJsonBody.mockResolvedValueOnce({
      ok: true,
      body: {
        job_id: PROJECT_UUID,
        requested_start_date: '2026-04-15',
        forecast_duration_days: 4,
        force: true,
      },
    });
    computeCommitImpacts.mockReturnValueOnce([
      { job_id: 'job-2', scheduled_job_id: 'scheduled-job-2', before_start: '2026-04-14', after_start: '2026-04-21' },
    ]);

    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/staff/v1/schedule/job/adjust', {
        method: 'POST',
        headers: { 'x-request-id': 'req_adjust_ok' },
      }),
    );

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('schedule_v2_apply_job_patch', {
      p_scheduled_job_id: 'scheduled-job-1',
      p_job_patch: {
        mode: 'pinned',
        forecast_start: '2026-04-15',
        forecast_duration_days: 4,
      },
      p_forecast_updates: [
        {
          id: 'scheduled-job-1',
          forecast_start: '2026-04-15',
          forecast_end_exclusive: '2026-04-21',
          forecast_duration_days: 4,
        },
        {
          id: 'scheduled-job-2',
          forecast_start: '2026-04-21',
          forecast_end_exclusive: '2026-04-23',
          forecast_duration_days: 2,
        },
      ],
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('x-portal-request-id')).toBe('req_adjust_ok');
    await expect(response.json()).resolves.toEqual({
      ok: true,
      crew_id: 'crew-1',
      schedule: {
        crew_id: 'crew-1',
        items: [],
        conflicts: [],
        next_available_date: '2026-04-23',
      },
      conflicts: [],
      next_available_date: '2026-04-23',
    });
  });

  it('returns 404 without invoking the command when the job is not scheduled', async () => {
    scheduledJobsByProjectMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    scheduledJobsByIdMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/api/staff/v1/schedule/job/adjust', { method: 'POST' }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Scheduled job not found' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns 501 when the atomic Schedule command is not available', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: 'PGRST202',
        message: 'Could not find the function public.schedule_v2_apply_job_patch',
      },
    });

    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/staff/v1/schedule/job/adjust', {
        method: 'POST',
        headers: { 'x-request-id': 'req_adjust_schema' },
      }),
    );

    expect(response.status).toBe(501);
    expect(response.headers.get('x-portal-request-id')).toBe('req_adjust_schema');
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('returns a stable failure when the atomic command fails', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/staff/v1/schedule/job/adjust', {
        method: 'POST',
        headers: { 'x-request-id': 'req_adjust_fail' },
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Failed to adjust scheduled job' });
    expect(response.headers.get('x-portal-request-id')).toBe('req_adjust_fail');
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
