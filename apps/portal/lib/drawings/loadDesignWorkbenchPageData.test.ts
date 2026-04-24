import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesignListRow } from '@/lib/designPackages/types';

const getProjectPageSnapshotMock = vi.fn();
const loadProjectDesignPackageRowsMock = vi.fn();
const getSupabaseServerAuthMock = vi.fn();
const loadProjectEstimateFlowMapsMock = vi.fn();

vi.mock('@/lib/projects/getProjectPageSnapshot', () => ({
  getProjectPageSnapshot: (...args: unknown[]) => getProjectPageSnapshotMock(...args),
}));

vi.mock('@/lib/designPackages/server', () => ({
  loadProjectDesignPackageRows: (...args: unknown[]) => loadProjectDesignPackageRowsMock(...args),
}));

vi.mock('@/lib/supabase/serverClient', () => ({
  getSupabaseServerAuth: (...args: unknown[]) => getSupabaseServerAuthMock(...args),
}));

vi.mock('@/lib/estimates/flow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/estimates/flow')>();
  return {
    ...actual,
    loadProjectEstimateFlowMaps: (...args: unknown[]) => loadProjectEstimateFlowMapsMock(...args),
  };
});

function createEstimateQuery(result: { data: any; error: any }) {
  const query: any = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => Promise.resolve(result)),
  };
  return query;
}

const PROJECT_UUID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = `proj_${PROJECT_UUID}`;
const ESTIMATE_ONE_UUID = '22222222-2222-4222-8222-222222222222';
const ESTIMATE_TWO_UUID = '33333333-3333-4333-8333-333333333333';
const ESTIMATE_ONE_ID = `est_${ESTIMATE_ONE_UUID}`;
const ESTIMATE_TWO_ID = `est_${ESTIMATE_TWO_UUID}`;

function buildEstimateRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: ESTIMATE_ONE_UUID,
    project_id: PROJECT_UUID,
    created_at: '2026-04-01T00:00:00.000Z',
    status: 'draft',
    created_by: null,
    summary_json: {},
    summary: {},
    outputs: { version: 1 },
    warnings: [],
    inputs: {},
    internal_notes: null,
    costing_manifest: null,
    costing_rules: null,
    total_true_cost_ex_gst: null,
    total_true_cost_inc_gst: null,
    ...overrides,
  };
}

function buildDesignRequestRow(overrides: Partial<DesignListRow> = {}): DesignListRow {
  return {
    requestId: 'dpr_11111111-1111-4111-8111-111111111111',
    projectId: PROJECT_ID,
    estimateId: ESTIMATE_ONE_ID,
    estimateVersionLabel: 'V1',
    requestVersion: 1,
    status: 'OPEN',
    priorityTier: 'TIER_3',
    priceTotalIncGstCents: 120000,
    requestSource: 'estimates_tab',
    requestedAt: '2026-04-02T00:00:00.000Z',
    dueAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    updatedAt: '2026-04-03T00:00:00.000Z',
    rowVersion: 'row-version',
    quoteName: 'Deck Build',
    projectName: 'Deck Build',
    clientName: 'Client',
    siteAddress: '1 Test Street',
    siteVisitRep: null,
    sentAt: null,
    sentQuoteRef: null,
    visitStatus: null,
    visitCompletedAt: null,
    notes: '',
    requestNote: null,
    designerNote: null,
    assignedDesignerId: null,
    ...overrides,
  };
}

