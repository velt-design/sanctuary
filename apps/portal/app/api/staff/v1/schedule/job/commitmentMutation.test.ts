import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSession = vi.fn();
const parseJsonBody = vi.fn();
const buildCrewContext = vi.fn();
const buildJobMetaMap = vi.fn();
const computeCommitImpacts = vi.fn();
const defaultFlexDaysForCommitment = vi.fn();
const defaultHardLockForCommitment = vi.fn();
const formatCrewScheduleBlocks = vi.fn();
const isMissingSchemaError = vi.fn();
const loadScheduleContext = vi.fn();
const loadScheduledJobRow = vi.fn();
const normalizePlannedCommitmentType = vi.fn();
const recomputeForCrew = vi.fn();
const snapToday = vi.fn();
const startOfWeekMondayYmd = vi.fn();
const rpc = vi.fn();

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return { ...actual, parseJsonBody, requireStaffSession };
});

vi.mock('@/lib/scheduling/scheduleV2Server', () => ({
  buildCrewContext,
  buildJobMetaMap,
  computeCommitImpacts,
  defaultFlexDaysForCommitment,
  defaultHardLockForCommitment,
  formatCrewScheduleBlocks,
  isMissingSchemaError,
  loadScheduleContext,
  loadScheduledJobRow,
  normalizePlannedCommitmentType,
  recomputeForCrew,
  snapToday,
  startOfWeekMondayYmd,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServer: { rpc },
}));

