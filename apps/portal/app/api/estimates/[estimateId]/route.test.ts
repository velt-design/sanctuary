import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const parseJsonBody = vi.fn();
const missingColumnFromError = vi.fn();
const loadProjectEstimateFlowMaps = vi.fn();
const loadEstimateEditability = vi.fn();
const buildEstimateDbPayload = vi.fn();
const buildEstimateWorkbenchSolvedReadinessFromSnapshot = vi.fn();
const resolveEstimatePricingSourceForSave = vi.fn();
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
  missingColumnFromError,
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
  buildEstimateWorkbenchSolvedReadinessFromSnapshot.mockImplementation((input) =>
    actual.buildEstimateWorkbenchSolvedReadinessFromSnapshot(input),
  );
  resolveEstimatePricingSourceForSave.mockImplementation((input) => actual.resolveEstimatePricingSourceForSave(input));
  return {
    ...actual,
    buildEstimateWorkbenchSolvedReadinessFromSnapshot,
    logEstimatePricingSourceAudit,
    resolveEstimatePricingSourceForSave,
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

function readyWorkbenchReadiness() {
  return {
    workbenchCommercialInput: {
      schemaVersion: 'commercial_design_v1',
      source: 'workbench_solved',
      trustStatus: 'ready',
      identity: { projectId: 'project-uuid', estimateId: 'estimate-uuid' },
      pergolas: [
        {
          id: 'pergola-1',
          label: 'Pergola 1',
          trustStatus: 'ready',
          diagnostics: [],
          modules: [
            {
              id: 'module-1',
              label: 'Module 1',
              sourceModuleIndex: 0,
              trustStatus: 'ready',
              designIntent: {
                pergolaStyle: 'pitched',
                roofMaterial: 'acrylic',
                extrusionColour: 'White',
                houseConnectionType: 'fascia',
                attachmentSide: 'rear',
                postConnectionType: 'slab_anchors',
              },
              solvedGeometry: {
                status: 'ready',
                geometrySource: 'workbench_solved',
                primaryDimensionsM: { length: 6, projection: 4 },
              },
              quantityTakeoff: {
                primaryDimensions: { lengthM: 6, projectionM: 4, roofAreaM2: 24 },
              },
              options: {},
              diagnostics: [],
            },
          ],
        },
      ],
      siteCommercial: {
        jobType: 'residential',
        access: 'normal',
        height: 'single_storey',
        travelExGst: 0,
        extrasAllowanceExGst: 0,
        quoteDiscountPct: 0,
      },
      diagnostics: [],
    },
    quantityTakeoffSource: 'solved_geometry_spine',
    parityReports: [
      {
        status: 'match',
        left: { label: 'calculator', source: 'calculator_compat', trustStatus: 'ready' },
        right: { label: 'workbench', source: 'workbench_solved', trustStatus: 'ready' },
        counts: {
          pergolasCompared: 1,
          modulesCompared: 1,
          differences: 0,
          blockingDifferences: 0,
          warningDifferences: 0,
        },
        differences: [],
        diagnostics: [],
      },
    ],
    estimatePersistenceSourceRecorded: true,
    estimateLockBoundaryPreserved: true,
    localFirstBoundaryPreserved: true,
    downstreamPricingBoundaryPreserved: true,
    rollbackToCalculatorLiveConfirmed: true,
  };
}

function blockedWorkbenchReadiness() {
  return {
    workbenchCommercialInput: null,
    quantityTakeoffSource: 'unknown',
    parityReports: [],
    estimatePersistenceSourceRecorded: true,
    estimateLockBoundaryPreserved: true,
    localFirstBoundaryPreserved: true,
    downstreamPricingBoundaryPreserved: true,
    rollbackToCalculatorLiveConfirmed: true,
  };
}

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
    missingColumnFromError.mockReset();
    loadProjectEstimateFlowMaps.mockReset();
    loadEstimateEditability.mockReset();
    buildEstimateDbPayload.mockReset();
    buildEstimateWorkbenchSolvedReadinessFromSnapshot.mockReset();
    resolveEstimatePricingSourceForSave.mockClear();
    logEstimatePricingSourceAudit.mockReset();
    buildVersionLabelMap.mockReset();
    extractVersionNumber.mockReset();
    mapEstimateDetail.mockReset();
    estimateMaybeSingle.mockReset();
    estimateUpdate.mockReset();
    estimateUpdateSingle.mockReset();
    estimateOrder.mockReset();
    missingColumnFromError.mockReturnValue(null);
    buildEstimateWorkbenchSolvedReadinessFromSnapshot.mockImplementation(() => blockedWorkbenchReadiness());
    logEstimatePricingSourceAudit.mockResolvedValue(true);
    estimateUpdate.mockImplementation(() => ({
      eq: () => ({
        select: () => ({
          single: estimateUpdateSingle,
        }),
      }),
    }));
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
            update: estimateUpdate,
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
        payload: expect.objectContaining({
          source: 'calculator_live',
          requestedSource: 'calculator_live',
          requestedSourceRaw: null,
          gateVersion: 'estimate_pricing_rollout_prep_v1',
        }),
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
    expect(logEstimatePricingSourceAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'estimate.pricing_source_saved',
        estimateUuid: 'estimate-uuid',
        payload: expect.objectContaining({
          source: 'calculator_live',
          requestedSource: 'calculator_live',
          requestedSourceRaw: 'workbench',
          gateVersion: 'estimate_pricing_rollout_prep_v1',
        }),
      }),
    );
  });

  it('persists server-derived workbench_solved source fields for ready updates', async () => {
    process.env.PORTAL_ESTIMATE_PRICING_SOURCE = 'workbench_solved';
    buildEstimateWorkbenchSolvedReadinessFromSnapshot.mockReturnValueOnce(readyWorkbenchReadiness());
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
    expect(buildEstimateWorkbenchSolvedReadinessFromSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-uuid',
        estimateId: 'estimate-uuid',
        snapshot: expect.objectContaining({
          inputs: { schemaVersion: 'v2' },
          outputs: expect.objectContaining({ totals: { cost_ex_gst: 0, cost_inc_gst: 0 } }),
        }),
      }),
    );
    const payload = estimateUpdate.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      pricing_source: 'workbench_solved',
      pricing_source_metadata: expect.objectContaining({
        selectedSource: 'workbench_solved',
        commercialInputSchemaVersion: 'commercial_design_v1',
        quantityTakeoffSource: 'solved_geometry_spine',
        commercialInputHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        parityReportHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
      commercial_design_input: expect.objectContaining({ source: 'workbench_solved' }),
    });
    expect(JSON.stringify(payload.pricing_source_metadata)).not.toContain('commercial_design_input');
    expect(JSON.stringify(payload.pricing_source_metadata)).not.toContain('"pergolas"');
    expect(logEstimatePricingSourceAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'estimate.pricing_source_saved',
        estimateUuid: 'estimate-uuid',
        payload: expect.objectContaining({
          source: 'workbench_solved',
          requestedSource: 'workbench_solved',
          requestedSourceRaw: 'workbench_solved',
          gateVersion: 'estimate_pricing_rollout_prep_v1',
        }),
      }),
    );
  });

  it('allows calculator_live update retry to drop missing pricing source columns without reporting workbench_solved', async () => {
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
    const updatePayloads: Record<string, unknown>[] = [];
    estimateUpdate.mockImplementation((payload) => {
      updatePayloads.push({ ...payload });
      return {
        eq: () => ({
          select: () => ({
            single: estimateUpdateSingle,
          }),
        }),
      };
    });
    missingColumnFromError.mockReturnValueOnce('pricing_source');
    estimateUpdateSingle
      .mockResolvedValueOnce({ data: null, error: { message: 'column pricing_source does not exist' } })
      .mockResolvedValueOnce({ data: updatedRow, error: null });
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
    expect(updatePayloads[0]).toMatchObject({
      pricing_source: 'calculator_live',
      pricing_source_metadata: expect.objectContaining({ selectedSource: 'calculator_live' }),
      commercial_design_input: null,
    });
    expect(updatePayloads[1]).not.toHaveProperty('pricing_source');
    expect(logEstimatePricingSourceAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        payload: expect.objectContaining({
          source: 'calculator_live',
          requestedSource: 'calculator_live',
        }),
      }),
    );
  });

  it('does not drop missing pricing source columns for an eligible workbench_solved update', async () => {
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

    const existingRow = {
      id: 'estimate-uuid',
      project_id: 'project-uuid',
      status: 'draft',
      outputs: {},
      internal_notes: null,
    };
    estimateMaybeSingle.mockResolvedValueOnce({ data: existingRow, error: null });
    loadEstimateEditability.mockResolvedValue({ isLocked: false });
    extractVersionNumber.mockReturnValue(1);
    const metadata = {
      gateVersion: 'estimate_pricing_rollout_prep_v1',
      requestedSource: 'workbench_solved',
      requestedSourceRaw: 'workbench_solved',
      selectedSource: 'workbench_solved',
      defaultedReason: null,
    };
    resolveEstimatePricingSourceForSave.mockReturnValueOnce({
      ok: true,
      context: {
        pricingSource: 'workbench_solved',
        pricingSourceMetadata: metadata,
        commercialDesignInput: { schemaVersion: 'commercial_design_v1', source: 'workbench_solved' },
      },
      normalizedRequest: { requestedPricingSource: 'workbench_solved', raw: 'workbench_solved' },
      readinessReport: { eligibleToEnable: true, blockingGateCodes: [], fallbackPricingSource: null },
    });
    missingColumnFromError.mockReturnValueOnce('commercial_design_input');
    estimateUpdateSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'column commercial_design_input does not exist' },
    });

    const mod = await import('./route');
    const res = await mod.PATCH(new Request('http://localhost/api/estimates/est_1', { method: 'PATCH' }), {
      params: Promise.resolve({ estimateId: 'est_1' }),
    });

    expect(res.status).toBe(500);
    expect(estimateUpdate).toHaveBeenCalledTimes(1);
    expect(estimateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        pricing_source: 'workbench_solved',
        pricing_source_metadata: expect.objectContaining({ selectedSource: 'workbench_solved' }),
        commercial_design_input: expect.objectContaining({ source: 'workbench_solved' }),
      }),
    );
    expect(logEstimatePricingSourceAudit).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'estimate.pricing_source_saved' }),
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
    const blockedAudit = logEstimatePricingSourceAudit.mock.calls.find(([, params]) => params.type === 'estimate.pricing_source_blocked');
    expect(blockedAudit?.[1].payload).not.toHaveProperty('commercialDesignInput');
    const body = await res.json();
    expect(body).not.toHaveProperty('estimate');
    expect(body).toMatchObject({
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
