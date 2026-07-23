import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminContext = vi.fn();
const createCostingConfigurationDraft = vi.fn();
const listCostingConfigurationOverview = vi.fn();

vi.mock('@/lib/api/adminApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/adminApi')>('@/lib/api/adminApi');
  return { ...actual, requireAdminContext };
});

vi.mock('@/lib/costing/configurationAdmin', () => ({
  createCostingConfigurationDraft,
  listCostingConfigurationOverview,
}));

describe('/api/admin/costing/configurations', () => {
  beforeEach(() => {
    requireAdminContext.mockReset();
    createCostingConfigurationDraft.mockReset();
    listCostingConfigurationOverview.mockReset();
    requireAdminContext.mockResolvedValue({
      ok: true,
      supabase: { from: vi.fn() },
      session: {
        role: 'admin',
        user: { id: 'admin-1', email: 'admin@example.com' },
      },
    });
  });

  it('enforces the standard admin context before reading configuration history', async () => {
    requireAdminContext.mockResolvedValue({
      ok: false,
      response: new Response('Forbidden', { status: 403 }),
    });
    const { GET } = await import('./route');

    const response = await GET();

    expect(response.status).toBe(403);
    expect(listCostingConfigurationOverview).not.toHaveBeenCalled();
  });

  it('lists version history and the active source', async () => {
    listCostingConfigurationOverview.mockResolvedValue({
      currentVersionId: null,
      currentSource: 'legacy-overrides',
      versions: [],
    });
    const { GET } = await import('./route');

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      currentVersionId: null,
      currentSource: 'legacy-overrides',
      versions: [],
    });
  });

  it('creates a draft with the authenticated actor and an optional rollback source', async () => {
    createCostingConfigurationDraft.mockResolvedValue({ id: 'draft-1', status: 'draft' });
    const { POST } = await import('./route');
    const request = new Request('http://localhost/api/admin/costing/configurations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourceVersionId: 'published-2' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(createCostingConfigurationDraft).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'admin-1', email: 'admin@example.com' },
      'published-2',
    );
  });
});
