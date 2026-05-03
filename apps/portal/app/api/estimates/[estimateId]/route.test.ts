import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const parseJsonBody = vi.fn();
const loadProjectEstimateFlowMaps = vi.fn();
const loadEstimateEditability = vi.fn();
const buildEstimateDbPayload = vi.fn();
const logEstimatePricingSourceAudit = vi.fn();
const buildVersionLabelMap = vi.fn();
const extractVersionNumber = vi.fn();
const mapEstimateDetail = vi.fn();

const estimateMaybeSingle = vi.fn();
const estimateUpdate = vi.fn();
const estimateUpdateSingle = vi.fn();
const estimateOrder = vi.fn();

const ORIGINAL_PRICING_SOURCE_ENV = process.env.PORTAL_ESTIMATE_PRICING_SOURCE;

vi.mock('@/lib/api/staffApi', () => ({
  jsonError: (error: string, status: number, _diagnostics?: unknown, extra?: Record<string, unknown>) =>
    new Response(JSON.stringify({ error, ...(extra ?? {}) }), { status, headers: { 'content-type': 'application/json' } }),
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

vi.mock('@/lib/estimates/pricingRollout', async () => {
  const actual = await vi.importActual<typeof import('@/lib/estimates/pricingRollout')>('@/lib/estimates/pricingRollout');
  return {
    ...actual,
    logEstimatePricingSourceAudit,
  };
});

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
  afterEach(() => {
    if (ORIGINAL_PRICING_SOURCE_ENV === undefined) {
      delete process.env.PORTAL_ESTIMATE_PRICING_SOURCE;
    } else {
      process.env.PORTAL_ESTIMATE_PRICING_SOURCE = ORIGINAL_PRICING_SOURCE_ENV;
    }
  });

  beforeEach(() => {
    vi.resetModules();
    delete process.env.PORTAL_ESTIMATE_PRICING_SOURCE;
    requireStaffContext.mockReset();
    parseJsonBody.mockReset();
    loadProjectEstimateFlowMaps.mockReset();
    loadEstimateEditability.mockReset();
    buildEstimateDbPayload.mockReset();
    logEstimatePricingSourceAudit.mockReset();
    buildVersionLabelMap.mockReset();
    extractVersionNumber.mockReset();
    mapEstimateDetail.mockReset();
    estimateMaybeSingle.mockReset();
    estimateUpdate.mockReset();
    estimateUpdateSingle.mockReset();
    estimateOrder.mockReset();
    logEstimatePricingSourceAudit.mockResolvedValue(true);
    buildEstimateDbPayload.mockImplementation((params) => ({
      status: 'draft',
      inputs: params.inputs ?? {},
      outputs: params.outputs ?? {},
      updated_at: params.updatedAt,
      pricing_source: params.pricingSourceContext?.pricingSource,
      pricing_source_metadata: params.pricingSourceContext?.pricingSourceMetadata,
      commercial_design_input: params.pricingSourceContext?.commercialDesignInput ?? null,
    }));

    requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: 'user-1', email: 'ops@example.com' }, role: 'staff' },
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
            update: estimateUpdate.mockImplementation(() => ({
              eq: () => ({
                select: () => ({
                  single: estimateUpdateSingle,
                }),
              }),
            })),
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
    buildVersionLabelMap.mockReturnValue(new Map([['estimate-uuid', 'V1']]));
    extractVersionNumber.mockReturnValue(1);
    mapEstimateDetail.mockReturnValue({ id: 'est_1', projectId: 'proj_1' });

    const mod = await import('./route');
    const res = await mod.PATCH(new Request('http://localhost/api/estimates/est_1', { method: 'PATCH' }), {
      params: Promise.resolve({ estimateId: 'est_1' }),
    });

    expect(res.status).toBe(200);
    expect(buildEstimateDbPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        pricingSourceContext: expect.objectContaining({
          pricingSource: 'calculator_live',
          commercialDesignInput: null,
          pricingSourceMetadata: expect.objectContaining({
            requestedSource: 'calculator_live',
            requestedSourceRaw: null,
            selectedSource: 'calculator_live',
            defaultedReason: 'unset',
          }),
        }),
      }),
    );
    expect(estimateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        pricing_source: 'calculator_live',
        pricing_source_metadata: expect.objectContaining({
          requestedSource: 'calculator_live',
          selectedSource: 'calculator_live',
          defaultedReason: 'unset',
        }),
        commercial_design_input: null,
      }),
    );
    expect(logEstimatePricingSourceAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'estimate.pricing_source_saved',
        estimateUuid: 'estimate-uuid',
      }),
    );
    await expect(res.json()).resolves.toEqual({
      estimate: { id: 'est_1', projectId: 'proj_1' },
      syncedQuoteVersionIds: [],
    });
  });

  it('falls back invalid pricing source config to calculator_live on update', async () => {
    process.env.PORTAL_ESTIMATE_PRICING_SOURCE = 'workbench';
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
    buildVersionLabelMap.mockReturnValue(new Map([['estimate-uuid', 'V1']]));
    extractVersionNumber.mockReturnValue(1);
    mapEstimateDetail.mockReturnValue({ id: 'est_1', projectId: 'proj_1' });

    const mod = await import('./route');
    const res = await mod.PATCH(new Request('http://localhost/api/estimates/est_1', { method: 'PATCH' }), {
      params: Promise.resolve({ estimateId: 'est_1' }),
    });

    expect(res.status).toBe(200);
    expect(estimateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        pricing_source: 'calculator_live',
        pricing_source_metadata: expect.objectContaining({
          requestedSource: 'calculator_live',
          requestedSourceRaw: 'workbench',
          selectedSource: 'calculator_live',
          defaultedReason: 'invalid',
        }),
        commercial_design_input: null,
      }),
    );
  });

  it('blocks workbench_solved pricing without updating the estimate row', async () => {
    process.env.PORTAL_ESTIMATE_PRICING_SOURCE = 'workbench_solved';
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
    estimateMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'estimate-uuid',
        project_id: 'project-uuid',
        status: 'draft',
        outputs: {},
        internal_notes: null,
      },
      error: null,
    });
    loadEstimateEditability.mockResolvedValue({ isLocked: false });

    const mod = await import('./route');
    const res = await mod.PATCH(new Request('http://localhost/api/estimates/est_1', { method: 'PATCH' }), {
      params: Promise.resolve({ estimateId: 'est_1' }),
    });

    expect(res.status).toBe(409);
    expect(estimateUpdate).not.toHaveBeenCalled();
    expect(estimateUpdateSingle).not.toHaveBeenCalled();
    expect(buildEstimateDbPayload).not.toHaveBeenCalled();
    expect(logEstimatePricingSourceAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'estimate.pricing_source_blocked',
        estimateUuid: 'estimate-uuid',
        payload: expect.objectContaining({
          requestedSource: 'workbench_solved',
          requestedSourceRaw: 'workbench_solved',
          blockingGateCodes: expect.arrayContaining(['workbench_solved_ready']),
        }),
      }),
    );
    await expect(res.json()).resolves.toMatchObject({
      code: 'ESTIMATE_PRICING_SOURCE_BLOCKED',
      readinessReport: {
        fallbackPricingSource: null,
        blockingGateCodes: expect.arrayContaining(['workbench_solved_ready']),
      },
    });
  });

  it('keeps estimate locks ahead of pricing source evaluation', async () => {
    process.env.PORTAL_ESTIMATE_PRICING_SOURCE = 'workbench_solved';
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
    estimateMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'estimate-uuid',
        project_id: 'project-uuid',
        status: 'draft',
        outputs: {},
        internal_notes: null,
      },
      error: null,
    });
    loadEstimateEditability.mockResolvedValue({ isLocked: true, lockReason: 'quote_sent' });

    const mod = await import('./route');
    const res = await mod.PATCH(new Request('http://localhost/api/estimates/est_1', { method: 'PATCH' }), {
      params: Promise.resolve({ estimateId: 'est_1' }),
    });

    expect(res.status).toBe(409);
    expect(logEstimatePricingSourceAudit).not.toHaveBeenCalled();
    expect(estimateUpdate).not.toHaveBeenCalled();
    expect(estimateUpdateSingle).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({ code: 'ESTIMATE_LOCKED' });
  });
});
