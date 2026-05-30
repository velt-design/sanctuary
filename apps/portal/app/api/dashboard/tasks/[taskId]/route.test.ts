import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const setDashboardTaskCompleted = vi.fn();

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return {
    ...actual,
    requireStaffContext,
  };
});

vi.mock('@/lib/dashboard/tasks', () => ({
  setDashboardTaskCompleted,
}));

const TASK_ID = '11111111-1111-4111-8111-111111111111';

describe('PATCH /api/dashboard/tasks/[taskId]', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffContext.mockReset();
    setDashboardTaskCompleted.mockReset();

    requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: 'user_1' }, role: 'staff' },
      supabase: { from: vi.fn() },
    });
    setDashboardTaskCompleted.mockResolvedValue({
      id: TASK_ID,
      title: 'Call client',
      completedAt: '2026-05-30T00:00:00.000Z',
      createdAt: '2026-05-30T00:00:00.000Z',
      updatedAt: '2026-05-30T00:00:00.000Z',
    });
  });

  it('validates completed as a boolean', async () => {
    const mod = await import('./route');
    const res = await mod.PATCH(
      new Request(`http://localhost/api/dashboard/tasks/${TASK_ID}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: 'yes' }),
      }),
      { params: Promise.resolve({ taskId: TASK_ID }) },
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'completed must be a boolean' });
    expect(setDashboardTaskCompleted).not.toHaveBeenCalled();
  });

  it('toggles only the authenticated user task', async () => {
    const mod = await import('./route');
    const res = await mod.PATCH(
      new Request(`http://localhost/api/dashboard/tasks/${TASK_ID}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: true }),
      }),
      { params: Promise.resolve({ taskId: TASK_ID }) },
    );

    expect(setDashboardTaskCompleted).toHaveBeenCalledWith(expect.anything(), 'user_1', TASK_ID, true);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(
      expect.objectContaining({ task: expect.objectContaining({ completedAt: '2026-05-30T00:00:00.000Z' }) }),
    );
  });

  it('returns 404 when the task does not belong to the user or no longer exists', async () => {
    setDashboardTaskCompleted.mockResolvedValueOnce(null);

    const mod = await import('./route');
    const res = await mod.PATCH(
      new Request(`http://localhost/api/dashboard/tasks/${TASK_ID}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: true }),
      }),
      { params: Promise.resolve({ taskId: TASK_ID }) },
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Task not found' });
  });
});
