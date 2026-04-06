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

const scheduledJobsByProjectMaybeSingle = vi.fn();
const scheduledJobsByIdMaybeSingle = vi.fn();
const scheduledJobsDeleteEq = vi.fn();
const crewScheduleItemsDeleteEq = vi.fn();
const crewScheduleItemsUpdateEq = vi.fn();

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
      if (table === 'scheduled_jobs') {
        return {
          select: () => ({
            eq: (column: string) => {
              if (column === 'job_id') return { maybeSingle: scheduledJobsByProjectMaybeSingle };
              if (column === 'id') return { maybeSingle: scheduledJobsByIdMaybeSingle };
              throw new Error(`Unexpected eq column ${column}`);
            },
          }),
          delete: () => ({
            eq: (column: string, id: string) => {
              if (column !== 'id') throw new Error(`Unexpected delete eq column ${column}`);
              return scheduledJobsDeleteEq(id);
            },
          }),
        };
      }
      if (table === 'crew_schedule_items') {
        return {
          delete: () => ({
            eq: (column: string, id: string) => {
              if (column !== 'job_id') throw new Error(`Unexpected delete eq column ${column}`);
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

describe('POST /api/staff/v1/schedule/job/unassign diagnostics', () => {
  const missingSchemaError = new Error('missing schema');
  const ctx = { today: '2026-04-10', calendar: {} };
  const jobRow = { id: 'scheduled-job-1', crew_id: 'crew-1' };
  const crewCtx = {
    crewRow: { calendar_region: 'Auckland' },
    items: [{ id: 'item-1' }],
    jobs: [{ id: 'scheduled-job-1' }, { id: 'scheduled-job-2' }],
    downtimes: [],
    recompute: { before: true },
    downtimesById: new Map(),
  };
  const remainingItems = [{ id: 'item-2', position: 0 }];
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
    removeItem.mockReset();
    recomputeForCrew.mockReset();
    scheduledJobsByProjectMaybeSingle.mockReset();
    scheduledJobsByIdMaybeSingle.mockReset();
    scheduledJobsDeleteEq.mockReset();
    crewScheduleItemsDeleteEq.mockReset();
    crewScheduleItemsUpdateEq.mockReset();

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });
    parseJsonBody.mockResolvedValue({ ok: true, body: { job_id: 'job-1' } });
    isMissingSchemaError.mockImplementation((error: unknown) => error === missingSchemaError);
    scheduledJobsByProjectMaybeSingle.mockResolvedValue({ data: jobRow, error: null });
    loadScheduleContext.mockResolvedValue(ctx);
    buildCrewContext.mockReturnValue(crewCtx);
    removeItem.mockReturnValue(remainingItems);
    recomputeForCrew.mockReturnValue(afterRecompute);
    buildJobMetaMap.mockReturnValue(new Map());
    computeCommitImpacts.mockReturnValue([]);
    formatCrewScheduleBlocks.mockReturnValue(formatted);
    applyJobForecastUpdates.mockResolvedValue(undefined);
    scheduledJobsDeleteEq.mockResolvedValue({ data: null, error: null });
    crewScheduleItemsDeleteEq.mockResolvedValue({ data: null, error: null });
    crewScheduleItemsUpdateEq.mockResolvedValue({ data: null, error: null });
  });

  it('adds diagnostics headers on missing-schema failures', async () => {
    scheduledJobsByProjectMaybeSingle.mockResolvedValue({ data: null, error: missingSchemaError });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/unassign', {
        method: 'POST',
        headers: { 'x-request-id': 'req_unassign_err' },
      }),
    );

    expect(res.status).toBe(501);
    await expect(res.json()).resolves.toEqual({
      error: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.',
    });
    expect(res.headers.get('x-portal-request-id')).toBe('req_unassign_err');
    expect(res.headers.get('server-timing')).toContain('total;dur=');
  });

  it('adds diagnostics headers on success', async () => {
    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/staff/v1/schedule/job/unassign', {
        method: 'POST',
        headers: { 'x-request-id': 'req_unassign_ok' },
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      crew_id: 'crew-1',
      schedule: formatted,
      conflicts: formatted.conflicts,
      next_available_date: formatted.next_available_date,
    });
    expect(res.headers.get('x-portal-request-id')).toBe('req_unassign_ok');
    expect(res.headers.get('server-timing')).toContain('total;dur=');
  });
});
