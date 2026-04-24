import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loadScheduleContext = vi.fn();
const recomputeForCrew = vi.fn();
const computeJobsWithDriftStatus = vi.fn();
const applyDriftStatusPatches = vi.fn();
const formatCrewScheduleBlocks = vi.fn();
const listBoardProjectsAndEstimates = vi.fn();
const buildUnscheduledJobs = vi.fn();
const isMissingSchemaError = vi.fn();

vi.mock('server-only', () => ({}));

vi.mock('@/lib/scheduling/scheduleV2Server', () => ({
  loadScheduleContext,
  recomputeForCrew,
  computeJobsWithDriftStatus,
  applyDriftStatusPatches,
  formatCrewScheduleBlocks,
  listBoardProjectsAndEstimates,
  buildUnscheduledJobs,
  isMissingSchemaError,
}));

function defaultContext() {
  return {
    crews: [
      {
        id: 'crew-1',
        name: 'Crew One',
        color: '#123456',
        sort_order: 1,
        is_active: true,
        calendar_region: 'Auckland',
        base_available_date: '2026-04-06',
      },
    ],
    items: [
      {
        id: 'item-1',
        crewId: 'crew-1',
        itemType: 'job',
        jobId: 'scheduled-job-1',
        position: 0,
      },
    ],
    jobs: [
      {
        id: 'scheduled-job-1',
        jobId: 'project-1',
        crewId: 'crew-1',
        mode: 'floating',
        plannedCommitmentType: 'fixed_date',
        plannedStart: '2026-04-06',
        plannedFlexDays: 1,
        forecastDurationDays: 1,
        clientUpdateStatus: 'none',
        clientUpdateNeededAt: null,
      },
    ],
    downtimes: [],
    holidays: [],
    closures: [],
    calendar: {
      national: new Set<string>(),
      regional: new Map<string, Set<string>>(),
      closuresGlobal: new Set<string>(),
      closuresRegional: new Map<string, Set<string>>(),
    },
    today: '2026-04-16',
  };
}

describe('loadScheduleBoardResponse', () => {
  beforeEach(() => {
    vi.resetModules();
    loadScheduleContext.mockReset();
    recomputeForCrew.mockReset();
    computeJobsWithDriftStatus.mockReset();
    applyDriftStatusPatches.mockReset();
    formatCrewScheduleBlocks.mockReset();
    listBoardProjectsAndEstimates.mockReset();
    buildUnscheduledJobs.mockReset();
    isMissingSchemaError.mockReset();
    vi.stubEnv('NODE_ENV', 'test');

    loadScheduleContext.mockResolvedValue(defaultContext());
    recomputeForCrew.mockReturnValue({
      blocks: [
        {
          item_id: 'item-1',
          item_type: 'job',
          crew_id: 'crew-1',
          position: 0,
          start: '2026-04-09',
          end_exclusive: '2026-04-10',
          duration_days: 1,
          job_id: 'scheduled-job-1',
        },
      ],
      job_updates: [
        {
          id: 'scheduled-job-1',
          forecast_start: '2026-04-09',
          forecast_end_exclusive: '2026-04-10',
          forecast_duration_days: 1,
        },
      ],
      conflicts: [],
      next_available_date: '2026-04-10',
      issues: [],
    });
    computeJobsWithDriftStatus.mockImplementation(({ jobs }) =>
      jobs.map((job: any) => ({
        ...job,
        driftDays: 3,
        clientUpdateStatus: 'needed',
        clientUpdateNeededAt: '2026-04-16T00:00:00.000Z',
      })),
    );
    formatCrewScheduleBlocks.mockImplementation(({ crewRow, recompute, jobsById }) => {
      const job = jobsById.get('scheduled-job-1');
      return {
        crew_id: crewRow.id,
        items: [
          {
            id: 'item-1',
            item_type: 'job',
            position: 0,
            start: '2026-04-09',
            end_exclusive: '2026-04-10',
            duration_days: 1,
            job: {
              id: job.id,
              job_id: job.jobId,
              crew_id: job.crewId,
              drift_days: job.driftDays,
              client_update_status: job.clientUpdateStatus,
              client_update_needed_at: job.clientUpdateNeededAt,
            },
          },
        ],
        conflicts: recompute.conflicts,
        next_available_date: recompute.next_available_date,
      };
    });
    listBoardProjectsAndEstimates.mockResolvedValue({
      projects: [
        {
          id: 'project-1',
          name: 'Project One',
          pipeline_stage: 'DEPOSIT',
          follow_up_date: null,
        },
      ],
      estimates: [
        {
          id: 'estimate-1',
          project_id: 'project-1',
          status: 'draft',
          created_at: '2026-04-01T00:00:00.000Z',
          version: 1,
          duration_days: 1,
          crew_hours: 9,
        },
      ],
      diagnostics: {
        scheduledProjectCount: 1,
        readyProjectRowCount: 0,
        scheduledProjectRowCount: 1,
        projectCount: 1,
        estimateCount: 1,
        archivedProjectFilterRetried: false,
      },
    });
    buildUnscheduledJobs.mockReturnValue([]);
    isMissingSchemaError.mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('builds Board drift state without calling the drift persistence writer', async () => {
    const { loadScheduleBoardResponse } = await import('./scheduleBoardServer');

    const response = await loadScheduleBoardResponse({
      today: '2026-04-16',
      diagnostics: {
        requestId: 'req-board-read-only',
        route: '/api/staff/v1/schedule/board',
        method: 'GET',
        startedAt: performance.now(),
      },
    });

    expect(applyDriftStatusPatches).not.toHaveBeenCalled();
    expect(computeJobsWithDriftStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        jobs: expect.arrayContaining([expect.objectContaining({ id: 'scheduled-job-1' })]),
        region: 'Auckland',
        nowIso: expect.any(String),
      }),
    );
    expect(response.schedule[0]?.items[0]?.job).toEqual(
      expect.objectContaining({
        id: 'scheduled-job-1',
        drift_days: 3,
        client_update_status: 'needed',
        client_update_needed_at: '2026-04-16T00:00:00.000Z',
      }),
    );
  });

  it('logs explicit Board load phase timings in development without changing the response body', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.stubEnv('NODE_ENV', 'development');

    const { loadScheduleBoardResponse } = await import('./scheduleBoardServer');
    const response = await loadScheduleBoardResponse({
      today: '2026-04-16',
      diagnostics: {
        requestId: 'req-board-phases',
        route: '/api/staff/v1/schedule/board',
        method: 'GET',
        startedAt: performance.now(),
      },
    });

    expect(Object.keys(response).sort()).toEqual(
      ['closures', 'conflicts', 'crews', 'generated_at', 'holidays', 'project_index', 'schedule', 'scheduled_estimate_ids', 'unscheduled_jobs'].sort(),
    );
    expect(debugSpy).toHaveBeenCalledWith(
      '[schedule]',
      expect.objectContaining({
        event: 'schedule.board.load',
        requestId: 'req-board-phases',
        contextMs: expect.any(Number),
        recomputeMs: expect.any(Number),
        driftMs: expect.any(Number),
        formattingMs: expect.any(Number),
        projectEstimateMs: expect.any(Number),
        responseMappingMs: expect.any(Number),
        totalMs: expect.any(Number),
        crewCount: 1,
        scheduledJobCount: 1,
        projectCount: 1,
        estimateCount: 1,
      }),
    );
  });
});
