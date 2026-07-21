import { describe, expect, it, vi } from 'vitest';
import { listDashboardRecentEstimates } from './operationalLists';

function queryResult(data: unknown[]) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['select', 'eq', 'is', 'order']) {
    query[method] = vi.fn(() => query);
  }
  query.limit = vi.fn(async () => ({ data, error: null }));
  return query;
}

describe('dashboard operational lists', () => {
  it('derives Recent Estimates customer prices from true cost using the canonical quote pricing sequence', async () => {
    const estimates = queryResult([
      {
        id: '00000000-0000-4000-8000-000000000002',
        project_id: '00000000-0000-4000-8000-000000000001',
        status: 'draft',
        version: 3,
        total_true_cost_ex_gst: 1000,
        created_at: '2026-07-20T00:00:00.000Z',
        updated_at: '2026-07-21T00:00:00.000Z',
        projects: { name: 'Auckland Pergola' },
      },
    ]);
    const client = { from: vi.fn(() => estimates) } as any;

    const result = await listDashboardRecentEstimates(client);

    expect(estimates.eq).toHaveBeenCalledWith('status', 'draft');
    expect(estimates.is).toHaveBeenCalledWith('projects.archived_at', null);
    expect(estimates.order).toHaveBeenCalledWith('updated_at', { ascending: false });
    expect(result[0]).toMatchObject({
      projectName: 'Auckland Pergola',
      versionLabel: 'V3',
      status: 'draft',
      customerPriceIncGst: 1437.5,
    });
    expect(result[0]?.href).toContain('?tab=estimates&estimateId=');
  });
});
