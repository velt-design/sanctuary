import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const parseJsonBody = vi.fn();
const buildEstimateDbPayload = vi.fn();
const logEstimatePricingSourceAudit = vi.fn();
const buildVersionLabelMap = vi.fn();
const extractVersionNumber = vi.fn();
const loadProjectEstimateFlowMaps = vi.fn();
const mapEstimateDetail = vi.fn();
const mapEstimateMeta = vi.fn();

const estimateExistingOrder = vi.fn();
const estimateInsertSingle = vi.fn();
const estimateInsert = vi.fn();

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
  calculatorSnapshotFromRow: () => ({ inputs: {}, outputs: {}, warnings: [] }),
  extractVersionNumber,
  mapEstimateDetail,
  mapEstimateMeta,
}));

vi.mock('@/lib/supabase/mappers', () => ({
  isRecord: (value: unknown) => Boolean(value && typeof value === 'object' && !Array.isArray(value)),
  uuidFromAppId: (_id: string) => 'project-uuid',
}));

describe('POST /api/projects/[projectId]/estimates', () => {
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
    buildEstimateDbPayload.mockReset();
    logEstimatePricingSourceAudit.mockReset();
    buildVersionLabelMap.mockReset();
    extractVersionNumber.mockReset();
    loadProjectEstimateFlowMaps.mockReset();
    mapEstimateDetail.mockReset();
    mapEstimateMeta.mockReset();
    estimateExistingOrder.mockReset();
    estimateInsertSingle.mockReset();
    estimateInsert.mockReset();

    logEstimatePricingSourceAudit.mockResolvedValue(true);
    buildEstimateDbPayload.mockImplementation((params) => ({
      status: 'draft',
      inputs: params.inputs ?? {},
      outputs: params.outputs ?? {},
      pricing_source: params.pricingSourceContext?.pricingSource,
      pricing_source_metadata: params.pricingSourceContext?.pricingSourceMetadata,
      commercial_design_input: params.pricingSourceContext?.commercialDesignInput ?? null,
    }));
    buildVersionLabelMap.mockReturnValue(new Map());
    extractVersionNumber.mockReturnValue(null);
    loadProjectEstimateFlowMaps.mockResolvedValue({ editabilityByEstimateId: new Map(), flowByEstimateId: new Map() });
    mapEstimateDetail.mockReturnValue({ id: 'est_1', projectId: 'proj_1' });

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
              eq: () => ({
                order: estimateExistingOrder,
              }),
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

  it('writes calculator_live source fields for default estimate creates', async () => {
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: {
        calculator_snapshot: {
          inputs: { schemaVersion: 'v2' },
          outputs: { totals: { cost_ex_gst: 0, cost_inc_gst: 0 } },
        },
      },
    });
    estimateExistingOrder.mockResolvedValue({ data: [], error: null });
    estimateInsertSingle.mockResolvedValue({
      data: { id: 'estimate-uuid', project_id: 'project-uuid', outputs: {} },
      error: null,
    });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/projects/proj_1/estimates', { method: 'POST' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(201);
    expect(buildEstimateDbPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        createdBy: 'ops@example.com',
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
    expect(estimateInsert).toHaveBeenCalledWith(
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
    await expect(res.json()).resolves.toEqual({ estimate: { id: 'est_1', projectId: 'proj_1' } });
  });

  it('falls back invalid pricing source config to calculator_live on create', async () => {
    process.env.PORTAL_ESTIMATE_PRICING_SOURCE = 'workbench';
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: {
        calculator_snapshot: {
          inputs: { schemaVersion: 'v2' },
          outputs: { totals: { cost_ex_gst: 0, cost_inc_gst: 0 } },
        },
      },
    });
    estimateExistingOrder.mockResolvedValue({ data: [], error: null });
    estimateInsertSingle.mockResolvedValue({
      data: { id: 'estimate-uuid', project_id: 'project-uuid', outputs: {} },
      error: null,
    });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/projects/proj_1/estimates', { method: 'POST' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(201);
    expect(estimateInsert).toHaveBeenCalledWith(
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

  it('blocks workbench_solved creates before inserting an estimate row', async () => {
    process.env.PORTAL_ESTIMATE_PRICING_SOURCE = 'workbench_solved';
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: {
        calculator_snapshot: {
          inputs: { schemaVersion: 'v2' },
          outputs: { totals: { cost_ex_gst: 0, cost_inc_gst: 0 } },
        },
      },
    });
    estimateExistingOrder.mockResolvedValue({ data: [], error: null });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/projects/proj_1/estimates', { method: 'POST' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(409);
    expect(estimateInsert).not.toHaveBeenCalled();
    expect(buildEstimateDbPayload).not.toHaveBeenCalled();
    expect(logEstimatePricingSourceAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'estimate.pricing_source_blocked',
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
});
