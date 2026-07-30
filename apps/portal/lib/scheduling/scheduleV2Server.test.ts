import { beforeEach, describe, expect, it, vi } from 'vitest';

const from = vi.fn();
const getProjectWorkModelV2Ids = vi.fn();

vi.mock('server-only', () => ({}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServiceRole: {
    from,
  },
}));

vi.mock('@/lib/projects/workItems/modelBoundary', () => ({
  getProjectWorkModelV2Ids,
}));

describe('scheduleV2Server lightweight schedule rows', () => {
  beforeEach(() => {
    vi.resetModules();
    from.mockReset();
    getProjectWorkModelV2Ids.mockReset().mockResolvedValue(new Set());
  });

  it('builds unscheduled jobs from lightweight estimate rows without outputs', async () => {
    const { buildUnscheduledJobs } = await import('./scheduleV2Server');

    const jobs = buildUnscheduledJobs({
      projects: [
        {
          id: 'project-1',
          name: 'Pergola A',
          pipeline_stage: 'DEPOSIT',
          follow_up_date: '2026-04-10',
        },
      ],
      estimates: [
        {
          id: 'estimate-1',
          project_id: 'project-1',
          status: 'draft',
          created_at: '2026-04-01T00:00:00.000Z',
          version: 1,
          duration_days: 3,
          crew_hours: 54,
        },
      ],
      scheduledProjectIds: new Set(),
    });

    expect(jobs).toEqual([
      {
        job_id: 'project-1',
        estimate_id: 'estimate-1',
        project_name: 'Pergola A',
        status: 'DEPOSIT',
        duration_days: 3,
      },
    ]);
  });

  it('prefers cached duration_days over crew_hours', async () => {
    const { durationDaysFromEstimate } = await import('./scheduleV2Server');

    expect(
      durationDaysFromEstimate({
        id: 'estimate-1',
        project_id: 'project-1',
        status: 'draft',
        created_at: '2026-04-01T00:00:00.000Z',
        version: 1,
        duration_days: 2,
        crew_hours: 99,
      }),
    ).toBe(2);
  });

  it('falls back from cached crew_hours to whole work days', async () => {
    const { durationDaysFromEstimate } = await import('./scheduleV2Server');

    expect(
      durationDaysFromEstimate({
        id: 'estimate-1',
        project_id: 'project-1',
        status: 'draft',
        created_at: '2026-04-01T00:00:00.000Z',
        version: 1,
        duration_days: null,
        crew_hours: 10,
      }),
    ).toBe(2);
  });

  it('falls back to one day when cached duration fields are missing', async () => {
    const { durationDaysFromEstimate } = await import('./scheduleV2Server');

    expect(
      durationDaysFromEstimate({
        id: 'estimate-1',
        project_id: 'project-1',
        status: 'draft',
        created_at: '2026-04-01T00:00:00.000Z',
        version: 1,
        duration_days: null,
        crew_hours: null,
      }),
    ).toBe(1);
  });

  it('ignores archived estimates and keeps latest non-archived selection', async () => {
    const { buildUnscheduledJobs } = await import('./scheduleV2Server');

    const jobs = buildUnscheduledJobs({
      projects: [
        {
          id: 'project-1',
          name: 'Pergola A',
          pipeline_stage: 'DEPOSIT',
          follow_up_date: null,
        },
      ],
      estimates: [
        {
          id: 'estimate-archived',
          project_id: 'project-1',
          status: 'archived',
          created_at: '2026-04-03T00:00:00.000Z',
          version: 99,
          duration_days: 9,
          crew_hours: null,
        },
        {
          id: 'estimate-old',
          project_id: 'project-1',
          status: 'draft',
          created_at: '2026-04-01T00:00:00.000Z',
          version: 1,
          duration_days: 2,
          crew_hours: null,
        },
        {
          id: 'estimate-latest',
          project_id: 'project-1',
          status: 'draft',
          created_at: '2026-04-02T00:00:00.000Z',
          version: 2,
          duration_days: 4,
          crew_hours: null,
        },
      ],
      scheduledProjectIds: new Set(),
    });

    expect(jobs).toEqual([
      expect.objectContaining({
        estimate_id: 'estimate-latest',
        duration_days: 4,
      }),
    ]);
  });

  it('does not include scheduled projects in unscheduled jobs', async () => {
    const { buildUnscheduledJobs } = await import('./scheduleV2Server');

    const jobs = buildUnscheduledJobs({
      projects: [
        {
          id: 'project-scheduled',
          name: 'Scheduled',
          pipeline_stage: 'DEPOSIT',
          follow_up_date: null,
        },
      ],
      estimates: [
        {
          id: 'estimate-scheduled',
          project_id: 'project-scheduled',
          status: 'draft',
          created_at: '2026-04-01T00:00:00.000Z',
          version: 1,
          duration_days: 2,
          crew_hours: null,
        },
      ],
      scheduledProjectIds: new Set(['project-scheduled']),
    });

    expect(jobs).toEqual([]);
  });

  it('computes drift status in memory without writing scheduled jobs', async () => {
    const { computeJobsWithDriftStatus } = await import('./scheduleV2Server');
    const { buildWorkingDayIndex } = await import('./workingDays');

    const jobs = computeJobsWithDriftStatus({
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
      recompute: {
        blocks: [],
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
      },
      region: 'Auckland',
      calendar: buildWorkingDayIndex(),
      nowIso: '2026-04-16T00:00:00.000Z',
    });

    expect(from).not.toHaveBeenCalled();
    expect(jobs).toEqual([
      expect.objectContaining({
        id: 'scheduled-job-1',
        driftDays: 3,
        clientUpdateStatus: 'needed',
        clientUpdateNeededAt: '2026-04-16T00:00:00.000Z',
      }),
    ]);
  });

  it('preserves acknowledged drift status while computing read-only drift values', async () => {
    const { computeJobsWithDriftStatus } = await import('./scheduleV2Server');
    const { buildWorkingDayIndex } = await import('./workingDays');

    const jobs = computeJobsWithDriftStatus({
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
          clientUpdateStatus: 'acknowledged',
          clientUpdateNeededAt: '2026-04-12T00:00:00.000Z',
          clientUpdateAckAt: '2026-04-13T00:00:00.000Z',
          clientUpdateAckBy: 'ops@example.com',
        },
      ],
      recompute: {
        blocks: [],
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
      },
      region: 'Auckland',
      calendar: buildWorkingDayIndex(),
      nowIso: '2026-04-16T00:00:00.000Z',
    });

    expect(from).not.toHaveBeenCalled();
    expect(jobs).toEqual([
      expect.objectContaining({
        id: 'scheduled-job-1',
        driftDays: 3,
        clientUpdateStatus: 'acknowledged',
        clientUpdateNeededAt: '2026-04-12T00:00:00.000Z',
        clientUpdateAckAt: '2026-04-13T00:00:00.000Z',
        clientUpdateAckBy: 'ops@example.com',
      }),
    ]);
  });

  it('requires Active state only for V2 scheduling-ready projects', async () => {
    const { isSchedulingReadyOperationalProject } = await import('./scheduleV2Server');

    expect(isSchedulingReadyOperationalProject({
      modelVersion: null,
      operationalState: null,
    })).toBe(true);
    expect(isSchedulingReadyOperationalProject({
      modelVersion: 2,
      operationalState: 'ACTIVE',
    })).toBe(true);
    expect(isSchedulingReadyOperationalProject({
      modelVersion: 2,
      operationalState: 'WAITING',
    })).toBe(false);
    expect(isSchedulingReadyOperationalProject({
      modelVersion: 2,
      operationalState: 'CLOSED',
    })).toBe(false);
  });

  it('selects estimate summary fields without full outputs for schedule board loading', async () => {
    const projectSelect = vi.fn().mockResolvedValue({
      data: [{ id: 'project-1', name: 'Pergola A', pipeline_stage: 'DEPOSIT', follow_up_date: null }],
      error: null,
    });
    const estimateSelect = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'estimate-1',
          project_id: 'project-1',
          status: 'draft',
          created_at: '2026-04-01T00:00:00.000Z',
          version: 1,
          duration_days: 2,
          crew_hours: 18,
        },
      ],
      error: null,
    });
    from.mockImplementation((table: string) => {
      if (table === 'projects') return { select: projectSelect };
      if (table === 'estimates') return { select: estimateSelect };
      throw new Error(`Unexpected table ${table}`);
    });

    const { listProjectsAndEstimates } = await import('./scheduleV2Server');
    const result = await listProjectsAndEstimates();

    expect(projectSelect).toHaveBeenCalledWith('id, name, pipeline_stage, follow_up_date');
    expect(estimateSelect).toHaveBeenCalledWith('id, project_id, status, created_at, version, duration_days, crew_hours');
    expect(estimateSelect).not.toHaveBeenCalledWith(expect.stringContaining('outputs'));
    expect(result.estimates).toEqual([
      {
        id: 'estimate-1',
        project_id: 'project-1',
        status: 'draft',
        created_at: '2026-04-01T00:00:00.000Z',
        version: 1,
        duration_days: 2,
        crew_hours: 18,
      },
    ]);
  });

  it('loads board project and estimate rows with schedule-specific filters', async () => {
    const scheduledProjectIn = vi.fn().mockResolvedValue({
      data: [{ id: 'scheduled-project', name: 'Scheduled', pipeline_stage: 'BUILD', follow_up_date: '2026-04-09' }],
      error: null,
    });
    const readyProjectIs = vi.fn().mockResolvedValue({
      data: [{ id: 'ready-project', name: 'Ready', pipeline_stage: 'DEPOSIT', follow_up_date: '2026-04-10' }],
      error: null,
    });
    const readyProjectEq = vi.fn().mockReturnValue({ is: readyProjectIs });
    const projectSelect = vi.fn().mockReturnValueOnce({ in: scheduledProjectIn }).mockReturnValueOnce({ eq: readyProjectEq });
    const estimateIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'estimate-ready',
          project_id: 'ready-project',
          status: 'draft',
          created_at: '2026-04-01T00:00:00.000Z',
          version: 1,
          duration_days: 2,
          crew_hours: 18,
        },
        {
          id: 'estimate-scheduled',
          project_id: 'scheduled-project',
          status: 'draft',
          created_at: '2026-04-02T00:00:00.000Z',
          version: 1,
          duration_days: 3,
          crew_hours: 27,
        },
      ],
      error: null,
    });
    const estimateSelect = vi.fn().mockReturnValue({ in: estimateIn });

    from.mockImplementation((table: string) => {
      if (table === 'projects') return { select: projectSelect };
      if (table === 'estimates') return { select: estimateSelect };
      throw new Error(`Unexpected table ${table}`);
    });

    const { listBoardProjectsAndEstimates } = await import('./scheduleV2Server');
    const result = await listBoardProjectsAndEstimates({ scheduledProjectIds: new Set(['scheduled-project']) });

    expect(projectSelect).toHaveBeenCalledWith('id, name, pipeline_stage, follow_up_date');
    expect(scheduledProjectIn).toHaveBeenCalledWith('id', ['scheduled-project']);
    expect(readyProjectEq).toHaveBeenCalledWith('pipeline_stage', 'DEPOSIT');
    expect(readyProjectIs).toHaveBeenCalledWith('archived_at', null);
    expect(estimateSelect).toHaveBeenCalledWith('id, project_id, status, created_at, version, duration_days, crew_hours');
    expect(estimateSelect).not.toHaveBeenCalledWith(expect.stringContaining('outputs'));
    expect(estimateSelect).not.toHaveBeenCalledWith(expect.stringContaining('inputs'));
    expect(estimateIn).toHaveBeenCalledWith('project_id', ['ready-project', 'scheduled-project']);
    expect(result.projects).toEqual([
      {
        id: 'scheduled-project',
        name: 'Scheduled',
        pipeline_stage: 'BUILD',
        follow_up_date: '2026-04-09',
      },
      {
        id: 'ready-project',
        name: 'Ready',
        pipeline_stage: 'DEPOSIT',
        follow_up_date: '2026-04-10',
      },
    ]);
    expect(result.diagnostics).toEqual({
      scheduledProjectCount: 1,
      scheduledProjectRowCount: 1,
      readyProjectRowCount: 1,
      projectCount: 2,
      estimateCount: 2,
      archivedProjectFilterRetried: false,
    });
  });

  it('filters V2 Waiting projects from the ready pool while retaining scheduled rows', async () => {
    getProjectWorkModelV2Ids.mockResolvedValueOnce(new Set(['active-v2', 'waiting-v2']));
    const scheduledProjectIn = vi.fn().mockResolvedValue({
      data: [{ id: 'scheduled-project', name: 'Scheduled', pipeline_stage: 'DEPOSIT', follow_up_date: null }],
      error: null,
    });
    const readyProjectIs = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'active-v2',
          name: 'Active V2',
          pipeline_stage: 'DEPOSIT',
          follow_up_date: null,
        },
        {
          id: 'waiting-v2',
          name: 'Waiting V2',
          pipeline_stage: 'DEPOSIT',
          follow_up_date: null,
        },
        {
          id: 'legacy-ready',
          name: 'Legacy',
          pipeline_stage: 'DEPOSIT',
          follow_up_date: null,
        },
      ],
      error: null,
    });
    const readyProjectEq = vi.fn().mockReturnValue({ is: readyProjectIs });
    const projectSelect = vi.fn()
      .mockReturnValueOnce({ in: scheduledProjectIn })
      .mockReturnValueOnce({ eq: readyProjectEq });
    const estimateIn = vi.fn().mockResolvedValue({ data: [], error: null });
    const estimateSelect = vi.fn().mockReturnValue({ in: estimateIn });
    const operationalStateIn = vi.fn().mockResolvedValue({
      data: [
        { project_id: 'active-v2', state: 'ACTIVE' },
        { project_id: 'waiting-v2', state: 'WAITING' },
      ],
      error: null,
    });
    const operationalStateSelect = vi.fn().mockReturnValue({ in: operationalStateIn });

    from.mockImplementation((table: string) => {
      if (table === 'projects') return { select: projectSelect };
      if (table === 'estimates') return { select: estimateSelect };
      if (table === 'project_operational_states') return { select: operationalStateSelect };
      throw new Error(`Unexpected table ${table}`);
    });

    const { listBoardProjectsAndEstimates } = await import('./scheduleV2Server');
    const result = await listBoardProjectsAndEstimates({
      scheduledProjectIds: ['scheduled-project'],
    });

    expect(result.projects.map((project) => project.id)).toEqual([
      'scheduled-project',
      'active-v2',
      'legacy-ready',
    ]);
    expect(projectSelect).toHaveBeenCalledWith('id, name, pipeline_stage, follow_up_date');
    expect(operationalStateSelect).toHaveBeenCalledWith('project_id,state');
    expect(operationalStateIn).toHaveBeenCalledWith('project_id', ['active-v2', 'waiting-v2']);
    expect(result.diagnostics.readyProjectRowCount).toBe(2);
    expect(estimateIn).toHaveBeenCalledWith('project_id', [
      'active-v2',
      'legacy-ready',
      'scheduled-project',
    ]);
  });

  it('retries the board ready-project query without archived_at when the schema is older', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const readyProjectIs = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST204', message: 'Could not find the archived_at column' },
    });
    const readyProjectEqWithArchive = vi.fn().mockReturnValue({ is: readyProjectIs });
    const readyProjectEqWithoutArchive = vi.fn().mockResolvedValue({
      data: [{ id: 'ready-project', name: 'Ready', pipeline_stage: 'DEPOSIT', follow_up_date: null }],
      error: null,
    });
    const projectSelect = vi.fn().mockReturnValueOnce({ eq: readyProjectEqWithArchive }).mockReturnValueOnce({ eq: readyProjectEqWithoutArchive });
    const estimateIn = vi.fn().mockResolvedValue({ data: [], error: null });
    const estimateSelect = vi.fn().mockReturnValue({ in: estimateIn });

    from.mockImplementation((table: string) => {
      if (table === 'projects') return { select: projectSelect };
      if (table === 'estimates') return { select: estimateSelect };
      throw new Error(`Unexpected table ${table}`);
    });

    try {
      const { listBoardProjectsAndEstimates } = await import('./scheduleV2Server');
      const result = await listBoardProjectsAndEstimates({
        scheduledProjectIds: [],
        diagnostics: {
          requestId: 'req-board-1',
          route: '/api/staff/v1/schedule/board',
          method: 'GET',
          startedAt: performance.now(),
        },
      });

      expect(readyProjectIs).toHaveBeenCalledWith('archived_at', null);
      expect(readyProjectEqWithoutArchive).toHaveBeenCalledWith('pipeline_stage', 'DEPOSIT');
      expect(warnSpy).toHaveBeenCalledWith(
        '[portal]',
        expect.objectContaining({
          event: 'schedule.board.archived_project_filter_retry',
          requestId: 'req-board-1',
          route: '/api/staff/v1/schedule/board',
        }),
      );
      expect(result.projects).toEqual([
        {
          id: 'ready-project',
          name: 'Ready',
          pipeline_stage: 'DEPOSIT',
          follow_up_date: null,
        },
      ]);
      expect(result.diagnostics.archivedProjectFilterRetried).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
