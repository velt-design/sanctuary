import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const parseJsonBody = vi.fn();
const missingColumnFromError = vi.fn();
const buildEstimateDbPayload = vi.fn();
const buildEstimateWorkbenchSolvedReadinessFromSnapshot = vi.fn();
const resolveEstimatePricingSourceForSave = vi.fn();
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
  calculatorSnapshotFromRow: () => ({ inputs: {}, outputs: {}, warnings: [] }),
  extractVersionNumber,
  mapEstimateDetail,
  mapEstimateMeta,
}));

vi.mock('@/lib/supabase/mappers', () => ({
  isRecord: (value: unknown) => Boolean(value && typeof value === 'object' && !Array.isArray(value)),
  uuidFromAppId: (_id: string) => 'project-uuid',
}));

function readyWorkbenchReadiness() {
  return {
    workbenchCommercialInput: {
      schemaVersion: 'commercial_design_v1',
      source: 'workbench_solved',
      trustStatus: 'ready',
      identity: { projectId: 'project-uuid', estimateId: null },
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

describe('GET /api/projects/[projectId]/estimates', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffContext.mockReset();
    buildVersionLabelMap.mockReset();
    loadProjectEstimateFlowMaps.mockReset();
    mapEstimateDetail.mockReset();
    mapEstimateMeta.mockReset();
  });

  it('returns estimate metadata and the active draft detail from one auth-bound read', async () => {
    const rows = [
      { id: 'estimate-active', project_id: 'project-uuid', created_at: '2026-08-08T00:00:00.000Z' },
      { id: 'estimate-history', project_id: 'project-uuid', created_at: '2026-08-01T00:00:00.000Z' },
    ];
    const order = vi.fn().mockResolvedValue({ data: rows, error: null });
    const select = vi.fn(() => ({
      eq: () => ({ order }),
    }));
    const supabase = { from: vi.fn(() => ({ select })) };
    const activeDetail = { id: 'est_active', projectId: 'proj_project-uuid', calculatorSnapshot: {} };
    requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: 'user-1' }, role: 'staff' },
      supabase,
    });
    buildVersionLabelMap.mockReturnValue(new Map([
      ['estimate-active', 'V2'],
      ['estimate-history', 'V1'],
    ]));
    loadProjectEstimateFlowMaps.mockResolvedValue({
      activeDraftEstimateId: 'estimate-active',
      editabilityByEstimateId: new Map([['estimate-active', { isLocked: false }]]),
      flowByEstimateId: new Map(),
    });
    mapEstimateMeta
      .mockReturnValueOnce({ id: 'est_active', projectId: 'proj_project-uuid', isActiveDraft: true })
      .mockReturnValueOnce({ id: 'est_history', projectId: 'proj_project-uuid', isActiveDraft: false });
    mapEstimateDetail.mockReturnValue(activeDetail);

    const mod = await import('./route');
    const response = await mod.GET(
      new Request('http://localhost/api/projects/proj_1/estimates'),
      { params: Promise.resolve({ projectId: 'proj_1' }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(select).toHaveBeenCalledWith(expect.stringContaining('inputs'));
    expect(loadProjectEstimateFlowMaps).toHaveBeenCalledWith('project-uuid', rows, supabase);
    expect(mapEstimateDetail).toHaveBeenCalledWith(
      rows[0],
      'V2',
      { isLocked: false },
      null,
    );
    await expect(response.json()).resolves.toEqual({
      estimates: [
        { id: 'est_active', projectId: 'proj_project-uuid', isActiveDraft: true },
        { id: 'est_history', projectId: 'proj_project-uuid', isActiveDraft: false },
      ],
      activeDraftEstimate: activeDetail,
    });
  });
});

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
    missingColumnFromError.mockReset();
    buildEstimateDbPayload.mockReset();
    buildEstimateWorkbenchSolvedReadinessFromSnapshot.mockReset();
    resolveEstimatePricingSourceForSave.mockClear();
    logEstimatePricingSourceAudit.mockReset();
    buildVersionLabelMap.mockReset();
    extractVersionNumber.mockReset();
    loadProjectEstimateFlowMaps.mockReset();
    mapEstimateDetail.mockReset();
    mapEstimateMeta.mockReset();
    estimateExistingOrder.mockReset();
    estimateInsertSingle.mockReset();
    estimateInsert.mockReset();

    missingColumnFromError.mockReturnValue(null);
    buildEstimateWorkbenchSolvedReadinessFromSnapshot.mockImplementation(() => blockedWorkbenchReadiness());
    logEstimatePricingSourceAudit.mockResolvedValue(true);
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
            insert: estimateInsert,
          };
        },
      },
    });
  });

  it('writes calculator_live source fields for default estimate creates', async () => {
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: {
        clientIntentId: 'estimate-create:test-1',
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
    await expect(res.json()).resolves.toEqual({ estimate: { id: 'est_1', projectId: 'proj_1' } });
  });

  it('returns the original estimate when a create intent is replayed', async () => {
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: {
        clientIntentId: 'estimate-create:replay',
      },
    });
    const existing = {
      id: 'estimate-existing',
      project_id: 'project-uuid',
      client_intent_id: 'estimate-create:replay',
    };
    estimateExistingOrder.mockResolvedValue({
      data: [existing],
      error: null,
    });
    buildVersionLabelMap.mockReturnValue(
      new Map([['estimate-existing', 'V3']]),
    );
    mapEstimateDetail.mockReturnValue({
      id: 'est_existing',
      projectId: 'proj_1',
    });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/projects/proj_1/estimates', {
        method: 'POST',
      }),
      { params: Promise.resolve({ projectId: 'proj_1' }) },
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      estimate: { id: 'est_existing', projectId: 'proj_1' },
      idempotentReplay: true,
    });
    expect(estimateInsert).not.toHaveBeenCalled();
  });

  it('never substitutes the latest saved estimate when the exact calculator snapshot is missing', async () => {
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: { clientIntentId: 'estimate-create:missing-snapshot' },
    });
    estimateExistingOrder.mockResolvedValue({ data: [], error: null });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/projects/proj_1/estimates', {
        method: 'POST',
      }),
      { params: Promise.resolve({ projectId: 'proj_1' }) },
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error:
        'This save has no calculator result attached. Recalculate before saving.',
    });
    expect(estimateInsert).not.toHaveBeenCalled();
  });

  it('falls back invalid pricing source config to calculator_live on create', async () => {
    process.env.PORTAL_ESTIMATE_PRICING_SOURCE = 'workbench';
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: {
        clientIntentId: 'estimate-create:test-2',
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

  it('persists server-derived workbench_solved source fields for ready creates', async () => {
    process.env.PORTAL_ESTIMATE_PRICING_SOURCE = 'workbench_solved';
    const snapshot = {
      inputs: { schemaVersion: 'v2' },
      outputs: { totals: { cost_ex_gst: 0, cost_inc_gst: 0 } },
    };
    buildEstimateWorkbenchSolvedReadinessFromSnapshot.mockReturnValueOnce(readyWorkbenchReadiness());
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: {
        clientIntentId: 'estimate-create:test-3',
        calculator_snapshot: snapshot,
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
    expect(buildEstimateWorkbenchSolvedReadinessFromSnapshot).toHaveBeenCalledWith({
      snapshot,
      projectId: 'project-uuid',
      estimateId: null,
    });
    expect(buildEstimateDbPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        pricingSourceContext: expect.objectContaining({
          pricingSource: 'workbench_solved',
          commercialDesignInput: expect.objectContaining({ source: 'workbench_solved' }),
          pricingSourceMetadata: expect.objectContaining({
            requestedSource: 'workbench_solved',
            requestedSourceRaw: 'workbench_solved',
            selectedSource: 'workbench_solved',
            commercialInputSchemaVersion: 'commercial_design_v1',
            quantityTakeoffSource: 'solved_geometry_spine',
            parityReportVersion: 'commercial_parity_v1',
            blockingGateCodes: [],
          }),
        }),
      }),
    );
    const payload = estimateInsert.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      pricing_source: 'workbench_solved',
      pricing_source_metadata: expect.objectContaining({
        selectedSource: 'workbench_solved',
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

  it('allows calculator_live create retry to drop missing pricing source columns without reporting workbench_solved', async () => {
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: {
        clientIntentId: 'estimate-create:test-4',
        calculator_snapshot: {
          inputs: { schemaVersion: 'v2' },
          outputs: { totals: { cost_ex_gst: 0, cost_inc_gst: 0 } },
        },
      },
    });
    estimateExistingOrder.mockResolvedValue({ data: [], error: null });
    const insertPayloads: Record<string, unknown>[] = [];
    estimateInsert.mockImplementation((payload) => {
      insertPayloads.push({ ...payload });
      return {
        select: () => ({
          single: estimateInsertSingle,
        }),
      };
    });
    missingColumnFromError.mockReturnValueOnce('pricing_source');
    estimateInsertSingle
      .mockResolvedValueOnce({ data: null, error: { message: 'column pricing_source does not exist' } })
      .mockResolvedValueOnce({
        data: { id: 'estimate-uuid', project_id: 'project-uuid', outputs: {} },
        error: null,
      });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/projects/proj_1/estimates', { method: 'POST' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(201);
    expect(insertPayloads[0]).toMatchObject({
      pricing_source: 'calculator_live',
      pricing_source_metadata: expect.objectContaining({ selectedSource: 'calculator_live' }),
      commercial_design_input: null,
    });
    expect(insertPayloads[1]).not.toHaveProperty('pricing_source');
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

  it('does not drop missing pricing source columns for an eligible workbench_solved create', async () => {
    process.env.PORTAL_ESTIMATE_PRICING_SOURCE = 'workbench_solved';
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: {
        clientIntentId: 'estimate-create:test-5',
        calculator_snapshot: {
          inputs: { schemaVersion: 'v2' },
          outputs: { totals: { cost_ex_gst: 0, cost_inc_gst: 0 } },
        },
      },
    });
    estimateExistingOrder.mockResolvedValue({ data: [], error: null });
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
    missingColumnFromError.mockReturnValueOnce('pricing_source');
    estimateInsertSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'column pricing_source does not exist' },
    });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/projects/proj_1/estimates', { method: 'POST' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
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

  it('blocks workbench_solved creates before inserting an estimate row', async () => {
    process.env.PORTAL_ESTIMATE_PRICING_SOURCE = 'workbench_solved';
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: {
        clientIntentId: 'estimate-create:test-6',
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
});
