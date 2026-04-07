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

describe('POST /api/staff/v1/schedule/downtime/update failures', () => {
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

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });
    parseJsonBody.mockResolvedValue({ ok: true, body: { downtime_id: 'dt-1', duration_days: 3, reason: 'TRAVEL', note: ' Buffer ' } });
    isMissingSchemaError.mockReturnValue(false);
    downtimeMaybeSingle.mockResolvedValue({ data: { id: 'dt-1', crew_id: 'crew-1' }, error: null });
    loadScheduleContext.mockResolvedValue({ today: '2026-04-10', calendar: {} });
    buildCrewContext.mockReturnValue({
      crewRow: { calendar_region: 'Auckland' },
      items: [{ id: 'item-1' }],
      jobs: [{ id: 'job-1' }],
      downtimes: [{ id: 'dt-1', durationDays: 1, reason: 'site', note: 'Old note' }],
      recompute: { before: true },
      downtimesById: new Map([['dt-1', { id: 'dt-1', durationDays: 1 }]]),
      jobsById: new Map([['job-1', { id: 'job-1' }]]),
    });
    recomputeForCrew.mockReturnValue({ job_updates: [{ id: 'job-update-1' }] });
    buildJobMetaMap.mockReturnValue(new Map());
    computeCommitImpacts.mockReturnValue([]);
    formatCrewScheduleBlocks.mockReturnValue({ lanes: [], conflicts: [], next_available_date: '2026-04-14' });
  });

  it('returns 500 when the downtime write fails and does not update forecasts', async () => {
    crewDowntimesUpdateEq.mockResolvedValue({ data: null, error: { message: 'update failed' } });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/downtime/update', {
        method: 'POST',
        headers: { 'x-request-id': 'req_downtime_update_fail' },
      }),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to update downtime' });
    expect(res.headers.get('x-portal-request-id')).toBe('req_downtime_update_fail');
    expect(applyJobForecastUpdates).not.toHaveBeenCalled();
  });
});
