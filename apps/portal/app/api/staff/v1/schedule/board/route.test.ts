import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSession = vi.fn();
const loadScheduleBoardResponse = vi.fn();

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return {
    ...actual,
    requireStaffSession,
  };
});

class ScheduleSchemaNotReadyError extends Error {}

vi.mock('@/lib/scheduling/scheduleBoardServer', () => ({
  loadScheduleBoardResponse,
  isScheduleSchemaNotReadyError: (error: unknown) => error instanceof ScheduleSchemaNotReadyError,
}));

describe('GET /api/staff/v1/schedule/board', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffSession.mockReset();
    loadScheduleBoardResponse.mockReset();

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });
  });

  it('returns a lightweight project index for scheduled and unscheduled projects', async () => {
    loadScheduleBoardResponse.mockResolvedValue({
      generated_at: '2026-04-07T00:00:00.000Z',
      crews: [],
      schedule: [],
      project_index: [
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
      ],
      unscheduled_jobs: [
        {
          job_id: 'proj-unscheduled',
          estimate_id: 'est-1',
          project_name: 'Unscheduled Project',
          status: 'DEPOSIT',
          duration_days: 2,
        },
      ],
      conflicts: [],
      scheduled_estimate_ids: {},
      holidays: [],
      closures: [],
    });

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
    loadScheduleBoardResponse.mockRejectedValue(new ScheduleSchemaNotReadyError('Schedule schema is not upgraded yet.'));

    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/staff/v1/schedule/board'));

    expect(res.status).toBe(501);
    await expect(res.json()).resolves.toEqual({
      error: expect.stringContaining('Schedule schema is not upgraded yet.'),
    });
  });
});
