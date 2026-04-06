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
  reorderItems,
  recomputeForCrew,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServer: {
    from: (table: string) => {
      if (table !== 'crew_schedule_items') throw new Error(`Unexpected table ${table}`);
      return {
        update: (payload: unknown) => ({
          eq: (idColumn: string, id: string) => {
            if (idColumn !== 'id') throw new Error(`Unexpected eq column ${idColumn}`);
            return crewScheduleItemUpdateEq(payload, id);
          },
        }),
      };
    },
  },
}));

describe('POST /api/staff/v1/schedule/items/reorder', () => {
  const missingSchemaError = new Error('missing schema');
  const ctx = { today: '2026-04-10', calendar: {} };
  const crewCtx = {
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
  };
  const reorderedItems = [
    { id: 'item-2', position: 0 },
    { id: 'item-1', position: 1 },
  ];
  const afterRecompute = { job_updates: [{ id: 'job-1' }] };
  const formatted = {
    lanes: [{ id: 'crew-1' }],
    conflicts: [{ code: 'conflict-1' }],
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
    reorderItems.mockReset();
    recomputeForCrew.mockReset();
    crewScheduleItemUpdateEq.mockReset();

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' } });
    parseJsonBody.mockResolvedValue({ ok: true, body: { crew_id: 'crew-1', ordered_item_ids: ['item-2', 'item-1'] } });
    isMissingSchemaError.mockImplementation((error: unknown) => error === missingSchemaError);
    loadScheduleContext.mockResolvedValue(ctx);
    buildCrewContext.mockReturnValue(crewCtx);
    reorderItems.mockReturnValue(reorderedItems);
    recomputeForCrew.mockReturnValue(afterRecompute);
    buildJobMetaMap.mockReturnValue(new Map());
    computeCommitImpacts.mockReturnValue([]);
    formatCrewScheduleBlocks.mockReturnValue(formatted);
    applyJobForecastUpdates.mockResolvedValue(undefined);
    crewScheduleItemUpdateEq.mockResolvedValue({ data: null, error: null });
  });

  it('returns 401 when there is no staff session', async () => {
    requireStaffSession.mockResolvedValue(null);

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/items/reorder', { method: 'POST' }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('returns 501 when schedule schema is not ready', async () => {
    loadScheduleContext.mockRejectedValue(missingSchemaError);

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/items/reorder', { method: 'POST' }));

    expect(res.status).toBe(501);
    await expect(res.json()).resolves.toEqual({
      error: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.',
    });
  });

  it('returns confirmation payload when impacts exist and force is false', async () => {
    const impacts = [{ type: 'shift' }];
    computeCommitImpacts.mockReturnValue(impacts);

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/items/reorder', { method: 'POST' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ requires_confirmation: true, impacts });
    expect(crewScheduleItemUpdateEq).not.toHaveBeenCalled();
    expect(applyJobForecastUpdates).not.toHaveBeenCalled();
  });

  it('returns the updated schedule and persists reordered item positions', async () => {
    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/items/reorder', { method: 'POST' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      crew_id: 'crew-1',
      schedule: formatted,
      conflicts: formatted.conflicts,
      next_available_date: formatted.next_available_date,
    });
    expect(crewScheduleItemUpdateEq).toHaveBeenCalledTimes(2);
    expect(crewScheduleItemUpdateEq).toHaveBeenNthCalledWith(1, { position: 0 }, 'item-2');
    expect(crewScheduleItemUpdateEq).toHaveBeenNthCalledWith(2, { position: 1 }, 'item-1');
    expect(applyJobForecastUpdates).toHaveBeenCalledWith(afterRecompute.job_updates);
  });
});
