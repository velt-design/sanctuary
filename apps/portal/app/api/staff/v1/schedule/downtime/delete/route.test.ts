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
const removeItem = vi.fn();
const recomputeForCrew = vi.fn();

const downtimeMaybeSingle = vi.fn();
const crewScheduleItemsDeleteEq = vi.fn();
const crewScheduleItemsUpdateEq = vi.fn();
const crewDowntimesDeleteEq = vi.fn();

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
  removeItem,
  recomputeForCrew,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServer: {
    from: (table: string) => {
      if (table === 'crew_downtimes') {
        return {
          select: () => ({
            eq: (column: string) => {
              if (column !== 'id') throw new Error(`Unexpected select eq column ${column}`);
              return { maybeSingle: downtimeMaybeSingle };
            },
          }),
          delete: () => ({
            eq: (column: string, id: string) => {
              if (column !== 'id') throw new Error(`Unexpected delete eq column ${column}`);
              return crewDowntimesDeleteEq(id);
            },
          }),
        };
      }
      if (table === 'crew_schedule_items') {
        return {
          delete: () => ({
            eq: (column: string, id: string) => {
              if (column !== 'downtime_id') throw new Error(`Unexpected delete eq column ${column}`);
              return crewScheduleItemsDeleteEq(id);
            },
          }),
          update: (payload: unknown) => ({
            eq: (column: string, id: string) => {
              if (column !== 'id') throw new Error(`Unexpected update eq column ${column}`);
              return crewScheduleItemsUpdateEq(payload, id);
            },
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  },
}));

describe('POST /api/staff/v1/schedule/downtime/delete failures', () => {
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
    removeItem.mockReset();
    recomputeForCrew.mockReset();
    downtimeMaybeSingle.mockReset();
    crewScheduleItemsDeleteEq.mockReset();
    crewScheduleItemsUpdateEq.mockReset();
    crewDowntimesDeleteEq.mockReset();

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });
    parseJsonBody.mockResolvedValue({ ok: true, body: { downtime_id: 'dt-1' } });
    isMissingSchemaError.mockReturnValue(false);
    downtimeMaybeSingle.mockResolvedValue({ data: { id: 'dt-1', crew_id: 'crew-1' }, error: null });
    loadScheduleContext.mockResolvedValue({ today: '2026-04-10', calendar: {} });
    buildCrewContext.mockReturnValue({
      crewRow: { calendar_region: 'Auckland' },
      items: [{ id: 'item-1' }],
      jobs: [{ id: 'job-1' }],
      downtimes: [{ id: 'dt-1' }],
      recompute: { before: true },
      jobsById: new Map([['job-1', { id: 'job-1' }]]),
    });
    removeItem.mockReturnValue([{ id: 'item-2', position: 0 }]);
    recomputeForCrew.mockReturnValue({ job_updates: [{ id: 'job-update-1' }] });
    buildJobMetaMap.mockReturnValue(new Map());
    computeCommitImpacts.mockReturnValue([]);
    formatCrewScheduleBlocks.mockReturnValue({ lanes: [], conflicts: [], next_available_date: '2026-04-14' });
    crewDowntimesDeleteEq.mockResolvedValue({ data: null, error: null });
    crewScheduleItemsUpdateEq.mockResolvedValue({ data: null, error: null });
  });

  it('returns 500 and stops when the first delete fails', async () => {
    crewScheduleItemsDeleteEq.mockResolvedValue({ data: null, error: { message: 'delete failed' } });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/downtime/delete', {
        method: 'POST',
        headers: { 'x-request-id': 'req_downtime_delete_fail' },
      }),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to delete downtime' });
    expect(res.headers.get('x-portal-request-id')).toBe('req_downtime_delete_fail');
    expect(crewDowntimesDeleteEq).not.toHaveBeenCalled();
    expect(crewScheduleItemsUpdateEq).not.toHaveBeenCalled();
    expect(applyJobForecastUpdates).not.toHaveBeenCalled();
  });
});
