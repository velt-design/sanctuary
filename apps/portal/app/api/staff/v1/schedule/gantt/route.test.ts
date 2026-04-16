import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSession = vi.fn();
const loadScheduleGanttResponse = vi.fn();

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return {
    ...actual,
    requireStaffSession,
  };
});

class ScheduleSchemaNotReadyError extends Error {}

vi.mock('@/lib/scheduling/scheduleBoardServer', () => ({
  isScheduleSchemaNotReadyError: (error: unknown) => error instanceof ScheduleSchemaNotReadyError,
}));

vi.mock('@/lib/scheduling/scheduleGanttServer', () => ({
  loadScheduleGanttResponse,
}));

describe('GET /api/staff/v1/schedule/gantt', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    requireStaffSession.mockReset();
    loadScheduleGanttResponse.mockReset();
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns diagnostics headers and logs endpoint telemetry without changing the body', async () => {
    const gantt = {
      generated_at: '2026-04-07T00:00:00.000Z',
      range: { start: '2026-04-06', end: '2026-06-28' },
      crews: [],
      schedule: [],
      project_index: [],
      unscheduled_jobs: [],
      conflicts: [],
      scheduled_estimate_ids: {},
      holidays: [],
      closures: [],
    };
    loadScheduleGanttResponse.mockResolvedValue(gantt);

    const mod = await import('./route');
    const res = await mod.GET(
      new Request('http://localhost/api/staff/v1/schedule/gantt?rangeStart=2026-04-06&rangeEnd=2026-06-28&today=2026-04-07', {
        headers: { 'x-portal-request-id': 'req-gantt-1' },
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('x-portal-request-id')).toBe('req-gantt-1');
    expect(res.headers.get('server-timing')).toContain('total;dur=');
    expect(loadScheduleGanttResponse).toHaveBeenCalledWith({
      rangeStart: '2026-04-06',
      rangeEnd: '2026-06-28',
      today: '2026-04-07',
    });
    expect(infoSpy).toHaveBeenCalledWith('[portal]', expect.objectContaining({
      event: 'schedule.endpoint',
      requestId: 'req-gantt-1',
      route: '/api/staff/v1/schedule/gantt',
      method: 'GET',
      status: 200,
      view: 'gantt',
      rangeStart: '2026-04-06',
      rangeEnd: '2026-06-28',
      payloadBytes: expect.any(Number),
      durationBudgetMs: expect.any(Number),
      payloadBudgetBytes: expect.any(Number),
      overDurationBudget: expect.any(Boolean),
      overPayloadBudget: expect.any(Boolean),
    }));
    await expect(res.json()).resolves.toEqual(gantt);
  });

  it('rejects invalid ranges with diagnostics headers and endpoint telemetry', async () => {
    const mod = await import('./route');
    const res = await mod.GET(
      new Request('http://localhost/api/staff/v1/schedule/gantt?rangeStart=2026-04-06', {
        headers: { 'x-portal-request-id': 'req-gantt-invalid' },
      }),
    );

    expect(res.status).toBe(400);
    expect(res.headers.get('x-portal-request-id')).toBe('req-gantt-invalid');
    expect(res.headers.get('server-timing')).toContain('total;dur=');
    expect(loadScheduleGanttResponse).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith('[portal]', expect.objectContaining({
      event: 'schedule.endpoint',
      requestId: 'req-gantt-invalid',
      status: 400,
      view: 'gantt',
      reason: 'invalid_range',
    }));
    await expect(res.json()).resolves.toEqual({
      error: 'rangeStart and rangeEnd are required YYYY-MM-DD values.',
    });
  });
});
