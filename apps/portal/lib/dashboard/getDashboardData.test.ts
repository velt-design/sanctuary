import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDashboardSnapshotCached = vi.fn();
const listRecentProjectNoteActivity = vi.fn();
const listVisibleDashboardTasks = vi.fn();
const listDashboardRecentEstimates = vi.fn();
const getProjectOperationalStateCounts = vi.fn();

vi.mock('./getDashboardSnapshotCached', () => ({
  getDashboardSnapshotCached: (...args: unknown[]) => getDashboardSnapshotCached(...args),
}));

vi.mock('./activity', () => ({
  listRecentProjectNoteActivity: (...args: unknown[]) => listRecentProjectNoteActivity(...args),
}));

vi.mock('./tasks', () => ({
  listVisibleDashboardTasks: (...args: unknown[]) => listVisibleDashboardTasks(...args),
}));

vi.mock('./operationalLists', () => ({
  listDashboardRecentEstimates: (...args: unknown[]) => listDashboardRecentEstimates(...args),
}));

vi.mock('@/lib/projects/workItems/stateCounts', () => ({
  getProjectOperationalStateCounts: (...args: unknown[]) =>
    getProjectOperationalStateCounts(...args),
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServiceRole: { from: vi.fn() },
}));

describe('getDashboardData', () => {
  beforeEach(() => {
    vi.resetModules();
    getDashboardSnapshotCached.mockReset();
    listRecentProjectNoteActivity.mockReset();
    listVisibleDashboardTasks.mockReset();
    listDashboardRecentEstimates.mockReset();
    getProjectOperationalStateCounts.mockReset().mockResolvedValue({
      ACTIVE: 1,
      WAITING: 0,
      CLOSED: 0,
      ARCHIVED: 0,
      totalCount: 1,
    });

    getDashboardSnapshotCached.mockResolvedValue({
      updated_at: '2026-05-30T00:00:00.000Z',
      kpis: { actions_due: 1, new_leads: 2, quotes_to_send: 3, installs_this_week: 4 },
      pipeline_counts: { NEW: 2 },
      schedule: { starting_soon: [], crew_next_available: [] },
      site_visits: { unscheduled_count: 0, today: [], next7: [] },
    });
    listRecentProjectNoteActivity.mockResolvedValue([
      {
        id: 'note_1',
        type: 'project_note',
        at: '2026-05-30T00:00:00.000Z',
        body: 'New project note',
        projectId: 'proj_1',
        projectName: 'Project One',
        href: '/staff/projects/proj_1',
      },
    ]);
    listVisibleDashboardTasks.mockResolvedValue([
      {
        id: 'task_1',
        title: 'Call client',
        completedAt: null,
        createdAt: '2026-05-30T00:00:00.000Z',
        updatedAt: '2026-05-30T00:00:00.000Z',
      },
    ]);
    listDashboardRecentEstimates.mockResolvedValue([
      {
        estimateId: 'est_1',
        projectId: 'proj_1',
        projectName: 'Project One',
        versionLabel: 'V2',
        status: 'draft',
        customerPriceIncGst: 1437.5,
        updatedAt: '2026-05-30T00:00:00.000Z',
        href: '/staff/projects/proj_1?tab=estimates&estimateId=est_1',
      },
    ]);
  });

  it('maps snapshot data with recent activity and personal tasks', async () => {
    const { getDashboardData } = await import('./getDashboardData');

    const data = await getDashboardData({ queueMode: 'today', userId: 'user_1' });

    expect(getDashboardSnapshotCached).toHaveBeenCalledWith('today');
    expect(listRecentProjectNoteActivity).toHaveBeenCalledTimes(1);
    expect(listRecentProjectNoteActivity).toHaveBeenCalledWith(expect.anything(), 8);
    expect(listDashboardRecentEstimates).toHaveBeenCalledTimes(1);
    expect(listVisibleDashboardTasks).toHaveBeenCalledWith(expect.anything(), 'user_1');
    expect(data.kpis.newLeads).toBe(2);
    expect(data.pipelineCounts.NEW).toBe(2);
    expect(data.recentActivity).toHaveLength(1);
    expect(data.personalTasks).toHaveLength(1);
    expect(data.recentEstimates[0]?.customerPriceIncGst).toBe(1437.5);
  });

  it('omits personal tasks when no user id is provided', async () => {
    const { getDashboardData } = await import('./getDashboardData');

    const data = await getDashboardData({ queueMode: 'today' });

    expect(listVisibleDashboardTasks).not.toHaveBeenCalled();
    expect(data.personalTasks).toEqual([]);
  });

  it('loads portfolio state counts through the request-bound staff client', async () => {
    const { getDashboardData } = await import('./getDashboardData');
    const staffClient = { rpc: vi.fn() } as never;

    const data = await getDashboardData({
      queueMode: 'today',
      userId: 'user_1',
      supabase: staffClient,
    });

    expect(getProjectOperationalStateCounts).toHaveBeenCalledWith(staffClient);
    expect(data.projectStateCounts).toEqual(expect.objectContaining({ ACTIVE: 1, totalCount: 1 }));
    expect(data.projectStateCountsAvailable).toBe(true);
  });

  it('keeps the rest of the Dashboard usable when the state-count read fails', async () => {
    getProjectOperationalStateCounts.mockRejectedValueOnce(new Error('state counts unavailable'));
    const { getDashboardData } = await import('./getDashboardData');

    const data = await getDashboardData({
      queueMode: 'today',
      supabase: { rpc: vi.fn() } as never,
    });

    expect(data.projectStateCounts).toBeUndefined();
    expect(data.projectStateCountsAvailable).toBe(false);
    expect(data.pipelineCounts.NEW).toBe(2);
  });

  it('maps the site-visit snapshot independently from Project Work', async () => {
    getDashboardSnapshotCached.mockResolvedValue({
      updated_at: '2026-05-30T00:00:00.000Z',
      kpis: {},
      pipeline_counts: {},
      schedule: { starting_soon: [], crew_next_available: [] },
      site_visits: { unscheduled_count: 12, today: [], next7: [] },
    });
    const { getDashboardData } = await import('./getDashboardData');

    const data = await getDashboardData({ queueMode: 'today' });

    expect(data.siteVisits.unscheduledCount).toBe(12);
  });
});
