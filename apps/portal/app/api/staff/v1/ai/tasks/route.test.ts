import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const listAiActivityTasks = vi.fn();

vi.mock('@/lib/api/staffApi', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi')),
  requireStaffContext,
}));
vi.mock('@/lib/ai/serverActivity', async () => ({
  ...(await vi.importActual<typeof import('@/lib/ai/serverActivity')>('@/lib/ai/serverActivity')),
  listAiActivityTasks,
}));

describe('GET /api/staff/v1/ai/tasks', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffContext.mockReset().mockResolvedValue({
      ok: true,
      session: { user: { id: 'user-1' }, role: 'staff' },
      supabase: { from: vi.fn() },
    });
    listAiActivityTasks.mockReset().mockResolvedValue([{ taskId: 'task-1' }]);
  });

  it('returns a bounded private read from the auth-bound client', async () => {
    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/staff/v1/ai/tasks?status=proposed&limit=10', {
      headers: { 'x-request-id': 'req_ai_list' },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-portal-request-id')).toBe('req_ai_list');
    expect(listAiActivityTasks).toHaveBeenCalledWith(expect.anything(), { status: 'proposed', limit: 10 });
    await expect(response.json()).resolves.toEqual({
      tasks: [{ taskId: 'task-1' }],
      query: { status: 'proposed', limit: 10 },
      generatedAt: expect.any(String),
    });
  });

  it.each([401, 403])('ends access with %s before reading activity', async (status) => {
    requireStaffContext.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status }),
    });
    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/staff/v1/ai/tasks'));
    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(listAiActivityTasks).not.toHaveBeenCalled();
  });

  it('rejects unbounded or unknown filters', async () => {
    const { GET } = await import('./route');
    const statusResponse = await GET(new Request('http://localhost/api/staff/v1/ai/tasks?status=unknown'));
    const limitResponse = await GET(new Request('http://localhost/api/staff/v1/ai/tasks?limit=51'));
    expect(statusResponse.status).toBe(400);
    expect(limitResponse.status).toBe(400);
    expect(listAiActivityTasks).not.toHaveBeenCalled();
  });

  it('maps a session ending during the database read to a safe 401', async () => {
    const { AiActivityReadError } = await import('@/lib/ai/serverActivity');
    listAiActivityTasks.mockRejectedValueOnce(new AiActivityReadError('unauthorized', 'jwt detail'));
    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/staff/v1/ai/tasks'));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized', code: 'SESSION_ENDED' });
  });

  it('reports an unapplied repository schema without exposing database detail', async () => {
    const { AiActivityReadError } = await import('@/lib/ai/serverActivity');
    listAiActivityTasks.mockRejectedValueOnce(new AiActivityReadError('schema_not_ready', 'relation detail'));
    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/staff/v1/ai/tasks'));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'AI activity is not ready',
      code: 'AI_ACTIVITY_SCHEMA_NOT_READY',
    });
  });
});
