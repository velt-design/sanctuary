import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminContext = vi.fn();
const listCostingEstimateCandidates = vi.fn();

vi.mock('@/lib/api/adminApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/adminApi')>('@/lib/api/adminApi');
  return { ...actual, requireAdminContext };
});
vi.mock('@/lib/costing/configurationEstimatePreview', () => ({ listCostingEstimateCandidates }));

describe('/api/admin/costing/estimates', () => {
  beforeEach(() => {
    requireAdminContext.mockReset();
    listCostingEstimateCandidates.mockReset();
    requireAdminContext.mockResolvedValue({
      ok: true,
      supabase: { from: vi.fn() },
      session: { role: 'admin', user: { id: 'admin-1', email: 'admin@example.com' } },
    });
  });

  it('guards estimate discovery and passes a bounded search term', async () => {
    listCostingEstimateCandidates.mockResolvedValue([{ id: 'estimate-1' }]);
    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/admin/costing/estimates?q=Patricia'));
    expect(response.status).toBe(200);
    expect(listCostingEstimateCandidates).toHaveBeenCalledWith(expect.anything(), 'Patricia');
    await expect(response.json()).resolves.toEqual({ estimates: [{ id: 'estimate-1' }] });
  });
});
