import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DesignWorkbenchPage from './page';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import type { DesignListRow } from '@/lib/designPackages/types';
import type { EstimateDetail, EstimateMeta } from '@/lib/estimates/types';

const getProjectPageSnapshotMock = vi.fn();
const loadProjectEstimateMetasMock = vi.fn();
const loadProjectDesignPackageRowsMock = vi.fn();
const loadProjectEstimateDetailMock = vi.fn();
const notFoundMock = vi.fn();
const originalEnableWorkbenchFlag = process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH;
const originalEnableFixtureFlag = process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES;

vi.mock('@/lib/projects/getProjectPageSnapshot', () => ({
  getProjectPageSnapshot: (...args: unknown[]) => getProjectPageSnapshotMock(...args),
}));

vi.mock('@/lib/estimates/loadProjectEstimateMetas', () => ({
  loadProjectEstimateMetas: (...args: unknown[]) => loadProjectEstimateMetasMock(...args),
}));

vi.mock('@/lib/designPackages/server', () => ({
  loadProjectDesignPackageRows: (...args: unknown[]) => loadProjectDesignPackageRowsMock(...args),
}));

vi.mock('@/lib/estimates/loadProjectEstimateDetail', () => ({
  loadProjectEstimateDetail: (...args: unknown[]) => loadProjectEstimateDetailMock(...args),
}));

vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
}));

function buildEstimateMeta(overrides: Partial<EstimateMeta> = {}): EstimateMeta {
  return {
    id: 'est_11111111-1111-4111-8111-111111111111',
    projectId: 'proj_11111111-1111-4111-8111-111111111111',
    createdAt: '2026-04-01T00:00:00.000Z',
    status: 'draft',
    summary: {},
    versionLabel: 'V1',
    isActiveDraft: false,
    hasSentQuote: false,
    jobPackEligible: false,
    jobPackGeneratedAt: null,
    jobPackQuoteVersionId: null,
    ...overrides,
  };
}

