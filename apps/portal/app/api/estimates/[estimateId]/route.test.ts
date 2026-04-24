import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const parseJsonBody = vi.fn();
const loadProjectEstimateFlowMaps = vi.fn();
const loadEstimateEditability = vi.fn();
const buildEstimateDbPayload = vi.fn();
const buildVersionLabelMap = vi.fn();
const extractVersionNumber = vi.fn();
const mapEstimateDetail = vi.fn();

const estimateMaybeSingle = vi.fn();
const estimateUpdateSingle = vi.fn();
const estimateOrder = vi.fn();

vi.mock('@/lib/api/staffApi', () => ({
  jsonError: (error: string, status: number) => new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } }),
  jsonOk: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  parseJsonBody,
  requireStaffContext,
}));

vi.mock('@/lib/api/siteVisitsServer', () => ({
  missingColumnFromError: () => null,
}));

vi.mock('@/lib/estimates/flow', () => ({
  estimateFlowStateFor: () => null,
  loadProjectEstimateFlowMaps,
}));

vi.mock('@/lib/estimates/persistence', () => ({
  buildEstimateDbPayload,
}));

vi.mock('@/lib/estimates/server', () => ({
  buildVersionLabelMap,
  extractVersionNumber,
  loadEstimateEditability,
  mapEstimateDetail,
}));

vi.mock('@/lib/supabase/mappers', () => ({
  uuidFromAppId: (_id: string) => 'estimate-uuid',
}));

describe('PATCH /api/estimates/[estimateId]', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffContext.mockReset();
    parseJsonBody.mockReset();
    loadProjectEstimateFlowMaps.mockReset();
    loadEstimateEditability.mockReset();
    buildEstimateDbPayload.mockReset();
    buildVersionLabelMap.mockReset();
    extractVersionNumber.mockReset();
    mapEstimateDetail.mockReset();
    estimateMaybeSingle.mockReset();
    estimateUpdateSingle.mockReset();
    estimateOrder.mockReset();

    requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { email: 'ops@example.com' }, role: 'staff' },
      supabase: {
        from: (table: string) => {
          if (table !== 'estimates') throw new Error(`Unexpected table ${table}`);
          return {
            select: () => ({
              eq: (column: string) => {
                if (column === 'id') {
                  return {
                    maybeSingle: estimateMaybeSingle,
                  };
                }
                if (column === 'project_id') {
                  return {
                    order: estimateOrder,
                  };
                }
                throw new Error(`Unexpected eq column ${column}`);
              },
              order: estimateOrder,
            }),
            update: () => ({
              eq: () => ({
                select: () => ({
                  single: estimateUpdateSingle,
                }),
              }),
            }),
          };
        },
      },
    });
  });

  it('keeps syncedQuoteVersionIds empty after an estimate update', async () => {
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: {
        estimate_update: {
          status: 'draft',
          inputs: { schemaVersion: 'v2' },
          outputs: { totals: { cost_ex_gst: 0, cost_inc_gst: 0 } },
        },
      },
    });

    const existingRow = {
      id: 'estimate-uuid',
      project_id: 'project-uuid',
      status: 'draft',
      outputs: {},
      internal_notes: null,
    };
    const updatedRow = {
      ...existingRow,
      updated_at: '2026-04-02T00:00:00.000Z',
    };

    estimateMaybeSingle.mockResolvedValueOnce({ data: existingRow, error: null });
    estimateUpdateSingle.mockResolvedValue({ data: updatedRow, error: null });
    estimateOrder.mockResolvedValue({ data: [updatedRow], error: null });
    loadEstimateEditability.mockResolvedValue({ isLocked: false });
    loadProjectEstimateFlowMaps.mockResolvedValue({ editabilityByEstimateId: new Map(), flowByEstimateId: new Map() });
    buildEstimateDbPayload.mockReturnValue({ status: 'draft', inputs: {}, outputs: {}, updated_at: updatedRow.updated_at });
    buildVersionLabelMap.mockReturnValue(new Map([['estimate-uuid', 'V1']]));
    extractVersionNumber.mockReturnValue(1);
    mapEstimateDetail.mockReturnValue({ id: 'est_1', projectId: 'proj_1' });

    const mod = await import('./route');
    const res = await mod.PATCH(new Request('http://localhost/api/estimates/est_1', { method: 'PATCH' }), {
      params: Promise.resolve({ estimateId: 'est_1' }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      estimate: { id: 'est_1', projectId: 'proj_1' },
      syncedQuoteVersionIds: [],
    });
  });
});
