import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const missingColumnFromError = vi.fn();
const buildEstimateDbPayload = vi.fn();
const buildEstimateWorkbenchSolvedReadinessFromSnapshot = vi.fn();
const resolveEstimatePricingSourceForSave = vi.fn();
const logEstimatePricingSourceAudit = vi.fn();
const buildVersionLabelMap = vi.fn();
const loadEstimateEditability = vi.fn();
const mapEstimateDetail = vi.fn();

const estimateByIdMaybeSingle = vi.fn();
const existingOrder = vi.fn();
const estimateInsert = vi.fn();
const estimateInsertSingle = vi.fn();

const ORIGINAL_PRICING_SOURCE_ENV = process.env.PORTAL_ESTIMATE_PRICING_SOURCE;

vi.mock('@/lib/api/staffApi', () => ({
  jsonError: (error: string, status: number, _diagnostics?: unknown, extra?: Record<string, unknown>) =>
    new Response(JSON.stringify({ error, ...(extra ?? {}) }), { status, headers: { 'content-type': 'application/json' } }),
  jsonOk: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  requireStaffContext,
}));

vi.mock('@/lib/api/siteVisitsServer', () => ({
  missingColumnFromError,
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
  calculatorSnapshotFromRow: (row: any) => ({
    inputs: row.inputs ?? {},
    outputs: row.outputs ?? {},
    warnings: row.warnings ?? [],
  }),
  loadEstimateEditability,
  mapEstimateDetail,
}));

