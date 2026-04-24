import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchScheduleBoard = vi.fn();
const fetchScheduleGantt = vi.fn();

vi.mock('@/lib/repo/scheduleV2Repo', () => ({
  fetchScheduleBoard,
  fetchScheduleGantt,
}));

describe('scheduleV2SnapshotQueryOptions', () => {
  beforeEach(() => {
    vi.resetModules();
    fetchScheduleBoard.mockReset();
    fetchScheduleGantt.mockReset();
  });

  it('builds the V2 snapshot from the board API only and maps the lightweight project index', async () => {
    fetchScheduleBoard.mockResolvedValue({
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

    const { SCHEDULE_BOARD_STALE_TIME_MS, scheduleV2SnapshotQueryOptions } = await import('./schedule');
    const opts = scheduleV2SnapshotQueryOptions('example.supabase.co', '2026-04-07');
    const snapshot = await opts.queryFn!({} as any);

    expect(fetchScheduleBoard).toHaveBeenCalledWith({ today: '2026-04-07' });
    expect(opts.staleTime).toBe(SCHEDULE_BOARD_STALE_TIME_MS);
    expect(snapshot.projects).toEqual([
      {
        id: 'proj_22222222-2222-4222-8222-222222222222',
        projectName: 'Pergola A',
        name: 'Pergola A',
        status: 'DEPOSIT',
        nextActionDate: '2026-04-10',
        followUpDate: '2026-04-10',
      },
    ]);
    expect(snapshot.unscheduledJobs).toEqual([
      {
        projectId: 'proj_22222222-2222-4222-8222-222222222222',
        estimateId: 'est_33333333-3333-4333-8333-333333333333',
        projectName: 'Pergola A',
        status: 'DEPOSIT',
        durationDays: 2,
      },
    ]);
  });

  it('builds the V2 snapshot from the Gantt API without unscheduled jobs', async () => {
    fetchScheduleGantt.mockResolvedValue({
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
      items: [],
      project_index: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Pergola A',
          pipeline_stage: 'DEPOSIT',
          follow_up_date: '2026-04-10',
        },
      ],
      scheduled_estimate_ids: {},
      conflicts: [],
      holidays: [{ date: '2026-04-10', name: 'Regional Day', scope: 'regional', region: 'Auckland' }],
      closures: [],
    });

    const { SCHEDULE_GANTT_STALE_TIME_MS, scheduleGanttV2SnapshotQueryOptions } = await import('./schedule');
    const opts = scheduleGanttV2SnapshotQueryOptions('example.supabase.co', '2026-04-07', {
      rangeStart: '2026-04-06',
      rangeEnd: '2026-06-28',
    });
    const snapshot = await opts.queryFn!({} as any);

    expect(fetchScheduleGantt).toHaveBeenCalledWith({
      today: '2026-04-07',
      rangeStart: '2026-04-06',
      rangeEnd: '2026-06-28',
    });
    expect(opts.staleTime).toBe(SCHEDULE_GANTT_STALE_TIME_MS);
    expect(snapshot.unscheduledJobs).toEqual([]);
    expect(snapshot.projects).toEqual([
      {
        id: 'proj_22222222-2222-4222-8222-222222222222',
        projectName: 'Pergola A',
        name: 'Pergola A',
        status: 'DEPOSIT',
        nextActionDate: '2026-04-10',
        followUpDate: '2026-04-10',
      },
    ]);
    expect(snapshot.holidays).toEqual([{ date: '2026-04-10', name: 'Regional Day', scope: 'regional', region: 'Auckland' }]);
  });
});
