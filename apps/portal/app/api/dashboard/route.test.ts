import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const getDashboardData = vi.fn();

vi.mock('@/lib/api/staffApi', () => ({
  requireStaffContext,
}));

vi.mock('@/lib/dashboard/getDashboardData', () => ({
  getDashboardData,
}));

describe('GET /api/dashboard', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffContext.mockReset();
    getDashboardData.mockReset();

    requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: 'user_1', email: 'ops@example.com' }, role: 'staff' },
      supabase: {},
    });
    getDashboardData.mockResolvedValue({
      updatedAtIso: '2026-04-08T00:00:00.000Z',
      kpis: { actionsDue: 1, newLeads: 2, quotesToSend: 3, installsThisWeek: 4 },
      attention: [],
      workQueue: [],
      schedule: { startingSoon: [], crewAvailability: [], hrefBoard: '/staff/schedule', hrefGantt: '/staff/schedule?view=gantt' },
      siteVisits: { unscheduledCount: 0, today: [], next7: [], hrefSiteVisits: '/staff/schedule?tab=site-visits' },
      pipelineCounts: {},
      recentActivity: [],
      personalTasks: [],
    });
  });

  it('returns 401 when staff auth is missing', async () => {
    requireStaffContext.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    });

    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/dashboard'));

    expect(res.status).toBe(401);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(getDashboardData).not.toHaveBeenCalled();
  });

  it('loads dashboard data for authenticated staff requests', async () => {
    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/dashboard?queue=next7'));

    expect(getDashboardData).toHaveBeenCalledWith({
      queueMode: 'next7',
      userId: 'user_1',
      supabase: {},
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    await expect(res.json()).resolves.toEqual(
      expect.objectContaining({
        updatedAtIso: '2026-04-08T00:00:00.000Z',
        kpis: { actionsDue: 1, newLeads: 2, quotesToSend: 3, installsThisWeek: 4 },
      }),
    );
  });

  it('returns private no-store errors when the dashboard read fails', async () => {
    getDashboardData.mockRejectedValueOnce(new Error('Dashboard exploded'));

    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/dashboard'));

    expect(res.status).toBe(500);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    await expect(res.json()).resolves.toEqual({ error: 'Dashboard exploded' });
  });
});