vi.mock('@/lib/supabase/mappers', () => ({
  isRecord: (value: unknown) => Boolean(value && typeof value === 'object' && !Array.isArray(value)),
  uuidFromAppId: (_id: string, prefix: string) => (prefix === 'proj' ? 'project-uuid' : 'estimate-uuid'),
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

describe('POST /api/estimates/[estimateId]/duplicate', () => {
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
    missingColumnFromError.mockReset();
    buildEstimateDbPayload.mockReset();
    buildEstimateWorkbenchSolvedReadinessFromSnapshot.mockReset();
    resolveEstimatePricingSourceForSave.mockClear();
    logEstimatePricingSourceAudit.mockReset();
    buildVersionLabelMap.mockReset();
    loadEstimateEditability.mockReset();
    mapEstimateDetail.mockReset();
    estimateByIdMaybeSingle.mockReset();
    existingOrder.mockReset();
    estimateInsert.mockReset();
    estimateInsertSingle.mockReset();

    missingColumnFromError.mockReturnValue(null);
    buildEstimateWorkbenchSolvedReadinessFromSnapshot.mockImplementation(() => blockedWorkbenchReadiness());
    logEstimatePricingSourceAudit.mockResolvedValue(true);
    loadEstimateEditability.mockResolvedValue({ isLocked: false });
    estimateInsert.mockImplementation(() => ({
      select: () => ({
        single: estimateInsertSingle,
      }),
    }));
    buildEstimateDbPayload.mockImplementation((params) => ({
      status: 'draft',
      inputs: params.inputs ?? {},
      outputs: params.outputs ?? {},
      pricing_source: params.pricingSourceContext?.pricingSource,
      pricing_source_metadata: params.pricingSourceContext?.pricingSourceMetadata,
      commercial_design_input: params.pricingSourceContext?.commercialDesignInput ?? null,
    }));
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
            insert: estimateInsert,
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
    expect(logEstimatePricingSourceAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'estimate.pricing_source_saved',
        estimateUuid: 'new-estimate-uuid',
        payload: expect.objectContaining({
          source: 'calculator_live',
          requestedSource: 'calculator_live',
          requestedSourceRaw: null,
          gateVersion: 'estimate_pricing_rollout_prep_v1',
          duplicatedFromEstimateId: 'estimate-uuid',
        }),
      }),
    );
    await expect(res.json()).resolves.toEqual({ estimate: { id: 'est_2', projectId: 'proj_1' } });
  });

  it('falls back invalid pricing source config to calculator_live on duplicate', async () => {
    process.env.PORTAL_ESTIMATE_PRICING_SOURCE = 'workbench';
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
    expect(logEstimatePricingSourceAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'estimate.pricing_source_saved',
        estimateUuid: 'new-estimate-uuid',
        payload: expect.objectContaining({
          source: 'calculator_live',
          requestedSource: 'calculator_live',
          requestedSourceRaw: 'workbench',
          gateVersion: 'estimate_pricing_rollout_prep_v1',
          duplicatedFromEstimateId: 'estimate-uuid',
        }),
      }),
    );
  });

  it('persists server-derived workbench_solved source fields for ready duplicates', async () => {
    process.env.PORTAL_ESTIMATE_PRICING_SOURCE = 'workbench_solved';
    buildEstimateWorkbenchSolvedReadinessFromSnapshot.mockReturnValueOnce(readyWorkbenchReadiness());
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
    expect(buildEstimateWorkbenchSolvedReadinessFromSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-uuid',
        estimateId: 'estimate-uuid',
        snapshot: expect.objectContaining({
          inputs: { schemaVersion: 'v2' },
          outputs: expect.objectContaining({
            version: 2,
            totals: { cost_ex_gst: 0, cost_inc_gst: 0 },
          }),
        }),
      }),
    );
    const payload = estimateInsert.mock.calls[0]?.[0];
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
        estimateUuid: 'new-estimate-uuid',
        payload: expect.objectContaining({
          source: 'workbench_solved',
          requestedSource: 'workbench_solved',
          requestedSourceRaw: 'workbench_solved',
          gateVersion: 'estimate_pricing_rollout_prep_v1',
          duplicatedFromEstimateId: 'estimate-uuid',
        }),
      }),
    );
  });

  it('allows calculator_live duplicate retry to drop missing pricing source columns without reporting workbench_solved', async () => {
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
    const insertPayloads: Record<string, unknown>[] = [];
    estimateInsert.mockImplementation((payload) => {
      insertPayloads.push({ ...payload });
      return {
        select: () => ({
          single: estimateInsertSingle,
        }),
      };
    });
    missingColumnFromError.mockReturnValueOnce('pricing_source_metadata');
    estimateInsertSingle
      .mockResolvedValueOnce({ data: null, error: { message: 'column pricing_source_metadata does not exist' } })
      .mockResolvedValueOnce({ data: { id: 'new-estimate-uuid', project_id: 'project-uuid' }, error: null });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/estimates/est_1/duplicate', { method: 'POST' }), {
      params: Promise.resolve({ estimateId: 'est_1' }),
    });

    expect(res.status).toBe(201);
    expect(insertPayloads[0]).toMatchObject({
      pricing_source: 'calculator_live',
      pricing_source_metadata: expect.objectContaining({ selectedSource: 'calculator_live' }),
      commercial_design_input: null,
    });
    expect(insertPayloads[1]).not.toHaveProperty('pricing_source_metadata');
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

  it('does not drop missing pricing source columns for an eligible workbench_solved duplicate', async () => {
    process.env.PORTAL_ESTIMATE_PRICING_SOURCE = 'workbench_solved';
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
    missingColumnFromError.mockReturnValueOnce('pricing_source_metadata');
    estimateInsertSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'column pricing_source_metadata does not exist' },
    });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/estimates/est_1/duplicate', { method: 'POST' }), {
      params: Promise.resolve({ estimateId: 'est_1' }),
    });

    expect(res.status).toBe(500);
    expect(estimateInsert).toHaveBeenCalledTimes(1);
    expect(estimateInsert).toHaveBeenCalledWith(
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

  it('blocks workbench_solved duplicate attempts before inserting', async () => {
    process.env.PORTAL_ESTIMATE_PRICING_SOURCE = 'workbench_solved';
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

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/estimates/est_1/duplicate', { method: 'POST' }), {
      params: Promise.resolve({ estimateId: 'est_1' }),
    });

    expect(res.status).toBe(409);
    expect(estimateInsert).not.toHaveBeenCalled();
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

  it('keeps locked duplicate attempts ahead of pricing source evaluation', async () => {
    process.env.PORTAL_ESTIMATE_PRICING_SOURCE = 'workbench_solved';
    const editability = { isLocked: true, lockReason: 'quote_sent' };
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
    loadEstimateEditability.mockResolvedValue(editability);

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/estimates/est_1/duplicate', { method: 'POST' }), {
      params: Promise.resolve({ estimateId: 'est_1' }),
    });

    expect(res.status).toBe(409);
    expect(existingOrder).not.toHaveBeenCalled();
    expect(logEstimatePricingSourceAudit).not.toHaveBeenCalled();
    expect(estimateInsert).not.toHaveBeenCalled();
    expect(buildEstimateDbPayload).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({
      code: 'ESTIMATE_LOCKED',
      editability,
    });
  });
});
