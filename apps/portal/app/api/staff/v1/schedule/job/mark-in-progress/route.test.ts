import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSession = vi.fn();
const parseJsonBody = vi.fn();
const buildCrewContext = vi.fn();
const buildJobMetaMap = vi.fn();
const computeCommitImpacts = vi.fn();
const ensureActualStart = vi.fn();
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
  return { ...actual, parseJsonBody, requireStaffSession };
});

vi.mock('@/lib/scheduling/scheduleV2Server', () => ({
  buildCrewContext,
  buildJobMetaMap,
  computeCommitImpacts,
  ensureActualStart,
  formatCrewScheduleBlocks,
  isMissingSchemaError,
  loadScheduleContext,
  recomputeForCrew,
  snapToday,
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
}));

describe('POST /api/staff/v1/schedule/job/mark-in-progress', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffSession.mockReset();
    parseJsonBody.mockReset();
    buildCrewContext.mockReset();
    buildJobMetaMap.mockReset();
    computeCommitImpacts.mockReset();
    ensureActualStart.mockReset();
    formatCrewScheduleBlocks.mockReset();
    isMissingSchemaError.mockReset();
    loadScheduleContext.mockReset();
    recomputeForCrew.mockReset();
    snapToday.mockReset();
    scheduledJobsByProjectMaybeSingle.mockReset();
    scheduledJobsByIdMaybeSingle.mockReset();
    rpc.mockReset();

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });
    parseJsonBody.mockResolvedValue({ ok: true, body: { job_id: 'job-1' } });
    isMissingSchemaError.mockReturnValue(false);
    scheduledJobsByProjectMaybeSingle.mockResolvedValue({ data: { id: 'scheduled-job-1', crew_id: 'crew-1', actual_start: null }, error: null });
    loadScheduleContext.mockResolvedValue({ today: '2026-04-10', calendar: {} });
    buildCrewContext.mockReturnValue({ crewRow: { id: 'crew-1', calendar_region: 'Auckland' }, items: [], jobs: [{ id: 'scheduled-job-1', actualStart: null }], downtimes: [], recompute: { before: true }, downtimesById: new Map() });
    snapToday.mockReturnValue('2026-04-10');
    ensureActualStart.mockReturnValue('2026-04-10');
    recomputeForCrew.mockReturnValue({ job_updates: [{ id: 'scheduled-job-1', forecast_start: '2026-04-10', forecast_end_exclusive: '2026-04-12', forecast_duration_days: 2 }] });
    buildJobMetaMap.mockReturnValue(new Map());
    computeCommitImpacts.mockReturnValue([]);
    formatCrewScheduleBlocks.mockReturnValue({ crew_id: 'crew-1', items: [], conflicts: [], next_available_date: '2026-04-18' });
    rpc.mockResolvedValue({ data: { updated_job: 'scheduled-job-1', updated_forecasts: 1 }, error: null });
  });

  it('commits mark-in-progress through one RPC call on success', async () => {
    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/mark-in-progress', { method: 'POST', headers: { 'x-request-id': 'req_progress_ok' } }));
    expect(rpc).toHaveBeenCalledWith('schedule_v2_apply_job_patch', {
      p_scheduled_job_id: 'scheduled-job-1',
      p_job_patch: { status: 'in_progress', actual_start: '2026-04-10' },
      p_forecast_updates: [{ id: 'scheduled-job-1', forecast_start: '2026-04-10', forecast_end_exclusive: '2026-04-12', forecast_duration_days: 2 }],
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-portal-request-id')).toBe('req_progress_ok');
  });

  it('returns confirmation before any RPC call', async () => {
    computeCommitImpacts.mockReturnValue([{ job_id: 'job-1' }]);
    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/mark-in-progress', { method: 'POST' }));
    expect(res.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns 501 when the command function is missing', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'missing fn' } });
    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/mark-in-progress', { method: 'POST', headers: { 'x-request-id': 'req_progress_schema' } }));
    expect(res.status).toBe(501);
    expect(res.headers.get('x-portal-request-id')).toBe('req_progress_schema');
  });

  it('returns 500 on a generic RPC failure', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/mark-in-progress', { method: 'POST', headers: { 'x-request-id': 'req_progress_fail' } }));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to mark scheduled job in progress' });
    expect(res.headers.get('x-portal-request-id')).toBe('req_progress_fail');
  });
});
