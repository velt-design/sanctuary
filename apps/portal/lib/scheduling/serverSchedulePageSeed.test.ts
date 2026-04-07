import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadScheduleBoardResponse = vi.fn();

class ScheduleSchemaNotReadyError extends Error {}

vi.mock('@/lib/scheduling/scheduleBoardServer', () => ({
  loadScheduleBoardResponse,
  isScheduleSchemaNotReadyError: (error: unknown) => error instanceof ScheduleSchemaNotReadyError,
}));

describe('loadSchedulePageSeed', () => {
  beforeEach(() => {
    vi.resetModules();
    loadScheduleBoardResponse.mockReset();
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
    await expect(loadSchedulePageSeed()).resolves.toEqual({
      initialScheduleMode: 'v2',
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
  });

  it('falls back to legacy when schedule schema is not ready', async () => {
    loadScheduleBoardResponse.mockRejectedValue(new ScheduleSchemaNotReadyError('Schedule schema is not upgraded yet.'));

    const { loadSchedulePageSeed } = await import('./serverSchedulePageSeed');
    await expect(loadSchedulePageSeed()).resolves.toEqual({
      initialScheduleMode: 'legacy',
      initialV2Snapshot: null,
    });
  });
});
