import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const getAiActivityTaskDetail = vi.fn();

vi.mock('@/lib/api/staffApi', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi')),
  requireStaffContext,
}));
vi.mock('@/lib/ai/serverActivity', async () => ({
  ...(await vi.importActual<typeof import('@/lib/ai/serverActivity')>('@/lib/ai/serverActivity')),
  getAiActivityTaskDetail,
}));

const TASK_ID = '11111111-1111-4111-8111-111111111111';
const context = { params: Promise.resolve({ taskId: TASK_ID }) };

describe('GET /api/staff/v1/ai/tasks/[taskId]', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffContext.mockReset().mockResolvedValue({
      ok: true,
      session: { user: { id: 'user-1' }, role: 'staff' },
      supabase: { from: vi.fn() },
    });
    getAiActivityTaskDetail.mockReset().mockResolvedValue({
      task: { taskId: TASK_ID },
      events: [],
      approvals: [],
    });
  });

  it('returns private safe detail for an RLS-visible task', async () => {
    const { GET } = await import('./route');
    const response = await GET(new Request(`http://localhost/api/staff/v1/ai/tasks/${TASK_ID}`, {
      headers: { 'x-request-id': 'req_ai_detail' },
    }), context);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-portal-request-id')).toBe('req_ai_detail');
    expect(getAiActivityTaskDetail).toHaveBeenCalledWith(expect.anything(), TASK_ID);
  });

  it.each([401, 403])('ends access with %s before reading task detail', async (status) => {
    requireStaffContext.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status }),
    });
    const { GET } = await import('./route');
    const response = await GET(new Request(`http://localhost/api/staff/v1/ai/tasks/${TASK_ID}`), context);
    expect(response.status).toBe(status);
    expect(getAiActivityTaskDetail).not.toHaveBeenCalled();
  });

  it('returns the same 404 for a missing or RLS-hidden cross-project task', async () => {
    getAiActivityTaskDetail.mockResolvedValueOnce(null);
    const { GET } = await import('./route');
    const response = await GET(new Request(`http://localhost/api/staff/v1/ai/tasks/${TASK_ID}`), context);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'AI task not found',
      code: 'AI_TASK_NOT_FOUND',
    });
  });

  it('validates the identifier only after access is established', async () => {
    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/staff/v1/ai/tasks/nope'), {
      params: Promise.resolve({ taskId: 'nope' }),
    });
    expect(response.status).toBe(400);
    expect(getAiActivityTaskDetail).not.toHaveBeenCalled();
  });
});
