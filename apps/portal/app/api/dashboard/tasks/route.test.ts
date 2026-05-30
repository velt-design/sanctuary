import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const createDashboardTask = vi.fn();

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return {
    ...actual,
    requireStaffContext,
  };
});

vi.mock('@/lib/dashboard/tasks', async () => {
  const actual = await vi.importActual<typeof import('@/lib/dashboard/tasks')>('@/lib/dashboard/tasks');
  return {
    ...actual,
    createDashboardTask,
  };
});

describe('POST /api/dashboard/tasks', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffContext.mockReset();
    createDashboardTask.mockReset();

    requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: 'user_1' }, role: 'staff' },
      supabase: { from: vi.fn() },
    });
    createDashboardTask.mockResolvedValue({
      id: 'task_1',
      title: 'Call client',
      completedAt: null,
      createdAt: '2026-05-30T00:00:00.000Z',
      updatedAt: '2026-05-30T00:00:00.000Z',
    });
  });

  it('validates non-empty task titles', async () => {
    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/dashboard/tasks', {
        method: 'POST',
        body: JSON.stringify({ title: '   ' }),
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Task title required' });
    expect(createDashboardTask).not.toHaveBeenCalled();
  });

  it('creates a task for the authenticated user', async () => {
    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/dashboard/tasks', {
        method: 'POST',
        body: JSON.stringify({ title: '  Call client  ' }),
      }),
    );

    expect(createDashboardTask).toHaveBeenCalledWith(expect.anything(), 'user_1', 'Call client');
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual(
      expect.objectContaining({ task: expect.objectContaining({ title: 'Call client' }) }),
    );
  });
});
