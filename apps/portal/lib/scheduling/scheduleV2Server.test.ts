import { beforeEach, describe, expect, it, vi } from 'vitest';

const from = vi.fn();

vi.mock('server-only', () => ({}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServiceRole: {
    from,
  },
}));

describe('scheduleV2Server lightweight schedule rows', () => {
  beforeEach(() => {
    vi.resetModules();
    from.mockReset();
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
});
