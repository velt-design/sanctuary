import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadScheduleBoardResponse = vi.fn();
const loadScheduleGanttResponse = vi.fn();

class ScheduleSchemaNotReadyError extends Error {}

vi.mock('@/lib/scheduling/scheduleBoardServer', () => ({
  loadScheduleBoardResponse,
  isScheduleSchemaNotReadyError: (error: unknown) => error instanceof ScheduleSchemaNotReadyError,
}));
vi.mock('@/lib/scheduling/scheduleGanttServer', () => ({
  loadScheduleGanttResponse,
}));
vi.mock('@/lib/scheduling/scheduleClock', () => ({
  resolveScheduleTodayYmd: () => '2026-04-07',
}));

describe('loadSchedulePageSeed', () => {
  beforeEach(() => {
    vi.resetModules();
    loadScheduleBoardResponse.mockReset();
    loadScheduleGanttResponse.mockReset();
  });

  it('builds a seeded v2 snapshot from the shared board response', async () => {
    loadScheduleBoardResponse.mockResolvedValue({
      generated_at: '2026-04-07T00:00:00.000Z',
      crews: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Crew Alpha',
          color: '#0f766e',
          is_active: true,
          sort_order: 0,
          calendar_region: 'Auckland',
          base_available_date: '2026-04-08',
          next_available_date: '2026-04-09',
        },
      ],
      schedule: [],
      project_index: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Pergola A',
          pipeline_stage: 'DEPOSIT',
          follow_up_date: '2026-04-10',
        },
      ],
      unscheduled_jobs: [
        {
          job_id: '22222222-2222-4222-8222-222222222222',
          estimate_id: '33333333-3333-4333-8333-333333333333',
          project_name: 'Pergola A',
          status: 'DEPOSIT',
          duration_days: 2,
        },
      ],
      conflicts: [],
      scheduled_estimate_ids: {},
      holidays: [],
      closures: [],
    });

    const { loadSchedulePageSeed } = await import('./serverSchedulePageSeed');
    await expect(loadSchedulePageSeed({ view: 'board' })).resolves.toEqual({
      initialScheduleMode: 'v2',
      initialSeedKind: 'board',
      initialV2Snapshot: {
        generatedAt: '2026-04-07T00:00:00.000Z',
        installers: [
          {
            id: 'crew_11111111-1111-4111-8111-111111111111',
            name: 'Crew Alpha',
            color: '#0f766e',
            active: true,
            sortOrder: 0,
            calendarRegion: 'Auckland',
            baseAvailableDate: '2026-04-08',
          },
        ],
        projects: [
          {
            id: 'proj_22222222-2222-4222-8222-222222222222',
            projectName: 'Pergola A',
            name: 'Pergola A',
            status: 'DEPOSIT',
            nextActionDate: '2026-04-10',
            followUpDate: '2026-04-10',
          },
        ],
        scheduleItems: [],
        conflicts: [],
        nextAvailableByInstallerId: {
          'crew_11111111-1111-4111-8111-111111111111': '2026-04-09',
        },
        unscheduledJobs: [
          {
            projectId: 'proj_22222222-2222-4222-8222-222222222222',
            estimateId: 'est_33333333-3333-4333-8333-333333333333',
            projectName: 'Pergola A',
            status: 'DEPOSIT',
            durationDays: 2,
          },
        ],
        holidays: [],
        closures: [],
      },
    });
    expect(loadScheduleBoardResponse).toHaveBeenCalled();
    expect(loadScheduleGanttResponse).not.toHaveBeenCalled();
  });

  it('builds a seeded v2 snapshot from the Gantt response without unscheduled jobs', async () => {
    loadScheduleGanttResponse.mockResolvedValue({
      generated_at: '2026-04-07T00:00:00.000Z',
      range_start: '2026-04-06',
      range_end: '2026-06-28',
      crews: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Crew Alpha',
          color: '#0f766e',
          is_active: true,
          sort_order: 0,
          calendar_region: 'Auckland',
          base_available_date: '2026-04-08',
        },
      ],
      items: [
        {
          id: '44444444-4444-4444-8444-444444444444',
          crew_id: '11111111-1111-4111-8111-111111111111',
          item_type: 'job',
          position: 0,
          start: '2026-04-08',
          end_exclusive: '2026-04-10',
          duration_days: 2,
          downtime: null,
          job: {
            id: '55555555-5555-4555-8555-555555555555',
            job_id: '22222222-2222-4222-8222-222222222222',
            crew_id: '11111111-1111-4111-8111-111111111111',
            mode: 'floating',
            planned_commitment_type: null,
            planned_week_start: null,
            planned_start: null,
            planned_duration_days: null,
            planned_flex_days: null,
            forecast_start: '2026-04-08',
            forecast_end_exclusive: '2026-04-10',
            forecast_duration_days: 2,
            actual_start: null,
            actual_finish: null,
            status: 'not_started',
            days_remaining: null,
          },
        },
      ],
      project_index: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Pergola A',
          pipeline_stage: 'DEPOSIT',
          follow_up_date: '2026-04-10',
        },
      ],
      scheduled_estimate_ids: {
        '22222222-2222-4222-8222-222222222222': '33333333-3333-4333-8333-333333333333',
      },
      conflicts: [],
      holidays: [],
      closures: [],
    });

    const { loadSchedulePageSeed } = await import('./serverSchedulePageSeed');
    const seed = await loadSchedulePageSeed({ view: 'gantt' });

    expect(seed.initialScheduleMode).toBe('v2');
    if (seed.initialScheduleMode !== 'v2') throw new Error('Expected v2 seed');
    expect(seed.initialSeedKind).toBe('gantt');
    expect(seed.initialV2Snapshot.unscheduledJobs).toEqual([]);
    expect(seed.initialV2Snapshot.projects).toEqual([
      {
        id: 'proj_22222222-2222-4222-8222-222222222222',
        projectName: 'Pergola A',
        name: 'Pergola A',
        status: 'DEPOSIT',
        nextActionDate: '2026-04-10',
        followUpDate: '2026-04-10',
      },
    ]);
    expect(seed.initialV2Snapshot.scheduleItems[0]).toMatchObject({
      id: 'sch_44444444-4444-4444-8444-444444444444',
      installerId: 'crew_11111111-1111-4111-8111-111111111111',
      projectId: 'proj_22222222-2222-4222-8222-222222222222',
      estimateId: 'est_33333333-3333-4333-8333-333333333333',
    });
    expect(loadScheduleBoardResponse).not.toHaveBeenCalled();
    expect(loadScheduleGanttResponse).toHaveBeenCalledWith({
      today: '2026-04-07',
      rangeStart: '2026-04-06',
      rangeEnd: '2026-06-28',
    });
  });

  it('falls back to legacy when schedule schema is not ready', async () => {
    loadScheduleBoardResponse.mockRejectedValue(new ScheduleSchemaNotReadyError('Schedule schema is not upgraded yet.'));

    const { loadSchedulePageSeed } = await import('./serverSchedulePageSeed');
    await expect(loadSchedulePageSeed()).resolves.toEqual({
      initialScheduleMode: 'legacy',
      initialV2Snapshot: null,
    });
  });

  it('falls back to legacy when Gantt schedule schema is not ready', async () => {
    loadScheduleGanttResponse.mockRejectedValue(new ScheduleSchemaNotReadyError('Schedule schema is not upgraded yet.'));

    const { loadSchedulePageSeed } = await import('./serverSchedulePageSeed');
    await expect(loadSchedulePageSeed({ view: 'gantt' })).resolves.toEqual({
      initialScheduleMode: 'legacy',
      initialV2Snapshot: null,
    });
  });
});
