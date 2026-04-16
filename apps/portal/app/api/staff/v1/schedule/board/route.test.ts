import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  isScheduleBoardBuildError: () => false,
}));

describe('GET /api/staff/v1/schedule/board', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    requireStaffSession.mockReset();
    loadScheduleBoardResponse.mockReset();
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    const res = await mod.GET(
      new Request('http://localhost/api/staff/v1/schedule/board?today=2026-04-07', {
        headers: { 'x-portal-request-id': 'req-board-1' },
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('x-portal-request-id')).toBe('req-board-1');
    expect(res.headers.get('server-timing')).toContain('total;dur=');
    expect(infoSpy).toHaveBeenCalledWith('[portal]', expect.objectContaining({
      event: 'schedule.endpoint',
      requestId: 'req-board-1',
      route: '/api/staff/v1/schedule/board',
      method: 'GET',
      status: 200,
      view: 'board',
      payloadBytes: expect.any(Number),
      durationBudgetMs: expect.any(Number),
      payloadBudgetBytes: expect.any(Number),
      overDurationBudget: expect.any(Boolean),
      overPayloadBudget: expect.any(Boolean),
    }));
    expect(loadScheduleBoardResponse).toHaveBeenCalledWith({
      today: '2026-04-07',
      diagnostics: expect.objectContaining({
        requestId: 'req-board-1',
        route: '/api/staff/v1/schedule/board',
        method: 'GET',
      }),
    });
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
    const res = await mod.GET(
      new Request('http://localhost/api/staff/v1/schedule/board', {
        headers: { 'x-portal-request-id': 'req-board-schema' },
      }),
    );

    expect(res.status).toBe(501);
    expect(res.headers.get('x-portal-request-id')).toBe('req-board-schema');
    expect(res.headers.get('server-timing')).toContain('total;dur=');
    expect(infoSpy).toHaveBeenCalledWith('[portal]', expect.objectContaining({
      event: 'schedule.endpoint',
      requestId: 'req-board-schema',
      status: 501,
      view: 'board',
      reason: 'schema_not_ready',
    }));
    await expect(res.json()).resolves.toEqual({
      error: expect.stringContaining('Schedule schema is not upgraded yet.'),
    });
  });
});
