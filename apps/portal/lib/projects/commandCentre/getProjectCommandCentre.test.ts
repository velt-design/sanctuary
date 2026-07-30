import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectWorkProjection } from '../workItems/types';

const commandCentreDependencies = vi.hoisted(() => ({
  getProjectWorkProjection: vi.fn(),
  getProjectWorkDomainActions: vi.fn(),
  isProjectWorkModelV2: vi.fn(),
}));

vi.mock('@/lib/projects/workItems/repository', () => ({
  getProjectWorkProjection: commandCentreDependencies.getProjectWorkProjection,
}));

vi.mock('@/lib/projects/workItems/getProjectWorkDomainActions', () => ({
  getProjectWorkDomainActions: commandCentreDependencies.getProjectWorkDomainActions,
}));

vi.mock('@/lib/projects/workItems/modelBoundary', () => ({
  isProjectWorkModelV2: commandCentreDependencies.isProjectWorkModelV2,
}));

import { getProjectCommandCentre } from './getProjectCommandCentre';

const UUID = {
  project: '11111111-1111-4111-8111-111111111111',
  estimate: '22222222-2222-4222-8222-222222222222',
  newerEstimate: '33333333-3333-4333-8333-333333333333',
  quote: '44444444-4444-4444-8444-444444444444',
  quoteParent: '55555555-5555-4555-8555-555555555555',
};

const PROJECT_WORK = {
  projectId: UUID.project,
  modelVersion: 2,
  operationalState: 'ACTIVE',
  effectiveState: 'ACTIVE',
  waitingUntil: null,
  waitingReason: null,
  closedOutcome: null,
  stateRowVersion: 1,
  primaryAction: {
    kind: 'needsTriage',
    title: 'Needs triage',
    reason: 'No current work is recorded.',
  },
  openItems: [],
  blockedItems: [],
  confirmedFacts: [],
  generatedAt: '2026-07-08T00:00:00.000Z',
} satisfies ProjectWorkProjection;

function queryResult(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => result);
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

function createClient(projectRow: Record<string, unknown>, detail: Record<string, unknown> | null = null) {
  const projectQuery = queryResult({ data: projectRow, error: null });
  const estimateQuery = queryResult({ data: detail, error: null });
  const emptyQuery = queryResult({ data: [], error: null });
  return {
    from: vi.fn((table: string) => table === 'projects' ? projectQuery : table === 'estimates' ? estimateQuery : emptyQuery),
    rpc: vi.fn(async () => ({ data: [], error: null })),
  } as any;
}

function estimateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID.estimate,
    project_id: UUID.project,
    created_at: '2026-07-01T00:00:00.000Z',
    status: 'draft',
    version: 1,
    summary_json: { total: 1234.56 },
    ...overrides,
  };
}

function quoteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID.quote,
    quote_id: UUID.quoteParent,
    version_number: 2,
    status: 'SENT',
    source_estimate_version_id: UUID.estimate,
    created_at: '2026-07-02T00:00:00.000Z',
    sent_at: '2026-07-02T01:00:00.000Z',
    total_inc_gst_cents: 175_000,
    sendLogs: [{ status: 'SENT', created_at: '2026-07-02T01:00:00.000Z', sent_at: '2026-07-02T01:00:00.000Z' }],
    ...overrides,
  };
}

function projectRow(
  estimates: unknown[],
  quoteVersions: unknown[] = [],
) {
  return {
    id: UUID.project,
    pipeline_stage: 'NEW',
    ownerAssignment: [],
    estimates,
    quotes: quoteVersions.length ? [{ id: UUID.quoteParent, quote_ref: 'Q-0100', quoteVersions }] : [],
  };
}

const DETAIL = {
  id: UUID.estimate,
  project_id: UUID.project,
  created_at: '2026-07-01T00:00:00.000Z',
  status: 'draft',
  version: 1,
  inputs: {
    schemaVersion: 'v2',
    quoteDiscountPct: '0',
    modules: [{
      lengthM: '6',
      projectionM: '4',
      pergolaStyle: 'gable',
      roofMaterial: 'acrylic',
    }],
  },
  outputs: {
    pricing_sync_state: 'current',
    totals: { cost_ex_gst: 1000, cost_inc_gst: 1150 },
  },
  costing_manifest: 'fixture',
  costing_rules: 'fixture',
};

