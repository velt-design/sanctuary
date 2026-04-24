import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DesignWorkbenchPage from './page';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import type { EstimateDetail } from '@/lib/estimates/types';

const getProjectPageSnapshotMock = vi.fn();
const loadDesignWorkbenchPageDataMock = vi.fn();
const notFoundMock = vi.fn();
const originalEnableWorkbenchFlag = process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH;
const originalEnableFixtureFlag = process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES;

vi.mock('@/lib/projects/getProjectPageSnapshot', () => ({
  getProjectPageSnapshot: (...args: unknown[]) => getProjectPageSnapshotMock(...args),
}));

vi.mock('@/lib/drawings/loadDesignWorkbenchPageData', () => ({
  loadDesignWorkbenchPageData: (...args: unknown[]) => loadDesignWorkbenchPageDataMock(...args),
}));

vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
}));

function buildEstimateDetail(overrides: Partial<EstimateDetail> = {}): EstimateDetail {
  const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');

  return {
    id: 'est_11111111-1111-4111-8111-111111111111',
    projectId: 'proj_11111111-1111-4111-8111-111111111111',
    createdAt: '2026-04-01T00:00:00.000Z',
    status: 'draft',
    summary: {},
    versionLabel: 'V1',
    isActiveDraft: true,
    hasSentQuote: false,
    jobPackEligible: false,
    jobPackGeneratedAt: null,
    jobPackQuoteVersionId: null,
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
    loadDesignWorkbenchPageDataMock.mockReset();
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
        params: Promise.resolve({ projectId: 'proj_11111111-1111-4111-8111-111111111111' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(loadDesignWorkbenchPageDataMock).not.toHaveBeenCalled();
  });

  it('renders an unavailable state for invalid ids', async () => {
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH = '1';

    const ui = (await DesignWorkbenchPage({
      params: Promise.resolve({ projectId: '   ' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('Project unavailable');
    expect(markup).toContain('Invalid project id.');
    expect(loadDesignWorkbenchPageDataMock).not.toHaveBeenCalled();
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
    expect(markup).toContain('data-workbench-context="fixture_ready"');
    expect(loadDesignWorkbenchPageDataMock).not.toHaveBeenCalled();
  });

  it('renders an unavailable state when the consolidated loader cannot load the project', async () => {
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH = '1';
    loadDesignWorkbenchPageDataMock.mockResolvedValue({ kind: 'project_unavailable' });

    const ui = (await DesignWorkbenchPage({
      params: Promise.resolve({ projectId: 'proj_11111111-1111-4111-8111-111111111111' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('Project unavailable');
    expect(markup).toContain('We could not load this project.');
  });

  it('renders the ready state from the consolidated loader', async () => {
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH = '1';
    loadDesignWorkbenchPageDataMock.mockResolvedValue({
      kind: 'ready',
      project: {
        id: 'proj_11111111-1111-4111-8111-111111111111',
        name: 'Deck Build',
        siteAddress: '1 Test Street',
      },
      estimate: {
        id: 'est_11111111-1111-4111-8111-111111111111',
        versionLabel: 'V1',
        status: 'draft',
        createdAt: '2026-04-01T00:00:00.000Z',
        isActiveDraft: true,
        selectionSource: 'active_draft',
      },
      request: null,
      estimateWarning: null,
      requestWarning: null,
      providedEstimateId: null,
      providedRequestId: null,
      detail: buildEstimateDetail(),
    });

    const ui = (await DesignWorkbenchPage({
      params: Promise.resolve({ projectId: 'proj_11111111-1111-4111-8111-111111111111' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('aria-label="Drawing workbench"');
    expect(markup).toContain('data-workbench-context="ready"');
    expect(markup).toContain('data-estimate-id="est_11111111-1111-4111-8111-111111111111"');
    expect(markup).toContain('Back to Project');
  });

  it('renders a no-estimate state when the consolidated loader finds no usable estimate', async () => {
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH = '1';
    loadDesignWorkbenchPageDataMock.mockResolvedValue({
      kind: 'no_estimate',
      project: {
        id: 'proj_11111111-1111-4111-8111-111111111111',
        name: 'Deck Build',
        siteAddress: null,
      },
      providedEstimateId: 'est_missing',
      providedRequestId: 'dpr_missing',
    });

    const ui = (await DesignWorkbenchPage({
      params: Promise.resolve({ projectId: 'proj_11111111-1111-4111-8111-111111111111' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('Design Workbench');
    expect(markup).toContain('No usable estimate exists for this project yet.');
    expect(markup).toContain('data-workbench-context="no_estimate"');
  });
});
