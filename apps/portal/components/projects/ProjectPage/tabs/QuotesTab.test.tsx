import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import QuotesTab from './QuotesTab';

const replace = vi.fn();
const push = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const useQueryMock = vi.fn();
const prefetchQuery = vi.fn();
const setQueryData = vi.fn();
const invalidateQueries = vi.fn();
const getQueryData = vi.fn();
const fetchQuery = vi.fn();
const removeQueries = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  useSearchParams: () => new URLSearchParams('quoteId=qv_1'),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useQueryClient: () => ({
    prefetchQuery,
    setQueryData,
    invalidateQueries,
    getQueryData,
    fetchQuery,
    removeQueries,
  }),
}));

vi.mock('@/components/ui/toast/ToastProvider', () => ({
  useToast: () => ({
    success: toastSuccess,
    error: toastError,
  }),
}));

vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseHostFromUrl: () => 'host',
  supabaseRuntimeUrl: () => 'https://example.supabase.co',
}));

vi.mock('@/lib/queries/quotes', () => ({
  quoteVersionDetailQueryOptions: () => ({}),
  quoteVersionsByProjectQueryOptions: () => ({}),
}));

vi.mock('@/lib/queries/projectEstimates', () => ({
  estimateDetailQueryOptions: () => ({}),
  estimateMetasByProjectQueryOptions: () => ({}),
}));

vi.mock('@/lib/queries/jobPacks', () => ({
  generatedJobPacksByProjectQueryOptions: () => ({}),
}));

vi.mock('@/lib/queries/projectCache', () => ({
  invalidateProjectReadCaches: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/repo/jobPacksRepo', () => ({
  generateJobPack: vi.fn(),
}));

vi.mock('@/lib/localFirst/useEntitySyncState', () => ({
  useAliasedEntitySyncState: () => ({ pendingCount: 0 }),
}));

vi.mock('@/lib/localFirst/useResolvedLocalFirstId', () => ({
  useResolvedLocalFirstId: (value: string | null) => value,
}));

vi.mock('@/lib/localFirst/store', () => ({
  getAliasedLocalFirstEntitySyncState: () => ({ pendingCount: 0 }),
  writeLocalFirstWorkingCopy: vi.fn(),
}));

vi.mock('@/lib/localFirst/queue', () => ({
  enqueueAndProcessLocalFirstMutation: vi.fn(),
}));

vi.mock('@/lib/quotes/quotesRepo', () => ({
  createQuoteInvoice: vi.fn(),
  deleteDraftQuoteVersion: vi.fn(),
  markQuoteAccepted: vi.fn(),
  markQuoteDeclined: vi.fn(),
  previewQuotePdf: vi.fn(),
  previewDraftQuoteRefreshFromEstimate: vi.fn(),
  quotePdfUrl: (id: string) => `/api/quotes/${id}/pdf`,
  refreshDraftQuoteFromEstimate: vi.fn(),
  resendQuote: vi.fn(),
  reviseQuote: vi.fn(),
  sendQuote: vi.fn(),
}));

vi.mock('@/lib/localFirst/portalEntities', () => ({
  PORTAL_LOCAL_FIRST_MUTATIONS: {
    quoteCreateFromEstimate: 'portal.quote.createFromEstimate',
    quoteUpdateDraft: 'portal.quote.updateDraft',
  },
  applyDraftPatchToQuoteDetail: (detail: any) => detail,
  buildOptimisticQuoteDetail: vi.fn(),
  buildQuoteEntityKey: (id: string) => `quote:detail:${id}`,
  createLocalQuoteId: () => 'local-quote:1',
  isLocalQuoteId: (id: string) => id.startsWith('local-quote:'),
  upsertQuoteDetailCache: vi.fn(),
}));

vi.mock('./QuotePdfInlinePreview', () => ({
  default: () => <div data-testid="pdf-preview" />,
}));

const quoteDetail = {
  id: 'qv_1',
  quoteId: 'qt_1',
  projectId: 'proj_1',
  quoteRef: 'Q-1001',
  versionNumber: 1,
  status: 'DRAFT',
  depositPercent: 50,
  sourceEstimateVersionId: 'est_v1',
  sourceEstimateVersionLabel: 'V1',
  revisedFromQuoteVersionId: null,
  createdAt: '2026-04-02T00:00:00Z',
  createdBy: 'ops@example.com',
  sentAt: null,
  sentBy: null,
  expiresAt: null,
  reference: null,
  customerName: 'Taylor',
  introText: 'Intro',
  termsText: 'Terms',
  totals: {
    totalIncGstCents: 10000,
    totalExGstCents: 8696,
    gstCents: 1304,
  },
  pdfFileId: null,
  renderHash: null,
  lineItems: [
    {
      id: 'qli_1',
      description: ['Pergola 1', '- Style: Gable', '- Size: 6m x 3m', '- Roof: Acrylic', '- Posts: 4'].join('\n'),
      qty: 1,
      unitPriceIncGstCents: 10000,
      lineTotalIncGstCents: 10000,
      sortOrder: 0,
    },
  ],
  sendLogs: [],
  contact: {
    name: 'Taylor',
    email: 'taylor@example.com',
    phone: null,
  },
  project: {
    name: 'Test Project',
    siteAddress: '1 Example Road',
    region: 'Auckland',
    quoteRef: 'Q-1001',
  },
} as const;

describe('QuotesTab draft ownership UI', () => {
  beforeEach(() => {
    replace.mockReset();
    push.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    prefetchQuery.mockReset();
    setQueryData.mockReset();
    invalidateQueries.mockReset();
    getQueryData.mockReset();
    fetchQuery.mockReset();
    removeQueries.mockReset();
    useQueryMock.mockReset();

    const responses = [
      {
        data: [
          {
            id: 'qv_1',
            quoteRef: 'Q-1001',
            versionNumber: 1,
            status: 'DRAFT',
            sourceEstimateVersionLabel: 'V1',
            sourceEstimateVersionId: 'est_v1',
            sentAt: null,
            expiresAt: null,
            totals: { totalIncGstCents: 10000 },
            pdfFileId: null,
          },
        ],
        isPending: false,
        error: null,
      },
      {
        data: [
          { id: 'est_v1', versionLabel: 'V1', createdAt: '2026-04-01T00:00:00Z', isActiveDraft: false },
          { id: 'est_v2', versionLabel: 'V2', createdAt: '2026-04-02T00:00:00Z', isActiveDraft: true },
        ],
        isPending: false,
        error: null,
      },
      {
        data: [],
        isPending: false,
        error: null,
      },
      {
        data: quoteDetail,
        isPending: false,
        error: null,
      },
    ];
    let callIndex = 0;
    useQueryMock.mockImplementation(() => {
      const response = responses[callIndex % responses.length];
      callIndex += 1;
      return response;
    });
  });

  it('shows the explicit draft ownership note and new primary action', () => {
    const rendered = renderIntoDocument(<QuotesTab projectId="proj_1" selectedQuoteId="qv_1" />);

    expect(rendered.container.textContent).toContain('Draft quotes are independent once created.');
    expect(rendered.container.textContent).toContain('Review & Send');
    expect(rendered.container.textContent).toContain('More actions');
    expect(rendered.container.textContent).toContain('A newer design (V2) exists.');
    expect(rendered.container.textContent).toContain('Structured pergola editor');
    expect(rendered.container.querySelector('[aria-label="Page actions"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-quotes-view="detail"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Draft');
    expect(rendered.container.textContent).toContain('Internal');

    rendered.unmount();
  });
});
