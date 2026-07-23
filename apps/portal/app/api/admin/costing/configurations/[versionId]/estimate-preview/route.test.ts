import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminContext = vi.fn();
const previewCostingDraftAgainstEstimate = vi.fn();

vi.mock('@/lib/api/adminApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/adminApi')>('@/lib/api/adminApi');
  return { ...actual, requireAdminContext };
});
vi.mock('@/lib/costing/configurationEstimatePreview', () => ({ previewCostingDraftAgainstEstimate }));

const context = { params: Promise.resolve({ versionId: 'draft-1' }) };

describe('/api/admin/costing/configurations/:versionId/estimate-preview', () => {
  beforeEach(() => {
    requireAdminContext.mockReset();
    previewCostingDraftAgainstEstimate.mockReset();
    requireAdminContext.mockResolvedValue({
      ok: true,
      supabase: { from: vi.fn() },
      session: { role: 'admin', user: { id: 'admin-1', email: 'admin@example.com' } },
    });
  });

  it('requires a saved draft hash and returns a read-only comparison', async () => {
    previewCostingDraftAgainstEstimate.mockResolvedValue({
      draftContentHash: 'a'.repeat(64),
      estimate: { id: 'estimate-1' },
    });
    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ estimateId: 'estimate-1', expectedContentHash: 'a'.repeat(64) }),
    }), context);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(previewCostingDraftAgainstEstimate).toHaveBeenCalledWith(
      expect.anything(),
      'draft-1',
      'estimate-1',
      'a'.repeat(64),
    );
  });

  it('maps stale preview requests to a conflict', async () => {
    previewCostingDraftAgainstEstimate.mockRejectedValue(new Error('The draft changed. Save it first.'));
    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ estimateId: 'estimate-1', expectedContentHash: 'b'.repeat(64) }),
    }), context);
    expect(response.status).toBe(409);
  });
});