describe('getProjectCommandCentre', () => {
  beforeEach(() => {
    commandCentreDependencies.getProjectWorkProjection
      .mockReset()
      .mockResolvedValue(PROJECT_WORK);
    commandCentreDependencies.getProjectWorkDomainActions
      .mockReset()
      .mockResolvedValue({
        recoveryAction: null,
        specialistAction: null,
      });
    commandCentreDependencies.isProjectWorkModelV2.mockReset().mockResolvedValue(false);
  });

  it('returns a truthful new-lead state without loading estimate detail', async () => {
    const client = createClient(projectRow([]));
    const result = await getProjectCommandCentre(`proj_${UUID.project}`, client);
    expect(result?.workModel).toBe('legacy');
    expect(result?.currentDesign).toMatchObject({ source: 'none', designState: 'none' });
    expect(result).toMatchObject({
      legacyWork: { status: 'retired', reviewHref: null },
      owner: {
        owner: null,
        required: true,
        missing: true,
        permissions: { canManage: false },
      },
    });
    expect(result).not.toHaveProperty('operations');
    expect(result).not.toHaveProperty('projectWork');
    expect(commandCentreDependencies.getProjectWorkProjection).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalledWith('estimates');
    const projectSelect = client.from.mock.results[0].value.select.mock.calls[0][0] as string;
    expect(projectSelect).toContain('pipeline_stage');
    expect(projectSelect).not.toContain('project_work_model_versions');
    expect(projectSelect).not.toMatch(/pipeline_stage,\s*status,/);
    expect(commandCentreDependencies.isProjectWorkModelV2).toHaveBeenCalledWith(client, UUID.project);
  });

  it('uses project work as the sole V2 operation owner', async () => {
    commandCentreDependencies.isProjectWorkModelV2.mockResolvedValueOnce(true);
    const client = createClient(
      projectRow([estimateRow()], [quoteRow()]),
      DETAIL,
    );
    const result = await getProjectCommandCentre(
      `proj_${UUID.project}`,
      client,
      { userId: 'viewer-1', isAdmin: true },
    );

    expect(result?.workModel).toBe('v2');
    expect(result).toHaveProperty('projectWork', PROJECT_WORK);
    expect(result).not.toHaveProperty('operations');
    expect(result?.currentDesign).toMatchObject({
      source: 'sent_quote',
      designState: 'available',
      price: { source: 'quote', totalIncGstCents: 175_000 },
      quote: { id: `qv_${UUID.quote}`, deliveryState: 'sent' },
      estimate: { id: `est_${UUID.estimate}`, isQuoteSource: true },
    });
    expect(commandCentreDependencies.getProjectWorkProjection).toHaveBeenCalledOnce();
    expect(commandCentreDependencies.getProjectWorkDomainActions).toHaveBeenCalledWith({
      supabase: client,
      projectId: `proj_${UUID.project}`,
      projectUuid: UUID.project,
      currentDesign: result?.currentDesign,
    });
    expect(commandCentreDependencies.getProjectWorkProjection).toHaveBeenCalledWith(expect.objectContaining({
      supabase: client,
      projectUuid: UUID.project,
      recoveryAction: null,
      specialistAction: null,
    }));
  });

  it('fails closed when a marked V2 project has no project-work projection', async () => {
    commandCentreDependencies.isProjectWorkModelV2.mockResolvedValueOnce(true);
    commandCentreDependencies.getProjectWorkProjection.mockResolvedValueOnce(null);
    const client = createClient(projectRow([]));

    await expect(
      getProjectCommandCentre(`proj_${UUID.project}`, client),
    ).rejects.toThrow('V2 project work could not be loaded');
  });

  it('exposes the manual legacy review destination only to admins', async () => {
    const result = await getProjectCommandCentre(
      `proj_${UUID.project}`,
      createClient(projectRow([])),
      { userId: 'admin-1', isAdmin: true },
    );

    expect(result).toMatchObject({
      workModel: 'legacy',
      legacyWork: {
        status: 'retired',
        reviewHref: '/staff/projects/work-queue/legacy-review',
      },
      owner: { permissions: { canManage: true } },
    });
  });

  it('returns the quote-ready estimate price and ignores the ambiguous saved summary', async () => {
    const result = await getProjectCommandCentre(
      `proj_${UUID.project}`,
      createClient(projectRow([estimateRow()]), DETAIL),
    );
    expect(result?.currentDesign).toMatchObject({
      source: 'estimate',
      design: { size: '6m x 4m', shape: 'Gable', roofing: 'Acrylic' },
      price: { source: 'estimate', totalIncGstCents: 143_750 },
      estimate: { versionLabel: 'V1', costingState: 'current' },
    });
  });

  it('keeps the sent quote total and reports a failed latest delivery attempt', async () => {
    const failedQuote = quoteRow({
      sendLogs: [
        { status: 'SENT', created_at: '2026-07-02T01:00:00.000Z' },
        { status: 'FAILED', created_at: '2026-07-03T01:00:00.000Z' },
      ],
    });
    const result = await getProjectCommandCentre(
      `proj_${UUID.project}`,
      createClient(projectRow([estimateRow()], [failedQuote]), DETAIL),
    );
    expect(result?.currentDesign).toMatchObject({
      source: 'sent_quote',
      price: { source: 'quote', totalIncGstCents: 175_000 },
      quote: { deliveryState: 'failed' },
    });
  });

  it('keeps accepted quote history authoritative over a newer unrelated estimate', async () => {
    const accepted = quoteRow({ status: 'ACCEPTED' });
    const newer = estimateRow({
      id: UUID.newerEstimate,
      version: 2,
      created_at: '2026-07-05T00:00:00.000Z',
    });
    const result = await getProjectCommandCentre(
      `proj_${UUID.project}`,
      createClient(projectRow([estimateRow(), newer], [accepted]), DETAIL),
    );
    expect(result?.currentDesign).toMatchObject({
      source: 'accepted_quote',
      estimate: { id: `est_${UUID.estimate}` },
      newerEstimate: { id: `est_${UUID.newerEstimate}`, versionLabel: 'V2' },
    });
  });

  it('does not use a declined quote as the current commercial source', async () => {
    const declined = quoteRow({ status: 'DECLINED' });
    const result = await getProjectCommandCentre(
      `proj_${UUID.project}`,
      createClient(projectRow([estimateRow()], [declined]), DETAIL),
    );
    expect(result?.currentDesign).toMatchObject({
      source: 'estimate',
      price: { source: 'estimate', totalIncGstCents: 143_750 },
      latestDeclinedQuote: { quoteVersionId: `qv_${UUID.quote}` },
    });
  });

  it('keeps quote price but marks a missing exact source without loading another estimate', async () => {
    const missingSource = quoteRow({ source_estimate_version_id: UUID.newerEstimate });
    const client = createClient(projectRow([estimateRow()], [missingSource]));
    const result = await getProjectCommandCentre(`proj_${UUID.project}`, client);
    expect(result?.currentDesign).toMatchObject({
      source: 'sent_quote',
      designState: 'source_unavailable',
      design: null,
      estimate: null,
      price: { source: 'quote', totalIncGstCents: 175_000 },
      warnings: ['source_design_unavailable'],
    });
    expect(client.from).not.toHaveBeenCalledWith('estimates');
  });

  it('never falls back to estimate price when the selected quote price is invalid', async () => {
    const missingPrice = quoteRow({ total_inc_gst_cents: null });
    const result = await getProjectCommandCentre(
      `proj_${UUID.project}`,
      createClient(projectRow([estimateRow()], [missingPrice]), DETAIL),
    );
    expect(result?.currentDesign.price).toEqual({ source: 'quote', totalIncGstCents: null });
    expect(result?.currentDesign.warnings).toContain('quote_price_unavailable');
  });

  it('marks a zero-value estimate price unavailable instead of showing a partial total', async () => {
    const result = await getProjectCommandCentre(
      `proj_${UUID.project}`,
      createClient(projectRow([estimateRow()]), {
        ...DETAIL,
        outputs: { pricing_sync_state: 'current', totals: { cost_ex_gst: 0, cost_inc_gst: 0 } },
      }),
    );
    expect(result?.currentDesign.price).toEqual({ source: 'estimate', totalIncGstCents: null });
    expect(result?.currentDesign.warnings).toContain('estimate_price_unavailable');
  });

  it('fails the complete read when selected estimate detail cannot be loaded', async () => {
    await expect(getProjectCommandCentre(
      `proj_${UUID.project}`,
      createClient(projectRow([estimateRow()]), null),
    )).rejects.toThrow('Selected estimate detail unavailable');
  });
});
