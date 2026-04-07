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
const reorderItems = vi.fn();
const recomputeForCrew = vi.fn();

const crewScheduleItemUpdateEq = vi.fn();

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
  reorderItems,
  recomputeForCrew,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServer: {
    from: (table: string) => {
      if (table !== 'crew_schedule_items') throw new Error(`Unexpected table ${table}`);
      return {
        update: (payload: unknown) => ({
          eq: (column: string, id: string) => {
            if (column !== 'id') throw new Error(`Unexpected eq column ${column}`);
            return crewScheduleItemUpdateEq(payload, id);
          },
        }),
      };
    },
  },
}));

describe('POST /api/staff/v1/schedule/items/reorder failures', () => {
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
    reorderItems.mockReset();
    recomputeForCrew.mockReset();
    crewScheduleItemUpdateEq.mockReset();

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });
    parseJsonBody.mockResolvedValue({ ok: true, body: { crew_id: 'crew-1', ordered_item_ids: ['item-2', 'item-1'] } });
    isMissingSchemaError.mockReturnValue(false);
    loadScheduleContext.mockResolvedValue({ today: '2026-04-10', calendar: {} });
    buildCrewContext.mockReturnValue({
      crewRow: { calendar_region: 'Auckland' },
      items: [
        { id: 'item-1', position: 0 },
        { id: 'item-2', position: 1 },
      ],
      jobs: [{ id: 'job-1' }],
      downtimes: [],
      recompute: { before: true },
      jobsById: new Map([['job-1', { id: 'job-1' }]]),
      downtimesById: new Map(),
    });
    reorderItems.mockReturnValue([
      { id: 'item-2', position: 0 },
      { id: 'item-1', position: 1 },
    ]);
    recomputeForCrew.mockReturnValue({ job_updates: [{ id: 'job-update-1' }] });
    buildJobMetaMap.mockReturnValue(new Map());
    computeCommitImpacts.mockReturnValue([]);
    formatCrewScheduleBlocks.mockReturnValue({
      lanes: [{ id: 'crew-1' }],
      conflicts: [],
      next_available_date: '2026-04-14',
    });
  });

  it('returns 500 and stops on the first failed reorder write', async () => {
    crewScheduleItemUpdateEq
      .mockResolvedValueOnce({ data: null, error: { message: 'update failed' } })
      .mockResolvedValue({ data: null, error: null });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/items/reorder', {
        method: 'POST',
        headers: { 'x-request-id': 'req_reorder_fail' },
      }),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to reorder schedule items' });
    expect(res.headers.get('x-portal-request-id')).toBe('req_reorder_fail');
    expect(crewScheduleItemUpdateEq).toHaveBeenCalledTimes(1);
    expect(applyJobForecastUpdates).not.toHaveBeenCalled();
  });
});
