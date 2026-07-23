import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminContext = vi.fn();
const publishCostingConfigurationDraft = vi.fn();

vi.mock('@/lib/api/adminApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/adminApi')>('@/lib/api/adminApi');
  return { ...actual, requireAdminContext };
});

vi.mock('@/lib/costing/configurationAdmin', () => ({ publishCostingConfigurationDraft }));

describe('POST /api/admin/costing/configurations/:versionId/publish', () => {
  beforeEach(() => {
    requireAdminContext.mockReset();
    publishCostingConfigurationDraft.mockReset();
    requireAdminContext.mockResolvedValue({
      ok: true,
      supabase: { rpc: vi.fn() },
      session: { role: 'admin', user: { id: 'admin-1', email: 'admin@example.com' } },
    });
  });

  it('requires the compare-time hash, current version and an audit note', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ publishNote: 'Reviewed impact.' }),
      }),
      { params: Promise.resolve({ versionId: 'draft-1' }) },
    );

    expect(response.status).toBe(400);
    expect(publishCostingConfigurationDraft).not.toHaveBeenCalled();
  });

  it('publishes only through the guarded domain workflow', async () => {
    publishCostingConfigurationDraft.mockResolvedValue({ id: 'draft-1', status: 'published' });
    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          expectedContentHash: 'a'.repeat(64),
          expectedCurrentVersionId: null,
          publishNote: 'Reviewed representative scenarios.',
        }),
      }),
      { params: Promise.resolve({ versionId: 'draft-1' }) },
    );

    expect(response.status).toBe(200);
    expect(publishCostingConfigurationDraft).toHaveBeenCalledWith(
      expect.anything(),
      'draft-1',
      'a'.repeat(64),
      null,
      'Reviewed representative scenarios.',
    );
  });
});
