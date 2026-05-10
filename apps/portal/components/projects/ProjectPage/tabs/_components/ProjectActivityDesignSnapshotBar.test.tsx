import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';

const useQueryMock = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

vi.mock('@/lib/queries/projectEstimates', () => ({
  estimateMetasByProjectQueryOptions: () => ({ queryKey: ['estimates'] }),
  estimateDetailQueryOptions: () => ({ queryKey: ['estimate-detail'] }),
}));

vi.mock('@/lib/queries/quotes', () => ({
  quoteVersionsByProjectQueryOptions: () => ({ queryKey: ['quotes'] }),
}));

vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseHostFromUrl: () => 'host',
  supabaseRuntimeUrl: () => 'https://example.supabase.co',
}));

import ProjectActivityDesignSnapshotBar from './ProjectActivityDesignSnapshotBar';

const ESTIMATE_META = {
  id: 'est_1',
  projectId: 'proj_1',
  createdAt: '2026-05-01T00:00:00.000Z',
  status: 'draft',
  summary: { total: 18000 },
  versionLabel: 'V1',
  isActiveDraft: true,
  hasSentQuote: false,
  jobPackEligible: false,
  jobPackGeneratedAt: null,
  jobPackQuoteVersionId: null,
};

const ACCEPTED_QUOTE = {
  id: 'qv_accepted',
  quoteId: 'q_1',
  projectId: 'proj_1',
  quoteRef: 'Q-001',
  versionNumber: 1,
  status: 'ACCEPTED',
  depositPercent: 50,
  sourceEstimateVersionId: 'est_1',
  sourceEstimateVersionLabel: 'V1',
  revisedFromQuoteVersionId: null,
  createdAt: '2026-05-02T00:00:00.000Z',
  totals: { totalIncGstCents: 2485000, totalExGstCents: 2160870, gstCents: 324130 },
  pdfFileId: null,
  renderHash: null,
};

const ESTIMATE_DETAIL_WITH_MODULE = {
  ...ESTIMATE_META,
  calculatorSnapshot: {
    inputs: {
      modules: [
        {
          pergolaStyle: 'pitched_roof',
          roofMaterial: 'acrylic',
          lengthM: '6',
          projectionM: '3',
        },
      ],
    },
  },
  internalNotes: null,
  editability: { isLocked: false },
};

function setupQueryReturns({
  estimates,
  quotes,
  detail,
}: {
  estimates: unknown[];
  quotes: unknown[];
  detail?: unknown;
}) {
  useQueryMock.mockImplementation((options: any) => {
    const key = JSON.stringify(options.queryKey);
    if (key === JSON.stringify(['estimates'])) return { data: estimates };
    if (key === JSON.stringify(['quotes'])) return { data: quotes };
    if (key === JSON.stringify(['estimate-detail'])) return { data: detail };
    return { data: undefined };
  });
}

describe('ProjectActivityDesignSnapshotBar', () => {
  beforeEach(() => {
    useQueryMock.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the empty fallback when no estimates and no quotes exist', () => {
    setupQueryReturns({ estimates: [], quotes: [] });
    const rendered = renderIntoDocument(<ProjectActivityDesignSnapshotBar projectId="proj_1" />);
    expect(rendered.container.textContent).toContain('Current design');
    expect(rendered.container.textContent).toContain('No design selected');
    rendered.unmount();
  });

  it('renders the accepted quote summary with size, shape, price, and an accepted pill', () => {
    setupQueryReturns({
      estimates: [ESTIMATE_META],
      quotes: [ACCEPTED_QUOTE],
      detail: ESTIMATE_DETAIL_WITH_MODULE,
    });
    const rendered = renderIntoDocument(<ProjectActivityDesignSnapshotBar projectId="proj_1" />);
    const text = rendered.container.textContent ?? '';
    expect(text).toContain('Current design');
    expect(text).toContain('6m x 3m');
    expect(text).toContain('Pitched Roof acrylic');
    expect(text).toContain('$24,850 inc GST');
    expect(text).toContain('Quote accepted');
    const pill = rendered.container.querySelector('[data-status-variant]') as HTMLElement | null;
    expect(pill?.dataset.statusVariant).toBe('accepted');
    rendered.unmount();
  });

  it('shows a View quote link pointing at the chosen quote version when one is chosen', () => {
    setupQueryReturns({
      estimates: [ESTIMATE_META],
      quotes: [ACCEPTED_QUOTE],
      detail: ESTIMATE_DETAIL_WITH_MODULE,
    });
    const rendered = renderIntoDocument(<ProjectActivityDesignSnapshotBar projectId="proj_1" />);
    const link = rendered.container.querySelector('a[href*="quoteId="]') as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toContain('qv_accepted');
    expect(link?.textContent?.trim()).toBe('View quote');
    rendered.unmount();
  });

  it('falls through to the estimate when only declined quotes exist', () => {
    const declined = { ...ACCEPTED_QUOTE, id: 'qv_dec', status: 'DECLINED' };
    setupQueryReturns({
      estimates: [ESTIMATE_META],
      quotes: [declined],
      detail: ESTIMATE_DETAIL_WITH_MODULE,
    });
    const rendered = renderIntoDocument(<ProjectActivityDesignSnapshotBar projectId="proj_1" />);
    expect(rendered.container.textContent).toContain('Quotes declined');
    const pill = rendered.container.querySelector('[data-status-variant]') as HTMLElement | null;
    expect(pill?.dataset.statusVariant).toBe('declined');
    rendered.unmount();
  });

  it('shows a View design link when an estimate exists with no quote', () => {
    setupQueryReturns({
      estimates: [ESTIMATE_META],
      quotes: [],
      detail: ESTIMATE_DETAIL_WITH_MODULE,
    });
    const rendered = renderIntoDocument(<ProjectActivityDesignSnapshotBar projectId="proj_1" />);
    const link = rendered.container.querySelector('a[href*="tab=estimates"]') as HTMLAnchorElement | null;
    expect(link?.textContent?.trim()).toBe('View design');
    rendered.unmount();
  });
});
