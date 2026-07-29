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

describe('POST /api/staff/v1/schedule/job/pin', () => {
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
    parseJsonBody.mockResolvedValue({ ok: true, body: { job_id: 'job-1', requested_start_date: '2026-04-15' } });
    isMissingSchemaError.mockReturnValue(false);
    scheduledJobsByProjectMaybeSingle.mockResolvedValue({ data: { id: 'scheduled-job-1', crew_id: 'crew-1' }, error: null });
    loadScheduleContext.mockResolvedValue({ today: '2026-04-10', calendar: {} });
    buildCrewContext.mockReturnValue({
      crewRow: { id: 'crew-1', calendar_region: 'Auckland' },
      items: [],
      jobs: [{ id: 'scheduled-job-1', mode: 'floating' }],
      downtimes: [],
      recompute: { before: true },
      downtimesById: new Map(),
    });
    snapToday.mockReturnValue('2026-04-15');
    recomputeForCrew.mockReturnValue({ job_updates: [{ id: 'scheduled-job-1', forecast_start: '2026-04-15', forecast_end_exclusive: '2026-04-17', forecast_duration_days: 2 }] });
    buildJobMetaMap.mockReturnValue(new Map());
    computeCommitImpacts.mockReturnValue([]);
    formatCrewScheduleBlocks.mockReturnValue({ crew_id: 'crew-1', items: [], conflicts: [], next_available_date: '2026-04-18' });
    rpc.mockResolvedValue({ data: { updated_job: 'scheduled-job-1', updated_forecasts: 1 }, error: null });
  });

  it('commits pin through one RPC call on success', async () => {
    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/pin', { method: 'POST', headers: { 'x-request-id': 'req_pin_ok' } }));

    expect(rpc).toHaveBeenCalledWith('schedule_v2_apply_job_patch', {
      p_scheduled_job_id: 'scheduled-job-1',
      p_job_patch: { mode: 'pinned', forecast_start: '2026-04-15' },
      p_forecast_updates: [{ id: 'scheduled-job-1', forecast_start: '2026-04-15', forecast_end_exclusive: '2026-04-17', forecast_duration_days: 2 }],
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-portal-request-id')).toBe('req_pin_ok');
  });

  it('requires confirmation only for another affected job', async () => {
    computeCommitImpacts.mockReturnValue([
      { job_id: 'job-1', scheduled_job_id: 'scheduled-job-1', before_start: '2026-04-10', after_start: '2026-04-15' },
      { job_id: 'job-2', scheduled_job_id: 'scheduled-job-2', before_start: '2026-04-12', after_start: '2026-04-17' },
    ]);
    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/pin', { method: 'POST' }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      requires_confirmation: true,
      impacts: [
        { job_id: 'job-2', scheduled_job_id: 'scheduled-job-2', before_start: '2026-04-12', after_start: '2026-04-17' },
      ],
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns 501 when the command function is missing', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.schedule_v2_apply_job_patch' } });
    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/pin', { method: 'POST', headers: { 'x-request-id': 'req_pin_schema' } }));
    expect(res.status).toBe(501);
    expect(res.headers.get('x-portal-request-id')).toBe('req_pin_schema');
  });

  it('returns 500 on a generic RPC failure', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/pin', { method: 'POST', headers: { 'x-request-id': 'req_pin_fail' } }));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to pin scheduled job' });
    expect(res.headers.get('x-portal-request-id')).toBe('req_pin_fail');
  });
});
