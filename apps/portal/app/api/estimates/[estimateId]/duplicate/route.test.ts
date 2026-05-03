import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const buildEstimateDbPayload = vi.fn();
const resolveEstimatePricingSourceForSave = vi.fn();
const logEstimatePricingSourceAudit = vi.fn();
const buildVersionLabelMap = vi.fn();
const mapEstimateDetail = vi.fn();

const estimateByIdMaybeSingle = vi.fn();
const existingOrder = vi.fn();
const estimateInsert = vi.fn();
const estimateInsertSingle = vi.fn();

vi.mock('@/lib/api/staffApi', () => ({
  jsonError: (error: string, status: number, _diagnostics?: unknown, extra?: Record<string, unknown>) =>
    new Response(JSON.stringify({ error, ...(extra ?? {}) }), { status, headers: { 'content-type': 'application/json' } }),
  jsonOk: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  requireStaffContext,
}));

vi.mock('@/lib/api/siteVisitsServer', () => ({
  missingColumnFromError: () => null,
}));

vi.mock('@/lib/estimates/persistence', () => ({
  buildEstimateDbPayload,
}));

vi.mock('@/lib/estimates/pricingRollout', () => ({
  logEstimatePricingSourceAudit,
  resolveEstimatePricingSourceForSave,
}));

vi.mock('@/lib/estimates/server', () => ({
  buildVersionLabelMap,
  calculatorSnapshotFromRow: (row: any) => ({
    inputs: row.inputs ?? {},
    outputs: row.outputs ?? {},
    warnings: row.warnings ?? [],
  }),
  mapEstimateDetail,
}));

vi.mock('@/lib/supabase/mappers', () => ({
  isRecord: (value: unknown) => Boolean(value && typeof value === 'object' && !Array.isArray(value)),
  uuidFromAppId: (_id: string, prefix: string) => (prefix === 'proj' ? 'project-uuid' : 'estimate-uuid'),
}));

describe('POST /api/estimates/[estimateId]/duplicate', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffContext.mockReset();
    buildEstimateDbPayload.mockReset();
    resolveEstimatePricingSourceForSave.mockReset();
    logEstimatePricingSourceAudit.mockReset();
    buildVersionLabelMap.mockReset();
    mapEstimateDetail.mockReset();
    estimateByIdMaybeSingle.mockReset();
    existingOrder.mockReset();
    estimateInsert.mockReset();
    estimateInsertSingle.mockReset();

    resolveEstimatePricingSourceForSave.mockReturnValue({
      ok: true,
      context: {
        pricingSource: 'calculator_live',
        pricingSourceMetadata: { gateVersion: 'estimate_pricing_rollout_prep_v1' },
        commercialDesignInput: null,
      },
      normalizedRequest: { requestedPricingSource: 'calculator_live', raw: null },
      readinessReport: null,
    });
    logEstimatePricingSourceAudit.mockResolvedValue(true);
    buildEstimateDbPayload.mockReturnValue({
      status: 'draft',
      inputs: {},
      outputs: {},
      pricing_source: 'calculator_live',
      pricing_source_metadata: { gateVersion: 'estimate_pricing_rollout_prep_v1' },
      commercial_design_input: null,
    });
    buildVersionLabelMap.mockReturnValue(new Map());
    mapEstimateDetail.mockReturnValue({ id: 'est_2', projectId: 'proj_1' });

    requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: 'user-1', email: 'ops@example.com' }, role: 'staff' },
      supabase: {
        from: (table: string) => {
          if (table !== 'estimates' && table !== 'audit_events') throw new Error(`Unexpected table ${table}`);
          if (table === 'audit_events') {
            return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
          }
          return {
            select: () => ({
              eq: (column: string) => {
                if (column === 'id') return { maybeSingle: estimateByIdMaybeSingle };
                if (column === 'project_id') return { order: existingOrder };
                throw new Error(`Unexpected eq column ${column}`);
              },
            }),
            insert: estimateInsert.mockImplementation(() => ({
              select: () => ({
                single: estimateInsertSingle,
              }),
            })),
          };
        },
      },
    });
  });

  it('duplicates estimates with calculator_live source fields', async () => {
    estimateByIdMaybeSingle.mockResolvedValue({
      data: {
        id: 'estimate-uuid',
        project_id: 'project-uuid',
        inputs: { schemaVersion: 'v2' },
        outputs: { totals: { cost_ex_gst: 0, cost_inc_gst: 0 } },
        warnings: [],
      },
      error: null,
    });
    existingOrder.mockResolvedValue({ data: [{ id: 'estimate-uuid', outputs: { version: 1 }, created_at: '2026-05-01' }], error: null });
    estimateInsertSingle.mockResolvedValue({ data: { id: 'new-estimate-uuid', project_id: 'project-uuid' }, error: null });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/estimates/est_1/duplicate', { method: 'POST' }), {
      params: Promise.resolve({ estimateId: 'est_1' }),
    });

    expect(res.status).toBe(201);
    expect(buildEstimateDbPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        createdBy: 'ops@example.com',
        internalNotes: null,
        pricingSourceContext: expect.objectContaining({ pricingSource: 'calculator_live' }),
      }),
    );
    expect(estimateInsert).toHaveBeenCalledWith(expect.objectContaining({ pricing_source: 'calculator_live' }));
    await expect(res.json()).resolves.toEqual({ estimate: { id: 'est_2', projectId: 'proj_1' } });
  });

  it('blocks workbench_solved duplicate attempts before inserting', async () => {
    estimateByIdMaybeSingle.mockResolvedValue({
      data: {
        id: 'estimate-uuid',
        project_id: 'project-uuid',
        inputs: { schemaVersion: 'v2' },
        outputs: { totals: { cost_ex_gst: 0, cost_inc_gst: 0 } },
        warnings: [],
      },
      error: null,
    });
    existingOrder.mockResolvedValue({ data: [], error: null });
    resolveEstimatePricingSourceForSave.mockReturnValue({
      ok: false,
      code: 'ESTIMATE_PRICING_SOURCE_BLOCKED',
      message: 'Workbench solved estimate pricing is not ready to save.',
      status: 409,
      normalizedRequest: { requestedPricingSource: 'workbench_solved', raw: 'workbench_solved' },
      readinessReport: { blockingGateCodes: ['workbench_solved_ready'], fallbackPricingSource: null },
      metadata: { gateVersion: 'estimate_pricing_rollout_prep_v1' },
    });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/estimates/est_1/duplicate', { method: 'POST' }), {
      params: Promise.resolve({ estimateId: 'est_1' }),
    });

    expect(res.status).toBe(409);
    expect(estimateInsert).not.toHaveBeenCalled();
    expect(buildEstimateDbPayload).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({
      code: 'ESTIMATE_PRICING_SOURCE_BLOCKED',
      readinessReport: { blockingGateCodes: ['workbench_solved_ready'] },
    });
  });
});
