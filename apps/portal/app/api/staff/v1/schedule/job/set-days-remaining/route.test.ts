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

const scheduledJobsByProjectMaybeSingle = vi.fn();
const scheduledJobsByIdMaybeSingle = vi.fn();
const scheduledJobsUpdateEq = vi.fn();

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
      if (table !== 'scheduled_jobs') throw new Error(`Unexpected table ${table}`);
      return {
        select: () => ({
          eq: (column: string) => {
            if (column === 'job_id') return { maybeSingle: scheduledJobsByProjectMaybeSingle };
            if (column === 'id') return { maybeSingle: scheduledJobsByIdMaybeSingle };
            throw new Error(`Unexpected eq column ${column}`);
          },
        }),
        update: (payload: unknown) => ({
          eq: (column: string, id: string) => {
            if (column !== 'id') throw new Error(`Unexpected update eq column ${column}`);
            return scheduledJobsUpdateEq(payload, id);
          },
        }),
      };
    },
  },
}));

describe('POST /api/staff/v1/schedule/job/set-days-remaining failures', () => {
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
    scheduledJobsByProjectMaybeSingle.mockReset();
    scheduledJobsByIdMaybeSingle.mockReset();
    scheduledJobsUpdateEq.mockReset();

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });
    parseJsonBody.mockResolvedValue({ ok: true, body: { job_id: 'job-1', days_remaining: 2 } });
    isMissingSchemaError.mockReturnValue(false);
    scheduledJobsByProjectMaybeSingle.mockResolvedValue({ data: { id: 'scheduled-job-1', crew_id: 'crew-1' }, error: null });
    loadScheduleContext.mockResolvedValue({ today: '2026-04-10', calendar: {} });
    buildCrewContext.mockReturnValue({
      crewRow: { calendar_region: 'Auckland' },
      items: [{ id: 'item-1' }],
      jobs: [{ id: 'scheduled-job-1', daysRemaining: 3 }],
      downtimes: [],
      recompute: { before: true },
      downtimesById: new Map(),
    });
    recomputeForCrew.mockReturnValue({ job_updates: [{ id: 'job-update-1' }] });
    buildJobMetaMap.mockReturnValue(new Map());
    computeCommitImpacts.mockReturnValue([]);
    formatCrewScheduleBlocks.mockReturnValue({ lanes: [], conflicts: [], next_available_date: '2026-04-14' });
  });

  it('returns 500 when the scheduled job update fails', async () => {
    scheduledJobsUpdateEq.mockResolvedValue({ data: null, error: { message: 'update failed' } });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/set-days-remaining', {
        method: 'POST',
        headers: { 'x-request-id': 'req_days_remaining_fail' },
      }),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to update scheduled job' });
    expect(res.headers.get('x-portal-request-id')).toBe('req_days_remaining_fail');
    expect(applyJobForecastUpdates).not.toHaveBeenCalled();
  });
});
