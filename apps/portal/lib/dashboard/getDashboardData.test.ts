import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDashboardSnapshotCached = vi.fn();
const listRecentProjectNoteActivity = vi.fn();
const listVisibleDashboardTasks = vi.fn();
const listDashboardRecentEstimates = vi.fn();
const getProjectWorkQueue = vi.fn();

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

vi.mock('@/lib/projects/workItems/repository', () => ({
  getProjectWorkQueue: (...args: unknown[]) => getProjectWorkQueue(...args),
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
    getProjectWorkQueue.mockReset();

    getDashboardSnapshotCached.mockResolvedValue({
      updated_at: '2026-05-30T00:00:00.000Z',
      kpis: { new_leads: 2, quotes_to_send: 3, installs_this_week: 4 },
      attention_counts: {},
      pipeline_counts: { NEW: 2 },
      work_queue: [],
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
    getProjectWorkQueue.mockResolvedValue({
      entries: [{ projectId: 'proj_1', projectName: 'Project One' }],
      generatedAt: '2026-05-30T00:00:00.000Z',
    });
  });

  it('maps snapshot data with recent activity and personal tasks', async () => {
    const { getDashboardData } = await import('./getDashboardData');

    const data = await getDashboardData({ queueMode: 'today', userId: 'user_1' });

    expect(getDashboardSnapshotCached).toHaveBeenCalledWith('today');
    expect(listRecentProjectNoteActivity).toHaveBeenCalledTimes(1);
    expect(listRecentProjectNoteActivity).toHaveBeenCalledWith(expect.anything(), 8);
    expect(listDashboardRecentEstimates).toHaveBeenCalledTimes(1);
    expect(listVisibleDashboardTasks).toHaveBeenCalledWith(expect.anything(), 'user_1');
    expect(data.kpis).toEqual({
      newLeads: 2,
      quotesToSend: 3,
      installsThisWeek: 4,
    });
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

  it('loads the compact V2 Work Queue through the request-bound staff client', async () => {
    const { getDashboardData } = await import('./getDashboardData');
    const staffClient = { rpc: vi.fn() } as never;

    const data = await getDashboardData({
      queueMode: 'today',
      userId: 'user_1',
      supabase: staffClient,
    });

    expect(getProjectWorkQueue).toHaveBeenCalledWith(staffClient, { limit: 5 });
    expect(data.projectWorkQueue).toEqual([
      { projectId: 'proj_1', projectName: 'Project One' },
    ]);
    expect(data.projectWorkQueueAvailable).toBe(true);
  });

  it('keeps the rest of the Dashboard usable when the V2 queue read fails', async () => {
    getProjectWorkQueue.mockRejectedValueOnce(new Error('queue unavailable'));
    const { getDashboardData } = await import('./getDashboardData');

    const data = await getDashboardData({
      queueMode: 'today',
      supabase: { rpc: vi.fn() } as never,
    });

    expect(data.projectWorkQueue).toEqual([]);
    expect(data.projectWorkQueueAvailable).toBe(false);
    expect(data.pipelineCounts.NEW).toBe(2);
  });

  it('does not expose legacy action aggregates or the legacy work queue payload', async () => {
    getDashboardSnapshotCached.mockResolvedValue({
      updated_at: '2026-05-30T00:00:00.000Z',
      kpis: {},
      attention_counts: {
        overdue_actions: 65,
        due_today: 2,
        oldest_overdue_days: 174,
        site_visits_to_book: 12,
        quotes_to_send: 20,
      },
      pipeline_counts: { QUOTING: 20 },
      work_queue: [{ project_id: 'legacy_project' }],
      schedule: { starting_soon: [], crew_next_available: [] },
      site_visits: { unscheduled_count: 12, today: [], next7: [] },
    });
    const { getDashboardData } = await import('./getDashboardData');

    const data = await getDashboardData({ queueMode: 'today' });

    expect(data).not.toHaveProperty('attention');
    expect(data).not.toHaveProperty('workQueue');
    expect(data.pipelineCounts.QUOTING).toBe(20);
  });
});
