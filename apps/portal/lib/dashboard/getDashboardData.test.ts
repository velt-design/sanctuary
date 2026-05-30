import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDashboardSnapshotCached = vi.fn();
const listRecentProjectNoteActivity = vi.fn();
const listVisibleDashboardTasks = vi.fn();

vi.mock('./getDashboardSnapshotCached', () => ({
  getDashboardSnapshotCached: (...args: unknown[]) => getDashboardSnapshotCached(...args),
}));

vi.mock('./activity', () => ({
  listRecentProjectNoteActivity: (...args: unknown[]) => listRecentProjectNoteActivity(...args),
}));

vi.mock('./tasks', () => ({
  listVisibleDashboardTasks: (...args: unknown[]) => listVisibleDashboardTasks(...args),
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

    getDashboardSnapshotCached.mockResolvedValue({
      updated_at: '2026-05-30T00:00:00.000Z',
      kpis: { actions_due: 1, new_leads: 2, quotes_to_send: 3, installs_this_week: 4 },
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
  });

  it('maps snapshot data with recent activity and personal tasks', async () => {
    const { getDashboardData } = await import('./getDashboardData');

    const data = await getDashboardData({ queueMode: 'today', userId: 'user_1' });

    expect(getDashboardSnapshotCached).toHaveBeenCalledWith('today');
    expect(listRecentProjectNoteActivity).toHaveBeenCalledTimes(1);
    expect(listVisibleDashboardTasks).toHaveBeenCalledWith(expect.anything(), 'user_1');
    expect(data.kpis.actionsDue).toBe(1);
    expect(data.pipelineCounts.NEW).toBe(2);
    expect(data.recentActivity).toHaveLength(1);
    expect(data.personalTasks).toHaveLength(1);
  });

  it('omits personal tasks when no user id is provided', async () => {
    const { getDashboardData } = await import('./getDashboardData');

    const data = await getDashboardData({ queueMode: 'today' });

    expect(listVisibleDashboardTasks).not.toHaveBeenCalled();
    expect(data.personalTasks).toEqual([]);
  });
});