describe('runCommitmentMutation', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffSession.mockReset();
    parseJsonBody.mockReset();
    buildCrewContext.mockReset();
    buildJobMetaMap.mockReset();
    computeCommitImpacts.mockReset();
    defaultFlexDaysForCommitment.mockReset();
    defaultHardLockForCommitment.mockReset();
    formatCrewScheduleBlocks.mockReset();
    isMissingSchemaError.mockReset();
    loadScheduleContext.mockReset();
    loadScheduledJobRow.mockReset();
    normalizePlannedCommitmentType.mockReset();
    recomputeForCrew.mockReset();
    snapToday.mockReset();
    startOfWeekMondayYmd.mockReset();
    rpc.mockReset();

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });
    defaultFlexDaysForCommitment.mockReturnValue(1);
    defaultHardLockForCommitment.mockReturnValue(true);
    isMissingSchemaError.mockReturnValue(false);
    loadScheduledJobRow.mockResolvedValue({ id: 'scheduled-job-1', crew_id: 'crew-1' });
    loadScheduleContext.mockResolvedValue({ today: '2026-04-10', calendar: {} });
    buildCrewContext.mockReturnValue({
      crewRow: { id: 'crew-1', calendar_region: 'Auckland' },
      items: [],
      jobs: [{ id: 'scheduled-job-1', mode: 'floating', forecastStart: null }],
      downtimes: [],
      recompute: { before: true },
      downtimesById: new Map(),
    });
    recomputeForCrew.mockReturnValue({ job_updates: [{ id: 'scheduled-job-1', forecast_start: '2026-04-15', forecast_end_exclusive: '2026-04-17', forecast_duration_days: 2 }] });
    buildJobMetaMap.mockReturnValue(new Map());
    computeCommitImpacts.mockReturnValue([]);
    snapToday.mockReturnValue('2026-04-15');
    startOfWeekMondayYmd.mockReturnValue('2026-04-14');
    formatCrewScheduleBlocks.mockReturnValue({ crew_id: 'crew-1', items: [], conflicts: [], next_available_date: '2026-04-18' });
    rpc.mockResolvedValue({ data: { updated_job: 'scheduled-job-1', history_inserted: true, updated_forecasts: 1 }, error: null });
  });

  it('returns validation errors before any RPC call', async () => {
    parseJsonBody.mockResolvedValueOnce({ ok: true, body: {} });
    const mod = await import('./commitmentMutation');
    const res = await mod.runCommitmentMutation(new Request('http://localhost/api/staff/v1/schedule/job/lock', { method: 'POST' }), 'lock');
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns confirmation before any RPC call', async () => {
    parseJsonBody.mockResolvedValueOnce({
      ok: true,
      body: { job_id: 'job-1', commitment_type: 'fixed_date', start_date: '2026-04-15', duration_days: 2 },
    });
    normalizePlannedCommitmentType.mockReturnValue('fixed_date');
    computeCommitImpacts.mockReturnValue([{ job_id: 'job-1' }]);

    const mod = await import('./commitmentMutation');
    const res = await mod.runCommitmentMutation(new Request('http://localhost/api/staff/v1/schedule/job/lock', { method: 'POST' }), 'lock');
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ requires_confirmation: true, impacts: [{ job_id: 'job-1' }] });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('commits lock through one RPC call on success', async () => {
    parseJsonBody.mockResolvedValueOnce({
      ok: true,
      body: { job_id: 'job-1', commitment_type: 'fixed_date', start_date: '2026-04-15', duration_days: 2 },
    });
    normalizePlannedCommitmentType.mockReturnValue('fixed_date');

    const mod = await import('./commitmentMutation');
    const res = await mod.runCommitmentMutation(new Request('http://localhost/api/staff/v1/schedule/job/lock', { method: 'POST', headers: { 'x-request-id': 'req_lock_ok' } }), 'lock');

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]?.[0]).toBe('schedule_v2_apply_commitment');
    expect(rpc.mock.calls[0]?.[1]).toEqual({
      p_scheduled_job_id: 'scheduled-job-1',
      p_job_patch: {
        mode: 'pinned',
        planned_commitment_type: 'fixed_date',
        planned_week_start: null,
        planned_start: '2026-04-15',
        planned_duration_days: 2,
        planned_flex_days: 1,
        planned_locked_at: expect.any(String),
        planned_locked_by: 'ops@example.com',
        client_update_status: 'none',
        client_update_needed_at: null,
        client_update_ack_at: null,
        client_update_ack_by: null,
        forecast_start: '2026-04-15',
      },
      p_history: {
        event_type: 'lock',
        commitment_type: 'fixed_date',
        planned_week_start: null,
        planned_start: '2026-04-15',
        planned_duration_days: 2,
        planned_flex_days: 1,
        hard_lock: true,
        changed_by: 'ops@example.com',
      },
      p_forecast_updates: [{ id: 'scheduled-job-1', forecast_start: '2026-04-15', forecast_end_exclusive: '2026-04-17', forecast_duration_days: 2 }],
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-portal-request-id')).toBe('req_lock_ok');
  });

  it('commits reschedule through one RPC call on success', async () => {
    parseJsonBody.mockResolvedValueOnce({
      ok: true,
      body: {
        job_id: 'job-1',
        commitment_type: 'week_of',
        week_of_date: '2026-04-15',
        duration_days: 3,
        flex_days: 2,
        hard_lock: false,
      },
    });
    normalizePlannedCommitmentType.mockReturnValue('week_of');

    const mod = await import('./commitmentMutation');
    const res = await mod.runCommitmentMutation(new Request('http://localhost/api/staff/v1/schedule/job/reschedule', { method: 'POST', headers: { 'x-request-id': 'req_reschedule_ok' } }), 'reschedule');

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]?.[1]).toEqual({
      p_scheduled_job_id: 'scheduled-job-1',
      p_job_patch: {
        mode: 'floating',
        planned_commitment_type: 'week_of',
        planned_week_start: '2026-04-14',
        planned_start: '2026-04-14',
        planned_duration_days: 3,
        planned_flex_days: 2,
        planned_locked_at: expect.any(String),
        planned_locked_by: 'ops@example.com',
        client_update_status: 'none',
        client_update_needed_at: null,
        client_update_ack_at: null,
        client_update_ack_by: null,
      },
      p_history: {
        event_type: 'reschedule',
        commitment_type: 'week_of',
        planned_week_start: '2026-04-14',
        planned_start: '2026-04-14',
        planned_duration_days: 3,
        planned_flex_days: 2,
        hard_lock: false,
        changed_by: 'ops@example.com',
      },
      p_forecast_updates: [{ id: 'scheduled-job-1', forecast_start: '2026-04-15', forecast_end_exclusive: '2026-04-17', forecast_duration_days: 2 }],
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-portal-request-id')).toBe('req_reschedule_ok');
  });

  it('returns 501 when the command function is missing', async () => {
    parseJsonBody.mockResolvedValueOnce({
      ok: true,
      body: { job_id: 'job-1', commitment_type: 'fixed_date', start_date: '2026-04-15', duration_days: 2 },
    });
    normalizePlannedCommitmentType.mockReturnValue('fixed_date');
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'missing fn' } });

    const mod = await import('./commitmentMutation');
    const res = await mod.runCommitmentMutation(new Request('http://localhost/api/staff/v1/schedule/job/lock', { method: 'POST', headers: { 'x-request-id': 'req_lock_schema' } }), 'lock');
    expect(res.status).toBe(501);
    expect(res.headers.get('x-portal-request-id')).toBe('req_lock_schema');
  });

  it('returns 500 on a generic RPC failure', async () => {
    parseJsonBody.mockResolvedValueOnce({
      ok: true,
      body: { job_id: 'job-1', commitment_type: 'fixed_date', start_date: '2026-04-15', duration_days: 2 },
    });
    normalizePlannedCommitmentType.mockReturnValue('fixed_date');
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const mod = await import('./commitmentMutation');
    const res = await mod.runCommitmentMutation(new Request('http://localhost/api/staff/v1/schedule/job/lock', { method: 'POST', headers: { 'x-request-id': 'req_lock_fail' } }), 'lock');
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to update planned commitment' });
    expect(res.headers.get('x-portal-request-id')).toBe('req_lock_fail');
  });
});