describe('loadDesignWorkbenchPageData', () => {
  beforeEach(() => {
    vi.resetModules();
    getProjectPageSnapshotMock.mockReset();
    loadProjectDesignPackageRowsMock.mockReset();
    getSupabaseServerAuthMock.mockReset();
    loadProjectEstimateFlowMapsMock.mockReset();
    getProjectPageSnapshotMock.mockResolvedValue({
      project: { id: PROJECT_ID, name: 'Deck Build', stage: 'new', siteAddress: '1 Test Street' },
      pipeline: { stage: 'new' },
      tasks: { stage: 'new', items: [] },
      activity: [],
      emails: [],
    });
    loadProjectDesignPackageRowsMock.mockResolvedValue([]);
  });

  it('picks the active draft estimate by default and includes the active request when it matches', async () => {
    const fromMock = vi.fn((table: string) => {
      if (table !== 'estimates') throw new Error(`Unexpected table ${table}`);
      return createEstimateQuery({
        data: [
          buildEstimateRow({ id: ESTIMATE_TWO_UUID, created_at: '2026-04-02T00:00:00.000Z', outputs: { version: 2 } }),
          buildEstimateRow(),
        ],
        error: null,
      });
    });
    getSupabaseServerAuthMock.mockResolvedValue({ from: fromMock });
    loadProjectDesignPackageRowsMock.mockResolvedValue([
      buildDesignRequestRow({
        requestId: 'dpr_22222222-2222-4222-8222-222222222222',
        estimateId: ESTIMATE_TWO_ID,
        estimateVersionLabel: 'V2',
        requestVersion: 2,
      }),
    ]);
    loadProjectEstimateFlowMapsMock.mockResolvedValue({
      activeDraftEstimateId: ESTIMATE_TWO_UUID,
      editabilityByEstimateId: new Map([
        [ESTIMATE_ONE_UUID, { isLocked: false }],
        [ESTIMATE_TWO_UUID, { isLocked: false }],
      ]),
      flowByEstimateId: new Map([
        [ESTIMATE_ONE_UUID, { isActiveDraft: false, hasSentQuote: false, jobPackEligible: false, jobPackGeneratedAt: null, jobPackQuoteVersionId: null }],
        [ESTIMATE_TWO_UUID, { isActiveDraft: true, hasSentQuote: false, jobPackEligible: false, jobPackGeneratedAt: null, jobPackQuoteVersionId: null }],
      ]),
    });

    const { loadDesignWorkbenchPageData } = await import('./loadDesignWorkbenchPageData');
    const result = await loadDesignWorkbenchPageData({ projectId: PROJECT_ID });

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.estimate.id).toBe(ESTIMATE_TWO_ID);
    expect(result.estimate.selectionSource).toBe('active_draft');
    expect(result.request?.id).toBe('dpr_22222222-2222-4222-8222-222222222222');
    expect(result.detail.id).toBe(ESTIMATE_TWO_ID);
  });

  it('falls back to the most recent estimate when no active draft exists', async () => {
    const fromMock = vi.fn((table: string) => {
      if (table !== 'estimates') throw new Error(`Unexpected table ${table}`);
      return createEstimateQuery({
        data: [
          buildEstimateRow({ id: ESTIMATE_TWO_UUID, created_at: '2026-04-03T00:00:00.000Z', outputs: { version: 2 } }),
          buildEstimateRow(),
        ],
        error: null,
      });
    });
    getSupabaseServerAuthMock.mockResolvedValue({ from: fromMock });
    loadProjectEstimateFlowMapsMock.mockResolvedValue({
      activeDraftEstimateId: null,
      editabilityByEstimateId: new Map([
        [ESTIMATE_ONE_UUID, { isLocked: false }],
        [ESTIMATE_TWO_UUID, { isLocked: false }],
      ]),
      flowByEstimateId: new Map([
        [ESTIMATE_ONE_UUID, { isActiveDraft: false, hasSentQuote: false, jobPackEligible: false, jobPackGeneratedAt: null, jobPackQuoteVersionId: null }],
        [ESTIMATE_TWO_UUID, { isActiveDraft: false, hasSentQuote: false, jobPackEligible: false, jobPackGeneratedAt: null, jobPackQuoteVersionId: null }],
      ]),
    });

    const { loadDesignWorkbenchPageData } = await import('./loadDesignWorkbenchPageData');
    const result = await loadDesignWorkbenchPageData({ projectId: PROJECT_ID });

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.estimate.id).toBe(ESTIMATE_TWO_ID);
    expect(result.estimate.selectionSource).toBe('most_recent');
  });

  it('keeps the selected estimate ready and reports request mismatches as warnings', async () => {
    const fromMock = vi.fn((table: string) => {
      if (table !== 'estimates') throw new Error(`Unexpected table ${table}`);
      return createEstimateQuery({
        data: [buildEstimateRow(), buildEstimateRow({ id: ESTIMATE_TWO_UUID, created_at: '2026-04-02T00:00:00.000Z', outputs: { version: 2 } })],
        error: null,
      });
    });
    getSupabaseServerAuthMock.mockResolvedValue({ from: fromMock });
    loadProjectDesignPackageRowsMock.mockResolvedValue([
      buildDesignRequestRow({
        requestId: 'dpr_22222222-2222-4222-8222-222222222222',
        estimateId: ESTIMATE_TWO_ID,
        estimateVersionLabel: 'V2',
      }),
    ]);
    loadProjectEstimateFlowMapsMock.mockResolvedValue({
      activeDraftEstimateId: ESTIMATE_ONE_UUID,
      editabilityByEstimateId: new Map([
        [ESTIMATE_ONE_UUID, { isLocked: false }],
        [ESTIMATE_TWO_UUID, { isLocked: false }],
      ]),
      flowByEstimateId: new Map([
        [ESTIMATE_ONE_UUID, { isActiveDraft: true, hasSentQuote: false, jobPackEligible: false, jobPackGeneratedAt: null, jobPackQuoteVersionId: null }],
        [ESTIMATE_TWO_UUID, { isActiveDraft: false, hasSentQuote: false, jobPackEligible: false, jobPackGeneratedAt: null, jobPackQuoteVersionId: null }],
      ]),
    });

    const { loadDesignWorkbenchPageData } = await import('./loadDesignWorkbenchPageData');
    const result = await loadDesignWorkbenchPageData({
      projectId: PROJECT_ID,
      estimateId: ESTIMATE_ONE_ID,
      requestId: 'dpr_22222222-2222-4222-8222-222222222222',
    });

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.estimate.id).toBe(ESTIMATE_ONE_ID);
    expect(result.request).toBeNull();
    expect(result.requestWarning).toEqual({
      reason: 'estimate_request_mismatch',
      providedRequestId: 'dpr_22222222-2222-4222-8222-222222222222',
      requestEstimateId: ESTIMATE_TWO_ID,
    });
  });
});