function buildDesignRequestRow(overrides: Partial<DesignListRow> = {}): DesignListRow {
  return {
    requestId: 'dpr_11111111-1111-4111-8111-111111111111',
    projectId: 'proj_11111111-1111-4111-8111-111111111111',
    estimateId: 'est_11111111-1111-4111-8111-111111111111',
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

function buildEstimateDetail(overrides: Partial<EstimateDetail> = {}): EstimateDetail {
  const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');

  return {
    ...buildEstimateMeta(),
    calculatorSnapshot: fixture?.snapshot ?? null,
    internalNotes: null,
    editability: {
      isLocked: false,
      lockReason: null,
      lockedAt: null,
      lockedByQuoteVersionId: null,
      lockedByQuoteRef: null,
      lockedByQuoteVersionNumber: null,
      hasDraftQuotes: false,
      draftQuoteCount: 0,
    },
    ...overrides,
  };
}

describe('DesignWorkbenchPage', () => {
  beforeEach(() => {
    getProjectPageSnapshotMock.mockReset();
    loadProjectEstimateMetasMock.mockReset();
    loadProjectDesignPackageRowsMock.mockReset();
    loadProjectEstimateDetailMock.mockReset();
    notFoundMock.mockReset();
    delete process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH;
    delete process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES;
    notFoundMock.mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND');
    });
  });

  afterEach(() => {
    if (originalEnableWorkbenchFlag === undefined) {
      delete process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH;
    } else {
      process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH = originalEnableWorkbenchFlag;
    }

    if (originalEnableFixtureFlag === undefined) {
      delete process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES;
    } else {
      process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES = originalEnableFixtureFlag;
    }
  });

  it('calls notFound when the workbench flag is unset', async () => {
    await expect(
      DesignWorkbenchPage({
        params: Promise.resolve({ projectId: 'proj_1' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(getProjectPageSnapshotMock).not.toHaveBeenCalled();
    expect(loadProjectEstimateMetasMock).not.toHaveBeenCalled();
    expect(loadProjectDesignPackageRowsMock).not.toHaveBeenCalled();
    expect(loadProjectEstimateDetailMock).not.toHaveBeenCalled();
  });

  it('calls notFound when the workbench flag is not enabled', async () => {
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH = '0';

    await expect(
      DesignWorkbenchPage({
        params: Promise.resolve({ projectId: 'proj_1' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(getProjectPageSnapshotMock).not.toHaveBeenCalled();
    expect(loadProjectEstimateMetasMock).not.toHaveBeenCalled();
    expect(loadProjectDesignPackageRowsMock).not.toHaveBeenCalled();
    expect(loadProjectEstimateDetailMock).not.toHaveBeenCalled();
  });

  it('calls notFound when fixture mode is requested without the fixture flag', async () => {
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH = '1';

    await expect(
      DesignWorkbenchPage({
        params: Promise.resolve({ projectId: 'proj_1' }),
        searchParams: Promise.resolve({ fixture: 'mono-standard' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(getProjectPageSnapshotMock).not.toHaveBeenCalled();
    expect(loadProjectEstimateMetasMock).not.toHaveBeenCalled();
    expect(loadProjectDesignPackageRowsMock).not.toHaveBeenCalled();
    expect(loadProjectEstimateDetailMock).not.toHaveBeenCalled();
  });

  it('renders an unavailable state for invalid ids', async () => {
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH = '1';

    const ui = (await DesignWorkbenchPage({
      params: Promise.resolve({ projectId: '   ' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('Project unavailable');
    expect(markup).toContain('Invalid project id.');
    expect(getProjectPageSnapshotMock).not.toHaveBeenCalled();
    expect(loadProjectEstimateDetailMock).not.toHaveBeenCalled();
  });

  it('renders an unavailable state when the project snapshot is missing', async () => {
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH = '1';
    getProjectPageSnapshotMock.mockResolvedValue(null);

    const ui = (await DesignWorkbenchPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(getProjectPageSnapshotMock).toHaveBeenCalledWith('proj_1');
    expect(markup).toContain('Project unavailable');
    expect(markup).toContain('We could not load this project.');
    expect(loadProjectEstimateMetasMock).not.toHaveBeenCalled();
    expect(loadProjectDesignPackageRowsMock).not.toHaveBeenCalled();
    expect(loadProjectEstimateDetailMock).not.toHaveBeenCalled();
  });

  it('renders the fixture workbench shell for a valid fixture slug', async () => {
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH = '1';
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES = '1';
    getProjectPageSnapshotMock.mockResolvedValue({
      project: { id: 'proj_1', name: 'Deck Build', stage: 'new', siteAddress: '1 Test Street' },
      pipeline: { stage: 'new' },
      tasks: { stage: 'new', items: [] },
      activity: [],
      emails: [],
    });

    const ui = (await DesignWorkbenchPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({ fixture: 'mono-standard' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('Fixture Preview');
    expect(markup).toContain('Drawing workbench');
    expect(markup).toContain('Sheet View');
    expect(markup).toContain('Back to Project');
    expect(markup).toContain('data-workbench-context="fixture_ready"');
    expect(markup).toContain('data-workbench-fixture="mono-standard"');
    expect(loadProjectEstimateMetasMock).not.toHaveBeenCalled();
    expect(loadProjectDesignPackageRowsMock).not.toHaveBeenCalled();
    expect(loadProjectEstimateDetailMock).not.toHaveBeenCalled();
  });

  it('renders an invalid-fixture state for unknown fixture slugs', async () => {
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH = '1';
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES = '1';
    getProjectPageSnapshotMock.mockResolvedValue({
      project: { id: 'proj_1', name: 'Deck Build', stage: 'new' },
      pipeline: { stage: 'new' },
      tasks: { stage: 'new', items: [] },
      activity: [],
      emails: [],
    });

    const ui = (await DesignWorkbenchPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({ fixture: 'not-real' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('Route state: Invalid Fixture');
    expect(markup).toContain('Unknown fixture slug: not-real');
    expect(markup).toContain('data-workbench-context="invalid_fixture"');
    expect(markup).not.toContain('Drawing workbench');
    expect(loadProjectEstimateMetasMock).not.toHaveBeenCalled();
    expect(loadProjectDesignPackageRowsMock).not.toHaveBeenCalled();
    expect(loadProjectEstimateDetailMock).not.toHaveBeenCalled();
  });

  it('picks the active draft estimate by default and includes linked request metadata when available', async () => {
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH = '1';
    getProjectPageSnapshotMock.mockResolvedValue({
      project: { id: 'proj_1', name: 'Deck Build', stage: 'new' },
      pipeline: { stage: 'new' },
      tasks: { stage: 'new', items: [] },
      activity: [],
      emails: [],
    });
    loadProjectEstimateMetasMock.mockResolvedValue([
      buildEstimateMeta({
        id: 'est_22222222-2222-4222-8222-222222222222',
        createdAt: '2026-04-04T00:00:00.000Z',
        versionLabel: 'V2',
        isActiveDraft: true,
      }),
      buildEstimateMeta(),
    ]);
    loadProjectDesignPackageRowsMock.mockResolvedValue([
      buildDesignRequestRow({
        requestId: 'dpr_22222222-2222-4222-8222-222222222222',
        estimateId: 'est_22222222-2222-4222-8222-222222222222',
        estimateVersionLabel: 'V2',
        requestVersion: 2,
      }),
    ]);
    loadProjectEstimateDetailMock.mockResolvedValue(
      buildEstimateDetail({
        id: 'est_22222222-2222-4222-8222-222222222222',
        projectId: 'proj_1',
        versionLabel: 'V2',
        isActiveDraft: true,
      }),
    );

    const ui = (await DesignWorkbenchPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({}),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('aria-label="Drawing workbench"');
    expect(markup).toContain('Sheet View');
    expect(markup).toContain('Back to Project');
    expect(markup).toContain('href="/staff/projects/proj_1"');
    expect(markup).toContain('data-project-id="proj_1"');
    expect(markup).toContain('data-workbench-context="ready"');
    expect(markup).not.toContain('Route state: Ready');
    expect(markup).not.toContain('Estimate selection: Active draft default');
    expect(loadProjectEstimateDetailMock).toHaveBeenCalledWith('proj_1', 'est_22222222-2222-4222-8222-222222222222');
  });

  it('falls back to the most recent estimate when no active draft exists', async () => {
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH = '1';
    getProjectPageSnapshotMock.mockResolvedValue({
      project: { id: 'proj_1', name: 'Deck Build', stage: 'new' },
      pipeline: { stage: 'new' },
      tasks: { stage: 'new', items: [] },
      activity: [],
      emails: [],
    });
    loadProjectEstimateMetasMock.mockResolvedValue([
      buildEstimateMeta({
        id: 'est_33333333-3333-4333-8333-333333333333',
        createdAt: '2026-04-05T00:00:00.000Z',
        versionLabel: 'V3',
      }),
      buildEstimateMeta(),
    ]);
    loadProjectDesignPackageRowsMock.mockResolvedValue([
      buildDesignRequestRow({
        requestId: 'dpr_33333333-3333-4333-8333-333333333333',
        estimateId: 'est_33333333-3333-4333-8333-333333333333',
        estimateVersionLabel: 'V3',
        requestVersion: 3,
      }),
    ]);
    loadProjectEstimateDetailMock.mockResolvedValue(
      buildEstimateDetail({
        id: 'est_33333333-3333-4333-8333-333333333333',
        projectId: 'proj_1',
        versionLabel: 'V3',
      }),
    );

    const ui = (await DesignWorkbenchPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({}),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('aria-label="Drawing workbench"');
    expect(markup).not.toContain('Estimate selection: Most recent default');
  });

  it('uses an explicit estimateId when it belongs to the project', async () => {
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH = '1';
    getProjectPageSnapshotMock.mockResolvedValue({
      project: { id: 'proj_1', name: 'Deck Build', stage: 'new' },
      pipeline: { stage: 'new' },
      tasks: { stage: 'new', items: [] },
      activity: [],
      emails: [],
    });
    loadProjectEstimateMetasMock.mockResolvedValue([
      buildEstimateMeta(),
      buildEstimateMeta({
        id: 'est_44444444-4444-4444-8444-444444444444',
        versionLabel: 'V4',
      }),
    ]);
    loadProjectDesignPackageRowsMock.mockResolvedValue([
      buildDesignRequestRow({
        requestId: 'dpr_44444444-4444-4444-8444-444444444444',
        estimateId: 'est_44444444-4444-4444-8444-444444444444',
        estimateVersionLabel: 'V4',
        requestVersion: 4,
      }),
    ]);
    loadProjectEstimateDetailMock.mockResolvedValue(
      buildEstimateDetail({
        id: 'est_44444444-4444-4444-8444-444444444444',
        projectId: 'proj_1',
        versionLabel: 'V4',
      }),
    );

    const ui = (await DesignWorkbenchPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({ estimateId: 'est_44444444-4444-4444-8444-444444444444' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('aria-label="Drawing workbench"');
    expect(markup).not.toContain('Estimate selection: Query param');
  });

  it('uses an explicit requestId as metadata when it matches the selected estimate', async () => {
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH = '1';
    getProjectPageSnapshotMock.mockResolvedValue({
      project: { id: 'proj_1', name: 'Deck Build', stage: 'new' },
      pipeline: { stage: 'new' },
      tasks: { stage: 'new', items: [] },
      activity: [],
      emails: [],
    });
    loadProjectEstimateMetasMock.mockResolvedValue([
      buildEstimateMeta({
        id: 'est_55555555-5555-4555-8555-555555555555',
        versionLabel: 'V5',
        createdAt: '2026-04-05T00:00:00.000Z',
      }),
      buildEstimateMeta(),
    ]);
    loadProjectDesignPackageRowsMock.mockResolvedValue([
      buildDesignRequestRow(),
      buildDesignRequestRow({
        requestId: 'dpr_55555555-5555-4555-8555-555555555555',
        estimateId: 'est_55555555-5555-4555-8555-555555555555',
        estimateVersionLabel: 'V5',
        requestVersion: 5,
      }),
    ]);
    loadProjectEstimateDetailMock.mockResolvedValue(
      buildEstimateDetail({
        id: 'est_55555555-5555-4555-8555-555555555555',
        projectId: 'proj_1',
        versionLabel: 'V5',
      }),
    );

    const ui = (await DesignWorkbenchPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({ requestId: 'dpr_55555555-5555-4555-8555-555555555555' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('aria-label="Drawing workbench"');
    expect(markup).not.toContain('Design request selection: Query param');
  });

  it('renders a no-estimate state when the project has no estimates', async () => {
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH = '1';
    getProjectPageSnapshotMock.mockResolvedValue({
      project: { id: 'proj_1', name: 'Deck Build', stage: 'new' },
      pipeline: { stage: 'new' },
      tasks: { stage: 'new', items: [] },
      activity: [],
      emails: [],
    });
    loadProjectEstimateMetasMock.mockResolvedValue([]);
    loadProjectDesignPackageRowsMock.mockResolvedValue([]);

    const ui = (await DesignWorkbenchPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({}),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('Design Workbench');
    expect(markup).toContain('No usable estimate exists for this project yet.');
    expect(markup).toContain('data-workbench-context="no_estimate"');
    expect(loadProjectEstimateDetailMock).not.toHaveBeenCalled();
  });

  it('renders an unavailable state when the selected estimate detail cannot be loaded', async () => {
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH = '1';
    getProjectPageSnapshotMock.mockResolvedValue({
      project: { id: 'proj_1', name: 'Deck Build', stage: 'new', siteAddress: '1 Test Street' },
      pipeline: { stage: 'new' },
      tasks: { stage: 'new', items: [] },
      activity: [],
      emails: [],
    });
    loadProjectEstimateMetasMock.mockResolvedValue([buildEstimateMeta({ isActiveDraft: true })]);
    loadProjectDesignPackageRowsMock.mockResolvedValue([]);
    loadProjectEstimateDetailMock.mockResolvedValue(null);

    const ui = (await DesignWorkbenchPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({}),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('Project unavailable');
    expect(markup).toContain('We could not load the selected estimate for this project.');
    expect(markup).not.toContain('Drawing Workbench');
  });

  it('stays ready when the project has no active request linked to the selected estimate', async () => {
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH = '1';
    getProjectPageSnapshotMock.mockResolvedValue({
      project: { id: 'proj_1', name: 'Deck Build', stage: 'new' },
      pipeline: { stage: 'new' },
      tasks: { stage: 'new', items: [] },
      activity: [],
      emails: [],
    });
    loadProjectEstimateMetasMock.mockResolvedValue([buildEstimateMeta({ isActiveDraft: true })]);
    loadProjectDesignPackageRowsMock.mockResolvedValue([
      buildDesignRequestRow({
        requestId: 'dpr_66666666-6666-4666-8666-666666666666',
        status: 'DONE',
      }),
    ]);
    loadProjectEstimateDetailMock.mockResolvedValue(
      buildEstimateDetail({
        projectId: 'proj_1',
        isActiveDraft: true,
      }),
    );

    const ui = (await DesignWorkbenchPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({}),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('aria-label="Drawing workbench"');
    expect(markup).toContain('data-workbench-context="ready"');
    expect(markup).not.toContain('Design request context: none linked to the selected estimate');
  });

  it('keeps the route ready and warns when estimateId and requestId do not match', async () => {
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH = '1';
    getProjectPageSnapshotMock.mockResolvedValue({
      project: { id: 'proj_1', name: 'Deck Build', stage: 'new' },
      pipeline: { stage: 'new' },
      tasks: { stage: 'new', items: [] },
      activity: [],
      emails: [],
    });
    loadProjectEstimateMetasMock.mockResolvedValue([
      buildEstimateMeta({
        id: 'est_77777777-7777-4777-8777-777777777777',
        versionLabel: 'V7',
      }),
      buildEstimateMeta({
        id: 'est_88888888-8888-4888-8888-888888888888',
        versionLabel: 'V8',
      }),
    ]);
    loadProjectDesignPackageRowsMock.mockResolvedValue([
      buildDesignRequestRow({
        requestId: 'dpr_88888888-8888-4888-8888-888888888888',
        estimateId: 'est_88888888-8888-4888-8888-888888888888',
        estimateVersionLabel: 'V8',
        requestVersion: 8,
      }),
    ]);
    loadProjectEstimateDetailMock.mockResolvedValue(
      buildEstimateDetail({
        id: 'est_77777777-7777-4777-8777-777777777777',
        projectId: 'proj_1',
        versionLabel: 'V7',
      }),
    );

    const ui = (await DesignWorkbenchPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({
        estimateId: 'est_77777777-7777-4777-8777-777777777777',
        requestId: 'dpr_88888888-8888-4888-8888-888888888888',
      }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('aria-label="Drawing workbench"');
    expect(markup).toContain('data-workbench-context="ready"');
    expect(markup).not.toContain('The supplied requestId (dpr_88888888-8888-4888-8888-888888888888)');
  });

  it('falls back to the default estimate and warns when estimateId is invalid', async () => {
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH = '1';
    getProjectPageSnapshotMock.mockResolvedValue({
      project: { id: 'proj_1', name: 'Deck Build', stage: 'new' },
      pipeline: { stage: 'new' },
      tasks: { stage: 'new', items: [] },
      activity: [],
      emails: [],
    });
    loadProjectEstimateMetasMock.mockResolvedValue([buildEstimateMeta()]);
    loadProjectDesignPackageRowsMock.mockResolvedValue([]);
    loadProjectEstimateDetailMock.mockResolvedValue(buildEstimateDetail({ projectId: 'proj_1' }));

    const ui = (await DesignWorkbenchPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({ estimateId: 'not-an-estimate' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('aria-label="Drawing workbench"');
    expect(markup).toContain('data-workbench-context="ready"');
    expect(markup).not.toContain('The supplied estimateId (not-an-estimate)');
  });

  it('keeps the route ready and warns when requestId is invalid', async () => {
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH = '1';
    getProjectPageSnapshotMock.mockResolvedValue({
      project: { id: 'proj_1', name: 'Deck Build', stage: 'new' },
      pipeline: { stage: 'new' },
      tasks: { stage: 'new', items: [] },
      activity: [],
      emails: [],
    });
    loadProjectEstimateMetasMock.mockResolvedValue([buildEstimateMeta()]);
    loadProjectDesignPackageRowsMock.mockResolvedValue([buildDesignRequestRow()]);
    loadProjectEstimateDetailMock.mockResolvedValue(buildEstimateDetail({ projectId: 'proj_1' }));

    const ui = (await DesignWorkbenchPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({ requestId: 'not-a-request' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('aria-label="Drawing workbench"');
    expect(markup).toContain('data-workbench-context="ready"');
    expect(markup).not.toContain('The supplied requestId (not-a-request)');
  });
});
