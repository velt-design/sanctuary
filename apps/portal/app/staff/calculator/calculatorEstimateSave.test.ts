import { describe, expect, it, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import { ESTIMATE_PRICING_SYNC_STATE_OUTPUT_KEY } from '@/lib/estimates/costingPayload';
import type { EstimateDetail, EstimateMeta } from '@/lib/estimates/types';
import { PORTAL_LOCAL_FIRST_MUTATIONS } from '@/lib/localFirst/portalEntities';
import type { CalculatorInputs } from '@/lib/types/calculator';
import type { Project } from '@/lib/types/project';
import { saveCalculatorEstimate } from './calculatorEstimateSave';

type SaveCalculatorEstimateInput = Parameters<typeof saveCalculatorEstimate>[0];
type SaveCalculatorEstimateCallbacks = SaveCalculatorEstimateInput['callbacks'];
type SaveCalculatorEstimateServices = NonNullable<SaveCalculatorEstimateInput['services']>;

function makeInputs(): CalculatorInputs {
  return {
    schemaVersion: 'v2',
    projectName: 'Millwater',
    quoteRef: 'Q-1000',
    access: 'normal',
    height: 'single_storey',
    jobType: 'residential',
    travelExGst: '12',
    extrasAllowanceExGst: '45',
    quoteDiscountPct: '5',
    pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
    modules: [
      {
        pergolaId: 'pergola-1',
        pergolaStyle: 'gable',
        roofMaterial: 'acrylic',
        extrusionColour: 'White',
        boxPerimeterEnabled: false,
        internalRoofType: 'pitched',
        fallDistanceMm: '0',
        roofPitchDeg: '25',
        gableEndFramesMode: 'outer_end_only',
        gableHouseEdgeGutter: 'house',
        gableOuterEdgeGutter: 'our',
        boxGutterHouseEdge: 'house',
        boxGutterFarEdge: 'our',
        downpipeCount: '0',
        downpipeJoinCount: '0',
        downpipeElbowCount: '0',
        separateGutterEnabled: false,
        overhangEnabled: false,
        overhangAmountM: '0',
        overhangSupportBeamProfile: '150x50',
        invertedEnabled: false,
        invertedHouseGutter: false,
        mixedSkylightStripCount: '0',
        mixedSkylightStripWidthM: '0',
        mixedAcrylicBaysMain: '0',
        mixedAcrylicBaysA: '0',
        mixedAcrylicBaysB: '0',
        timberRoofAboveType: 'insulated_panels',
        timberInsulatedPanelThicknessMm: '50',
        timberTrayWidthMm: '500',
        postCount: '2',
        houseConnectionType: 'fascia',
        postConnectionType: 'slab_anchors',
        ground: 'easy',
        lengthM: '7',
        projectionM: '7',
        hipCornerLengthBM: '0',
        hipCornerProjectionBM: '0',
        postCutHeightM: '2.7',
        timberRoofAllowanceExGst: '0',
        flashings: { rows: [] },
        overrides: {},
        infills: { items: [] },
      },
    ],
    blinds: { items: [] },
  };
}

function makeProject(): Project {
  return {
    id: 'project-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-02T00:00:00.000Z',
    contactId: 'contact-1',
    projectName: 'Millwater',
    region: 'Auckland',
    siteAddress: '1 Test Street',
    quoteRef: 'Q-1000',
  };
}

function makeMeta(id: string, versionLabel: string): EstimateMeta {
  return {
    id,
    projectId: 'project-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    status: 'draft',
    summary: {},
    createdBy: 'ops@example.com',
    versionLabel,
    isActiveDraft: false,
    hasSentQuote: false,
    jobPackEligible: false,
    jobPackGeneratedAt: null,
    jobPackQuoteVersionId: null,
  };
}

function makeEstimateDetail(input?: {
  id?: string;
  inputs?: CalculatorInputs;
  isLocked?: boolean;
  outputs?: Record<string, unknown>;
  versionLabel?: string;
}): EstimateDetail {
  return {
    ...makeMeta(input?.id ?? 'estimate-1', input?.versionLabel ?? 'V2'),
    calculatorSnapshot: {
      inputs: input?.inputs ?? makeInputs(),
      outputs: {
        totals: { cost_ex_gst: 175, cost_inc_gst: 201.25 },
        materials: { totals: { materials_ex_gst: 100 } },
        derived: { length_m: 7, projection_m: 7 },
        projectSnapshot: { id: 'project-1' },
        snapshot: { project: { projectName: 'Millwater' } },
        configVersions: { manifest: 'm1', rules: 'r1' },
        ...(input?.outputs ?? {}),
      },
    },
    internalNotes: 'Keep this note',
    editability: {
      isLocked: input?.isLocked ?? false,
      lockReason: input?.isLocked ? 'quote_sent' : null,
      lockedAt: input?.isLocked ? '2026-04-03T00:00:00.000Z' : null,
      lockedByQuoteVersionId: input?.isLocked ? 'qv-1' : null,
      lockedByQuoteRef: input?.isLocked ? 'Q-1000' : null,
      lockedByQuoteVersionNumber: input?.isLocked ? 1 : null,
      hasDraftQuotes: false,
      draftQuoteCount: 0,
    },
  };
}

function makeSiteResult() {
  return {
    pergolas: [{ id: 'pergola-1', modules: [{ derived: { length_m: 7, projection_m: 7 } }] }],
    materials: { totals: { materials_ex_gst: 100 } },
    install: { totals: { install_ex_gst: 50 } },
    overhead: { total_ex_gst: 25 },
    totals: { cost_ex_gst: 175, cost_inc_gst: 201.25, warnings: [{ level: 'review', message: 'Check span' }] },
    shared: { crew: 1 },
  } as any;
}

function makeQueryClient(estimateMetas: EstimateMeta[] = []): QueryClient {
  return {
    getQueryData: vi.fn(() => undefined),
    fetchQuery: vi.fn(async () => estimateMetas),
  } as unknown as QueryClient;
}

function makeHarness(overrides?: {
  estimateMetas?: EstimateMeta[];
  services?: SaveCalculatorEstimateServices;
}) {
  const callbacks = {
    fail: vi.fn(),
    setGenerating: vi.fn(),
    setLoadedEstimateDetail: vi.fn(),
  } satisfies SaveCalculatorEstimateCallbacks;
  const services = {
    clearWorkingCopy: vi.fn(async () => undefined),
    createLocalEstimateId: vi.fn(() => 'local-estimate:test'),
    enqueueMutation: vi.fn(async ({ id, entityKey, mutationKey, payload }) => ({
      id: id ?? 'queue-item:test',
      entityKey,
      mutationKey,
      payload,
      status: 'queued' as const,
      enqueuedAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
      attempts: 0,
    })),
    fetchEstimateDetail: vi.fn(async () => null),
    getContact: vi.fn(async () => ({
      id: 'contact-1',
      displayName: 'Jordan Test',
      email: 'jordan@example.com',
      phone: '0400 000 000',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    })),
    getCostingMeta: vi.fn(async () => ({
      manifestPath: 'manifest.json',
      manifestVersion: 'm1',
      files: {},
      configVersions: {
        pricebook: 'p1',
        installActions: 'i1',
        overheads: 'o1',
        rules: 'r1',
        manifest: 'm1',
      },
    })),
    resolveEstimateId: vi.fn((estimateId: string) => estimateId),
    upsertEstimateDetailCache: vi.fn(),
    writeWorkingCopy: vi.fn(async ({ entityKey, data, updatedAt }) => ({
      entityKey,
      data,
      updatedAt: updatedAt ?? '2026-04-01T00:00:00.000Z',
    })),
    ...overrides?.services,
  } satisfies SaveCalculatorEstimateServices;

  return {
    callbacks,
    queryClient: makeQueryClient(overrides?.estimateMetas ?? []),
    services,
  };
}

async function saveWithDefaults(
  overrides: Partial<SaveCalculatorEstimateInput> = {},
  harness = makeHarness(),
) {
  const outcome = await saveCalculatorEstimate({
    activeDraftEstimateMetaId: null,
    activeEditEstimateId: '',
    activeModuleIndex: 0,
    callbacks: harness.callbacks,
    criticalWarningCount: 0,
    draftEntityKey: 'calculator:draft:test',
    draftSessionKey: 'draft:test',
    email: 'ops@example.com',
    engineWarningsRaw: [],
    hasStatusBlockers: false,
    hostKey: 'test-host',
    isEditingDesign: false,
    loadedEstimateDetail: null,
    project: makeProject(),
    projectId: 'project-1',
    queryClient: harness.queryClient,
    request: undefined,
    result: makeSiteResult(),
    resultModules: makeSiteResult().pergolas[0].modules,
    services: harness.services,
    values: makeInputs(),
    ...overrides,
  });

  return { ...harness, outcome };
}

describe('saveCalculatorEstimate', () => {
  it('keeps initial save readiness failures in priority order', async () => {
    let harness = await saveWithDefaults({ projectId: '', project: null, result: null });
    expect(harness.callbacks.fail).toHaveBeenLastCalledWith('Select a project first.');
    expect(harness.callbacks.setGenerating).not.toHaveBeenCalled();

    harness = await saveWithDefaults({ project: null, result: null });
    expect(harness.callbacks.fail).toHaveBeenLastCalledWith('Project not found.');
    expect(harness.callbacks.setGenerating).not.toHaveBeenCalled();

    harness = await saveWithDefaults({ result: null, resultModules: [] });
    expect(harness.callbacks.fail).toHaveBeenLastCalledWith('No calculated result yet.');
    expect(harness.callbacks.setGenerating).not.toHaveBeenCalled();
  });

  it('blocks locked estimate updates before enqueueing a local-first mutation', async () => {
    const harness = makeHarness({ estimateMetas: [makeMeta('estimate-1', 'V2')] });

    const saved = await saveWithDefaults(
      {
        activeEditEstimateId: 'estimate-1',
        isEditingDesign: true,
        loadedEstimateDetail: makeEstimateDetail({ isLocked: true }),
        request: { saveMode: 'preserve_current' },
        result: null,
        resultModules: [],
      },
      harness,
    );

    expect(harness.callbacks.fail).toHaveBeenCalledWith(
      'This design is locked because it has been sent with a quote and can no longer be edited.',
    );
    expect(saved.outcome).toBeNull();
    expect(harness.services.enqueueMutation).not.toHaveBeenCalled();
  });

  it('preserves current pricing for unlocked edit saves and enqueues estimate updates', async () => {
    const previousInputs = makeInputs();
    const nextInputs = {
      ...previousInputs,
      modules: [{ ...previousInputs.modules[0]!, projectionM: '8' }],
    };
    const harness = makeHarness({ estimateMetas: [makeMeta('estimate-1', 'V2')] });

    const saved = await saveWithDefaults(
      {
        activeEditEstimateId: 'estimate-1',
        isEditingDesign: true,
        loadedEstimateDetail: makeEstimateDetail({ inputs: previousInputs }),
        request: { saveMode: 'preserve_current' },
        result: null,
        resultModules: [],
        values: nextInputs,
      },
      harness,
    );

    expect(harness.services.writeWorkingCopy).toHaveBeenCalledWith(
      expect.objectContaining({
        entityKey: 'estimate:detail:estimate-1',
        data: expect.objectContaining({
          id: 'estimate-1',
          versionLabel: 'V2',
          internalNotes: 'Keep this note',
        }),
      }),
    );
    expect(harness.services.enqueueMutation).toHaveBeenCalledWith({
      entityKey: 'estimate:detail:estimate-1',
      mutationKey: PORTAL_LOCAL_FIRST_MUTATIONS.estimateUpdate,
      payload: expect.objectContaining({
        estimateId: 'estimate-1',
        estimatePayload: expect.objectContaining({
          outputs: expect.objectContaining({
            totals: { cost_ex_gst: 175, cost_inc_gst: 201.25 },
            [ESTIMATE_PRICING_SYNC_STATE_OUTPUT_KEY]: 'stale',
          }),
        }),
      }),
    });
    expect(harness.services.clearWorkingCopy).toHaveBeenCalledWith('calculator:draft:test');
    expect(saved.outcome).toEqual({
      estimateId: 'estimate-1',
      projectId: 'project-1',
      versionLabel: 'V2',
      operation: 'updated',
      saveMode: 'preserve_current',
      pricingChanged: true,
    });
  });

  it('rebuilds site-costing payloads for reprice edit saves', async () => {
    const harness = makeHarness({ estimateMetas: [makeMeta('estimate-1', 'V2')] });

    const saved = await saveWithDefaults(
      {
        activeEditEstimateId: 'estimate-1',
        isEditingDesign: true,
        loadedEstimateDetail: makeEstimateDetail(),
        request: { saveMode: 'reprice_latest' },
      },
      harness,
    );

    expect(harness.services.enqueueMutation).toHaveBeenCalledWith({
      entityKey: 'estimate:detail:estimate-1',
      mutationKey: PORTAL_LOCAL_FIRST_MUTATIONS.estimateUpdate,
      payload: expect.objectContaining({
        estimateId: 'estimate-1',
        estimatePayload: expect.objectContaining({
          outputs: expect.objectContaining({
            materials: { totals: { materials_ex_gst: 100 } },
            totals: expect.objectContaining({ cost_inc_gst: 201.25 }),
            [ESTIMATE_PRICING_SYNC_STATE_OUTPUT_KEY]: 'current',
          }),
          configVersions: expect.objectContaining({ manifest: 'm1' }),
        }),
      }),
    });
    expect(saved.outcome).toEqual({
      estimateId: 'estimate-1',
      projectId: 'project-1',
      versionLabel: 'V2',
      operation: 'updated',
      saveMode: 'reprice_latest',
      pricingChanged: false,
    });
  });

  it('creates a local estimate, prepends optimistic cache state, and preserves the next version label', async () => {
    const harness = makeHarness({
      estimateMetas: [makeMeta('estimate-1', 'V1'), makeMeta('estimate-3', 'V3')],
    });

    const saved = await saveWithDefaults({}, harness);

    expect(harness.services.upsertEstimateDetailCache).toHaveBeenCalledWith(
      harness.queryClient,
      'test-host',
      'project-1',
      expect.objectContaining({
        id: 'local-estimate:test',
        versionLabel: 'V4',
      }),
      { prepend: true },
    );
    expect(harness.services.enqueueMutation).toHaveBeenCalledWith({
      entityKey: 'estimate:detail:local-estimate:test',
      mutationKey: PORTAL_LOCAL_FIRST_MUTATIONS.estimateCreate,
      payload: expect.objectContaining({
        localEstimateId: 'local-estimate:test',
        projectId: 'project-1',
        createDesignRequest: null,
      }),
    });
    expect(saved.outcome).toEqual({
      estimateId: 'local-estimate:test',
      projectId: 'project-1',
      versionLabel: 'V4',
      operation: 'created',
      saveMode: 'reprice_latest',
      pricingChanged: false,
    });
  });

  it('passes calculator-generated design request payloads through estimate create mutations', async () => {
    const harness = makeHarness();

    const saved = await saveWithDefaults(
      {
        request: {
          createDesignRequest: { priorityTier: 'TIER_2' },
        },
      },
      harness,
    );

    expect(harness.services.enqueueMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationKey: PORTAL_LOCAL_FIRST_MUTATIONS.estimateCreate,
        payload: expect.objectContaining({
          createDesignRequest: {
            requestSource: 'calculator_generate',
            priorityTier: 'TIER_2',
          },
        }),
      }),
    );
    expect(saved.outcome).toEqual(expect.objectContaining({
      estimateId: 'local-estimate:test',
      operation: 'created',
    }));
  });
});
