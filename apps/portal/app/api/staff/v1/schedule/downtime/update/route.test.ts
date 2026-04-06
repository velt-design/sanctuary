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
const recomputeForCrew = vi.fn();

const downtimeMaybeSingle = vi.fn();
const crewDowntimesUpdateEq = vi.fn();

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
  recomputeForCrew,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServer: {
    from: (table: string) => {
      if (table !== 'crew_downtimes') throw new Error(`Unexpected table ${table}`);
      return {
        select: () => ({
          eq: (column: string) => {
            if (column !== 'id') throw new Error(`Unexpected select eq column ${column}`);
            return { maybeSingle: downtimeMaybeSingle };
          },
        }),
        update: (payload: unknown) => ({
          eq: (column: string, id: string) => {
            if (column !== 'id') throw new Error(`Unexpected update eq column ${column}`);
            return crewDowntimesUpdateEq(payload, id);
          },
        }),
      };
    },
  },
}));

describe('POST /api/staff/v1/schedule/downtime/update', () => {
  const missingSchemaError = new Error('missing schema');
  const ctx = { today: '2026-04-10', calendar: {} };
  const downtimeRow = { id: 'dt-1', crew_id: 'crew-1' };
  const crewCtx = {
    crewRow: { calendar_region: 'Auckland' },
    items: [{ id: 'item-1' }],
    jobs: [{ id: 'job-1' }],
    downtimes: [{ id: 'dt-1', durationDays: 1, reason: 'site', note: 'Old note' }],
    recompute: { before: true },
    downtimesById: new Map([['dt-1', { id: 'dt-1', durationDays: 1 }]]),
    jobsById: new Map([['job-1', { id: 'job-1' }]]),
  };
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
    recomputeForCrew.mockReset();
    downtimeMaybeSingle.mockReset();
    crewDowntimesUpdateEq.mockReset();

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' } });
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: { downtime_id: 'dt-1', duration_days: 3, reason: 'TRAVEL', note: ' Buffer ' },
    });
    isMissingSchemaError.mockImplementation((error: unknown) => error === missingSchemaError);
    downtimeMaybeSingle.mockResolvedValue({ data: downtimeRow, error: null });
    loadScheduleContext.mockResolvedValue(ctx);
    buildCrewContext.mockReturnValue(crewCtx);
    recomputeForCrew.mockReturnValue(afterRecompute);
    buildJobMetaMap.mockReturnValue(new Map());
    computeCommitImpacts.mockReturnValue([]);
    formatCrewScheduleBlocks.mockReturnValue(formatted);
    applyJobForecastUpdates.mockResolvedValue(undefined);
    crewDowntimesUpdateEq.mockResolvedValue({ data: null, error: null });
  });

  it('returns 400 when downtime_id is missing', async () => {
    parseJsonBody.mockResolvedValue({ ok: true, body: { duration_days: 3 } });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/downtime/update', { method: 'POST' }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'downtime_id is required' });
  });

  it('returns 404 when the downtime row is absent', async () => {
    downtimeMaybeSingle.mockResolvedValue({ data: null, error: null });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/downtime/update', { method: 'POST' }));

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Downtime not found' });
  });

  it('returns confirmation payload when impacts exist and force is false', async () => {
    const impacts = [{ type: 'delay' }];
    computeCommitImpacts.mockReturnValue(impacts);

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/downtime/update', { method: 'POST' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ requires_confirmation: true, impacts });
    expect(crewDowntimesUpdateEq).not.toHaveBeenCalled();
    expect(applyJobForecastUpdates).not.toHaveBeenCalled();
  });

  it('returns the updated schedule and persists normalized downtime changes', async () => {
    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/downtime/update', { method: 'POST' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      crew_id: 'crew-1',
      schedule: formatted,
      conflicts: formatted.conflicts,
      next_available_date: formatted.next_available_date,
    });
    expect(crewDowntimesUpdateEq).toHaveBeenCalledWith(
      { duration_days: 3, reason: 'travel', note: 'Buffer' },
      'dt-1',
    );
    expect(applyJobForecastUpdates).toHaveBeenCalledWith(afterRecompute.job_updates);
  });
});
