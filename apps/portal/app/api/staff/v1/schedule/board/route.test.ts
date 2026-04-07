import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSession = vi.fn();
const loadScheduleContext = vi.fn();
const isMissingSchemaError = vi.fn();
const recomputeForCrew = vi.fn();
const applyDriftStatusPatches = vi.fn();
const formatCrewScheduleBlocks = vi.fn();
const listProjectsAndEstimates = vi.fn();
const buildUnscheduledJobs = vi.fn();

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return {
    ...actual,
    requireStaffSession,
  };
});

vi.mock('@/lib/scheduling/scheduleV2Server', () => ({
  loadScheduleContext,
  isMissingSchemaError,
  recomputeForCrew,
  applyDriftStatusPatches,
  formatCrewScheduleBlocks,
  listProjectsAndEstimates,
  buildUnscheduledJobs,
}));

describe('GET /api/staff/v1/schedule/board', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffSession.mockReset();
    loadScheduleContext.mockReset();
    isMissingSchemaError.mockReset();
    recomputeForCrew.mockReset();
    applyDriftStatusPatches.mockReset();
    formatCrewScheduleBlocks.mockReset();
    listProjectsAndEstimates.mockReset();
    buildUnscheduledJobs.mockReset();

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });
    isMissingSchemaError.mockReturnValue(false);
    loadScheduleContext.mockResolvedValue({
      crews: [
        {
          id: 'crew-1',
          name: 'Crew Alpha',
          color: '#0f766e',
          is_active: true,
          sort_order: 0,
          calendar_region: 'Auckland',
          base_available_date: '2026-04-01',
        },
      ],
      items: [],
      jobs: [
        {
          id: 'sched-job-1',
          jobId: 'proj-scheduled',
          crewId: 'crew-1',
        },
      ],
      downtimes: [],
      holidays: [],
      closures: [],
      calendar: {},
      today: '2026-04-07',
    });
    recomputeForCrew.mockReturnValue({ conflicts: [], next_available_date: '2026-04-08', job_updates: [] });
    applyDriftStatusPatches.mockResolvedValue([
      {
        id: 'sched-job-1',
        jobId: 'proj-scheduled',
        crewId: 'crew-1',
      },
    ]);
    formatCrewScheduleBlocks.mockReturnValue({
      crew_id: 'crew-1',
      items: [],
      conflicts: [],
      next_available_date: '2026-04-08',
    });
  });

  it('returns a lightweight project index for scheduled and unscheduled projects', async () => {
    listProjectsAndEstimates.mockResolvedValue({
      projects: [
        { id: 'proj-scheduled', name: 'Scheduled Project', pipeline_stage: 'DEPOSIT', follow_up_date: '2026-04-09' },
        { id: 'proj-unscheduled', name: 'Unscheduled Project', pipeline_stage: 'DEPOSIT', follow_up_date: '2026-04-10' },
        { id: 'proj-irrelevant', name: 'Irrelevant Project', pipeline_stage: 'NEW', follow_up_date: null },
      ],
      estimates: [],
    });
    buildUnscheduledJobs.mockReturnValue([
      {
        job_id: 'proj-unscheduled',
        estimate_id: 'est-1',
        project_name: 'Unscheduled Project',
        status: 'DEPOSIT',
        duration_days: 2,
      },
    ]);

    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/staff/v1/schedule/board?today=2026-04-07'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.project_index).toEqual([
      {
        id: 'proj-scheduled',
        name: 'Scheduled Project',
        pipeline_stage: 'DEPOSIT',
        follow_up_date: '2026-04-09',
      },
      {
        id: 'proj-unscheduled',
        name: 'Unscheduled Project',
        pipeline_stage: 'DEPOSIT',
        follow_up_date: '2026-04-10',
      },
    ]);
    expect(body.unscheduled_jobs).toEqual([
      expect.objectContaining({
        job_id: 'proj-unscheduled',
      }),
    ]);
  });

  it('returns 501 when schedule schema is missing', async () => {
    const missing = new Error('missing schema');
    loadScheduleContext.mockRejectedValue(missing);
    isMissingSchemaError.mockImplementation((error) => error === missing);

    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/staff/v1/schedule/board'));

    expect(res.status).toBe(501);
    await expect(res.json()).resolves.toEqual({
      error: expect.stringContaining('Schedule schema is not upgraded yet.'),
    });
  });
});
