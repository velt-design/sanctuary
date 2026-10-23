import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act,Profiler,useMemo } from 'react';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import QuotesTab from './QuotesTab';
import QuotesListView from './QuotesListView';
import QuotesListSurface,{useQuotesListControls,type QuotesListEvidence} from './QuotesListSurface';
import {useOwnedPortalPublication} from '@/components/page-state/PortalPageSource';
import {PortalQueryClientScope} from '@/lib/react-query/PortalQueryClientContext';
import { buildOptimisticQuoteDetail } from '@/lib/localFirst/portalEntities';
import { enqueueAndProcessLocalFirstMutation } from '@/lib/localFirst/queue';
import { CommercialProjectNotice, ProjectCommercialProvider } from '../ProjectCommercialContext';
import type { ProjectWorkProjection } from '@/lib/projects/workItems/types';

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
const markQuoteVersionSuperseded = vi.hoisted(() => vi.fn());
let portalIsAdmin = true;
let searchParamsValue = 'quoteId=qv_1';
let activeQuoteList: any[] = [];

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  useSearchParams: () => new URLSearchParams(searchParamsValue),
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

vi.mock('@/components/auth/PortalAuthProvider', () => ({
  usePortalSession: () => ({ isAdmin: portalIsAdmin, role: portalIsAdmin ? 'admin' : 'staff' }),
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
  deleteDraftQuoteVersion: vi.fn(),
  getPreparedQuoteDelivery: vi.fn(),
  markQuoteAccepted: vi.fn(),
  markQuoteDeclined: vi.fn(),
  markQuoteVersionSuperseded,
  previewQuotePdf: vi.fn(),
  previewDraftQuoteRefreshFromEstimate: vi.fn(),
  quotePdfUrl: (id: string) => `/api/quotes/${id}/pdf`,
  refreshDraftQuoteFromEstimate: vi.fn(),
  resendQuote: vi.fn(),
  retryPreparedQuoteDelivery: vi.fn(),
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
  updatedAt: '2026-04-02T00:00:00Z',
  commercialRevision: 1,
  isCurrentDraft: true,
  deliveryPreparedAt: null,
  pricingSource: 'calculator_live',
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
let activeQuoteDetail: any = quoteDetail;

let oldQuotePublish:((value:QuotesListEvidence|null)=>void)|undefined;
function ManagedQuotes({allowed,owner,pending}:{allowed:boolean;owner:object;pending:boolean}) {
 const controls=useQuotesListControls('proj_1'),published=useOwnedPortalPublication<QuotesListEvidence>(allowed?owner:null);
 const binding=useMemo(()=>({controls,publish:published.publish}),[controls,published.publish]);
 if(allowed)oldQuotePublish=published.publish;
 const producer=useMemo(()=>allowed?<QuotesListView {...({projectId:'proj_1',quotes:pending?[]:[quoteDetail],quotesLoading:pending,quotesError:null,retryQuotes:vi.fn(),
  openCreate:vi.fn(),selectQuote:vi.fn(),prefetchQuoteDetail:vi.fn(),createOpen:false,closeCreate:vi.fn(),createEstimateId:'',setCreateEstimateId:vi.fn(),createInternalName:'',setCreateInternalName:vi.fn(),estimatesLoading:false,estimates:[],createQuote:vi.fn(),createMode:'estimate',setCreateMode:vi.fn(),manualDescription:'',setManualDescription:vi.fn(),manualQty:'1',setManualQty:vi.fn(),manualPrice:'',setManualPrice:vi.fn(),createBusy:false,isAdmin:false,deleteQuote:vi.fn(),supersedeQuote:vi.fn(),supersedePendingId:null,renameTarget:null,renamePending:false,renameQuote:vi.fn(),closeRename:vi.fn(),saveRename:vi.fn()} as any)} listSurface={binding}/>:null,[allowed,pending,binding]);
 return <><QuotesListSurface query={controls.query} onQueryChange={controls.setQuery} showHistory={controls.showHistory} onHistoryChange={controls.setShowHistory}
  onInteraction={controls.markInteracted} evidence={published.value} unavailable={!allowed}/>{producer}</>;
}

it('preserves actual quote Find/history/table/focus across held authority and pending rows, without consulting saved private state before its owner',()=>{
 const data=new Map<string,unknown>([[JSON.stringify(['commercialListView','proj_1','quotes-search']),'Old saved filter']]);
 const cache={getQueryData:vi.fn((key:unknown)=>data.get(JSON.stringify(key))),setQueryData:vi.fn((key:unknown,value:unknown)=>data.set(JSON.stringify(key),value))};
 const a={},b={};const tree=(allowed:boolean,owner:object,pending:boolean)=><PortalQueryClientScope client={cache as any}><ManagedQuotes allowed={allowed} owner={owner} pending={pending}/></PortalQueryClientScope>;
 const view=renderIntoDocument(tree(false,a,true)),input=view.container.querySelector<HTMLInputElement>('#quote-search')!,table=view.container.querySelector('table'),head=table?.querySelector('thead'),body=table?.querySelector('tbody');
 expect(cache.getQueryData).not.toHaveBeenCalled();expect(input.disabled).toBe(false);expect(view.container.textContent).not.toContain('Q-1001');
 view.rerender(tree(true,a,true));const old=oldQuotePublish!;
 act(()=>{input.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'Q-1001');input.dispatchEvent(new Event('input',{bubbles:true}));});
 view.rerender(tree(true,a,false));expect(view.container.querySelector('#quote-search')).toBe(input);expect(view.container.querySelector('table')).toBe(table);expect(table?.querySelector('thead')).toBe(head);expect(table?.querySelector('tbody')).toBe(body);
 expect(input.value).toBe('Q-1001');expect(document.activeElement).toBe(input);expect(table?.textContent).toContain('Q-1001');
 view.rerender(tree(false,a,false));expect(table?.textContent).not.toContain('Q-1001');expect(view.container.querySelector('#quote-search')).toBe(input);
 view.rerender(tree(true,b,false));act(()=>old(null));expect(table?.textContent).toContain('Q-1001');expect(input.value).toBe('Q-1001');view.unmount();
});

describe('QuotesTab draft ownership UI', () => {
  beforeEach(() => {
    vi.mocked(buildOptimisticQuoteDetail).mockReset();
    vi.mocked(enqueueAndProcessLocalFirstMutation).mockReset();
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
    markQuoteVersionSuperseded.mockReset();
    useQueryMock.mockReset();
    activeQuoteDetail = quoteDetail;
    portalIsAdmin = true;
    searchParamsValue = 'quoteId=qv_1';
    activeQuoteList = [
      {
        id: 'qv_1', quoteId: 'qt_1', quoteRef: 'Q-1001', versionNumber: 1,
        status: 'DRAFT', sourceEstimateVersionLabel: 'V1', sourceEstimateVersionId: 'est_v1',
        sentAt: null, acceptedAt: null, expiresAt: null, createdAt: '2026-04-02T00:00:00Z',
        totals: { totalIncGstCents: 10000 }, pdfFileId: null, isCurrentDraft: true,
      },
    ];
    markQuoteVersionSuperseded.mockResolvedValue({
      ...quoteDetail,
      status: 'SUPERSEDED',
      isCurrentDraft: false,
    });

    const responses = [
      {
        data: activeQuoteList,
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
      const responseIndex = callIndex % responses.length;
      const response =
        responseIndex === 0
          ? { ...responses[responseIndex], data: activeQuoteList }
          : responseIndex === 3
          ? { ...responses[responseIndex], data: activeQuoteDetail }
          : responses[responseIndex];
      callIndex += 1;
      return response;
    });
  });


  it('shows an existing family name as shared text and submits the same optimistic name', async () => {
    searchParamsValue = '';
    const rendered = renderIntoDocument(<QuotesTab projectId="proj_1" />);
    const openCreate = Array.from(rendered.container.querySelectorAll('button')).find((button) => button.textContent === 'Create quote');
    act(() => openCreate!.click());
    expect(document.body.querySelector('input[placeholder="e.g. Front deck pergola"]')).not.toBeNull();
    activeQuoteList = [{ ...activeQuoteList[0], internalName: 'Main pergola' }];
    act(() => rendered.rerender(<QuotesTab projectId="proj_1" />));
    const modal = document.body.querySelector('[role="dialog"]')!;
    expect(modal.textContent).toContain('Main pergola');
    expect(modal.textContent).toContain('Shared by all versions. Use Rename');
    expect(modal.querySelector('input[placeholder="e.g. Front deck pergola"]')).toBeNull();
    getQueryData.mockImplementation((key: unknown[]) => key.includes('est_v2')
      ? { id: 'est_v2', internalName: 'Different estimate name', commercialScopeId: null }
      : undefined);
    vi.mocked(buildOptimisticQuoteDetail).mockReturnValue({ ...quoteDetail, internalName: 'Main pergola' } as any);
    const create = Array.from(modal.querySelectorAll('button')).find((button) => button.textContent === 'Create quote');
    await act(async () => create!.click());
    expect(buildOptimisticQuoteDetail).toHaveBeenCalledWith(expect.objectContaining({ internalName: 'Main pergola' }));
    expect(enqueueAndProcessLocalFirstMutation).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ internalName: 'Main pergola' }),
    }));
    rendered.unmount();
  });

  it('keeps the name editable for a new manual scope even when the estimate family is named', () => {
    searchParamsValue = '';
    activeQuoteList = [{ ...activeQuoteList[0], internalName: 'Existing family' }];
    const rendered = renderIntoDocument(<QuotesTab projectId="proj_1" />);
    const openCreate = Array.from(rendered.container.querySelectorAll('button')).find((button) => button.textContent === 'Create quote');
    act(() => openCreate!.click());
    const modal = document.body.querySelector('[role="dialog"]')!;
    expect(modal.querySelector('input[placeholder="e.g. Front deck pergola"]')).toBeNull();
    const manual = Array.from(modal.querySelectorAll('button')).find((button) => button.textContent === 'Manual quote');
    act(() => manual!.click());
    expect(modal.querySelector('input[placeholder="e.g. Front deck pergola"]')).not.toBeNull();
    expect(modal.textContent).not.toContain('Shared by all versions');
    rendered.unmount();
  });

  it('does not turn an accepted agreement into an expired quote', () => {
    activeQuoteDetail = { ...quoteDetail, status: 'ACCEPTED', expiresAt: '2020-01-01', acceptedAt: '2019-12-01T00:00:00Z' };
    activeQuoteList = [{ ...activeQuoteList[0], ...activeQuoteDetail }];
    const rendered = renderIntoDocument(<QuotesTab projectId="proj_1" selectedQuoteId="qv_1" />);
    expect(rendered.container.textContent).toContain('Accepted');
    expect(rendered.container.textContent).not.toContain('Expired on');
    expect(rendered.container.textContent).not.toContain('This quote has expired');
    rendered.unmount();
  });

  it('preserves closed accepted history without promoting delivery, resend or revision until deliberately reviewed', () => {
    activeQuoteDetail = { ...quoteDetail, status: 'ACCEPTED', expiresAt: '2020-01-01', acceptedAt: '2019-12-01T00:00:00Z' };
    activeQuoteList = [{ ...activeQuoteList[0], ...activeQuoteDetail }];
    const work = { effectiveState: 'CLOSED', closedOutcome: 'CANCELLED', stateRowVersion: 1 } as ProjectWorkProjection;
    const rendered = renderIntoDocument(<ProjectCommercialProvider projectId="proj_1" work={work} ready>
      <CommercialProjectNotice projectId="proj_1" view="quotes" /><QuotesTab projectId="proj_1" selectedQuoteId="qv_1" />
    </ProjectCommercialProvider>);
    expect(rendered.container.textContent).toContain('Accepted');
    expect(rendered.container.textContent).toContain('Review invoices & payments');
    expect(rendered.container.textContent).not.toContain('More actions');
    expect(rendered.container.textContent).not.toContain('Review & Send');
    expect(rendered.container.textContent).not.toContain('Expired on');
    act(() => [...rendered.container.querySelectorAll('button')].find((button) => button.textContent === 'Review commercial actions')!.click());
    expect(rendered.container.textContent).toContain('More actions');
    expect(markQuoteVersionSuperseded).not.toHaveBeenCalled();
    expect(enqueueAndProcessLocalFirstMutation).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it('explains both funded and initial acceptance before recording a decision', () => {
    activeQuoteDetail = { ...quoteDetail, status: 'SENT', expiresAt: null };
    const rendered = renderIntoDocument(<QuotesTab projectId="proj_1" selectedQuoteId="qv_1" />);
    expect(rendered.container.textContent).toContain('Acceptance locks this version.');
    expect(rendered.container.textContent).toContain('no invoice is created or emailed; create a custom progress invoice next');
    expect(rendered.container.textContent).toContain('Otherwise, the first scheduled invoice is prepared and email delivery is attempted.');
    expect(rendered.container.textContent).not.toContain('Acceptance locks this version, prepares its first');
    rendered.unmount();
  });

  it('retains the expiry warning for an unaccepted sent quote', () => {
    activeQuoteDetail = { ...quoteDetail, status: 'SENT', expiresAt: '2020-01-01' };
    activeQuoteList = [{ ...activeQuoteList[0], ...activeQuoteDetail }];
    const rendered = renderIntoDocument(<QuotesTab projectId="proj_1" selectedQuoteId="qv_1" />);
    expect(rendered.container.textContent).toContain('Expired on 2020-01-01');
    rendered.unmount();
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

  it('keeps historical acceptance discoverable without competing with the current agreement', () => {
    searchParamsValue = '';
    activeQuoteList = [
      {
        ...quoteDetail,
        id: 'qv_old', quoteId: 'qt_1', versionNumber: 1, status: 'ACCEPTED',
        acceptedAt: '2026-07-01T00:00:00Z', createdAt: '2026-07-01T00:00:00Z',
      },
      {
        ...quoteDetail,
        id: 'qv_current', quoteId: 'qt_1', versionNumber: 2, status: 'ACCEPTED',
        acceptedAt: '2026-08-01T00:00:00Z', createdAt: '2026-08-01T00:00:00Z',
      },
    ];
    const rendered = renderIntoDocument(<QuotesTab projectId="proj_1" selectedQuoteId={null} />);
    expect(rendered.container.querySelector('[data-quotes-view="list"]')).not.toBeNull();
    expect(rendered.container.textContent).not.toContain('Historical acceptance');
    const history = rendered.container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    act(() => history.click());
    expect(rendered.container.textContent).toContain('Historical acceptance');
    rendered.unmount();
  });

  it('opens a quote in Quotes when the previous commercial tab URL has not settled', () => {
    searchParamsValue = 'tab=invoices&campaign=winter';
    window.history.replaceState(null, '', `/staff/projects/proj_1?${searchParamsValue}`);
    const rendered = renderIntoDocument(<QuotesTab projectId="proj_1" selectedQuoteId={null} />);
    const row = rendered.container.querySelector<HTMLTableRowElement>('tr[aria-label="Open Q-1001, Q-1001 version 1"]');
    expect(row).not.toBeNull();
    act(() => row?.click());
    expect(window.location.search).toBe('?tab=quotes&campaign=winter&quoteId=qv_1');
    expect(replace).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it('returns to the quote list on the first Back to quotes click while the URL commit is pending', () => {
    window.history.replaceState(null, '', '/staff/projects/proj_1?tab=quotes&quoteId=qv_1');
    const rendered = renderIntoDocument(<QuotesTab projectId="proj_1" selectedQuoteId="qv_1" />);
    const back = Array.from(rendered.container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('Back to quotes'));

    act(() => back?.click());

    expect(rendered.container.querySelector('[data-quotes-view="list"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-quotes-view="detail"]')).toBeNull();
    expect(window.location.search).toBe('?tab=quotes');
    expect(replace).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it('shows draft deletion only to admins', () => {
    const admin = renderIntoDocument(<QuotesTab projectId="proj_1" selectedQuoteId="qv_1" />);
    const adminMore = Array.from(admin.container.querySelectorAll('button')).find((button) => button.textContent?.includes('More actions'));
    act(() => adminMore?.click());
    expect(admin.container.textContent).toContain('Delete draft');
    admin.unmount();

    portalIsAdmin = false;
    const staff = renderIntoDocument(<QuotesTab projectId="proj_1" selectedQuoteId="qv_1" />);
    const staffMore = Array.from(staff.container.querySelectorAll('button')).find((button) => button.textContent?.includes('More actions'));
    act(() => staffMore?.click());
    expect(staff.container.textContent).not.toContain('Delete draft');
    staff.unmount();
  });

  it('lets an admin immediately mark a sent or accepted quote superseded', async () => {
    activeQuoteDetail = {
      ...quoteDetail,
      status: 'ACCEPTED',
      isCurrentDraft: false,
      sentAt: '2026-07-28T00:00:00.000Z',
    };
    const rendered = renderIntoDocument(<QuotesTab projectId="proj_1" selectedQuoteId="qv_1" />);
    const more = Array.from(rendered.container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('More actions'),
    );
    act(() => more?.click());
    const supersede = Array.from(rendered.container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Mark superseded'),
    );

    expect(supersede).toBeDefined();
    await act(async () => supersede?.click());
    expect(markQuoteVersionSuperseded).toHaveBeenCalledWith('qv_1');
    expect(toastSuccess).toHaveBeenCalledWith('Q-1001 v1 marked superseded.');
    rendered.unmount();

    portalIsAdmin = false;
    const staff = renderIntoDocument(<QuotesTab projectId="proj_1" selectedQuoteId="qv_1" />);
    const staffMore = Array.from(staff.container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('More actions'),
    );
    act(() => staffMore?.click());
    expect(staff.container.textContent).not.toContain('Mark superseded');
    staff.unmount();
  });

  it('makes an unfinished frozen delivery the primary recovery action', () => {
    activeQuoteDetail = {
      ...quoteDetail,
      isCurrentDraft: false,
      deliveryPreparedAt: '2026-07-28T00:00:00.000Z',
      unfinishedDelivery: {
        mode: 'send',
        status: 'failed',
        canRetry: true,
      },
    };

    const rendered = renderIntoDocument(
      <QuotesTab projectId="proj_1" selectedQuoteId="qv_1" />,
    );

    expect(rendered.container.textContent).toContain(
      'Review prepared delivery',
    );
    expect(rendered.container.textContent).toContain(
      'Delivery prepared from this exact version',
    );
    expect(rendered.container.textContent).not.toContain('Review & Send');
    rendered.unmount();
  });

  it('keeps quote review available but blocks commercial actions before migration', () => {
    activeQuoteDetail = {
      ...quoteDetail,
      status: 'SENT',
      isCurrentDraft: false,
      sentAt: '2026-07-28T00:00:00.000Z',
      commercialWorkflowReady: false,
    };

    const rendered = renderIntoDocument(
      <QuotesTab projectId="proj_1" selectedQuoteId="qv_1" />,
    );

    expect(rendered.container.textContent).toContain('Quote details');
    expect(rendered.container.textContent).toContain(
      'Commercial actions are temporarily unavailable.',
    );
    expect(rendered.container.textContent).toContain(
      'This quote is available read-only',
    );
    const unavailableButton = Array.from(
      rendered.container.querySelectorAll('button'),
    ).find((button) =>
      button.textContent?.includes('Commercial actions unavailable'),
    );
    expect(unavailableButton?.hasAttribute('disabled')).toBe(true);
    const acceptButton = Array.from(
      rendered.container.querySelectorAll('button'),
    ).find((button) => button.textContent?.includes('Mark accepted'));
    expect(acceptButton?.hasAttribute('disabled')).toBe(true);
    rendered.unmount();
  });
 it('keeps real quote fields/line headers/return through pending, failure and ready without a zero-value or stale draft commit',async()=>{
  let phase:'pending'|'error'|'ready'|'empty'='pending',calls=0;const retry=vi.fn();useQueryMock.mockImplementation(()=>{const index=calls++%4;return index===3?{data:phase==='ready'?quoteDetail:phase==='empty'?{...quoteDetail,lineItems:[]}:null,isPending:phase==='pending',isError:phase==='error',error:phase==='error'?new Error('Read failed'):null,refetch:retry}:{data:[],isPending:false,error:null};});
  const commits:string[]=[];const element=()=> <Profiler id="quote-owner" onRender={()=>commits.push([...document.querySelectorAll('[class*="totalValue"]')].map(node=>node.textContent).join('|'))}><QuotesTab projectId="proj_1"/></Profiler>;const view=renderIntoDocument(element());const back=[...view.container.querySelectorAll('button')].find(b=>b.textContent?.includes('Back to quotes'))!,lineTable=view.container.querySelector('table')!;expect(view.container.textContent).toContain('Customer on this quote');expect(lineTable.textContent).toContain('Description');expect(lineTable.textContent).not.toContain('No line items.');expect(view.container.textContent).not.toContain('Taylor');expect(view.container.textContent).not.toContain('$0.00');expect(view.container.textContent).not.toContain('database upgrade');
  phase='error';view.rerender(element());expect(lineTable.textContent).toContain('Line items unavailable.');expect(lineTable.textContent).not.toContain('No line items.');expect(view.container.querySelector('table')).toBe(lineTable);await act(async()=>[...view.container.querySelectorAll('button')].find(b=>b.textContent==='Retry quote')!.click());expect(retry).toHaveBeenCalledOnce();phase='ready';view.rerender(element());expect(view.container.querySelector('table')).toBe(lineTable);expect([...view.container.querySelectorAll('button')].find(b=>b.textContent?.includes('Back to quotes'))).toBe(back);expect(view.container.textContent).toContain('Taylor');expect(view.container.textContent).toContain('$100.00');expect(commits.join('|')).not.toContain('$0.00');view.unmount();phase='pending';const emptyView=renderIntoDocument(element());const emptyTable=emptyView.container.querySelector('table')!;phase='empty';emptyView.rerender(element());expect(emptyView.container.querySelector('table')).toBe(emptyTable);expect(emptyTable.textContent).toContain('No line items.');expect(emptyTable.textContent).not.toContain('unavailable');emptyView.unmount();
 });

  it('preserves URL create intent without creating before current project authority is ready', async () => {
    searchParamsValue = 'createFromEstimateId=est_v2';
    getQueryData.mockReturnValue({ id: 'est_v2', projectId: 'proj_1', commercialScopeId: null });
    vi.mocked(buildOptimisticQuoteDetail).mockReturnValue(quoteDetail as any);
    const element = (ready: boolean) => <ProjectCommercialProvider projectId="proj_1" ready={ready}><QuotesTab projectId="proj_1" /></ProjectCommercialProvider>;
    const view = renderIntoDocument(element(false));
    const table = view.container.querySelector('table');
    expect(table).not.toBeNull();
    expect(buildOptimisticQuoteDetail).not.toHaveBeenCalled();
    expect(enqueueAndProcessLocalFirstMutation).not.toHaveBeenCalled();
    expect(fetchQuery).not.toHaveBeenCalled();
    await act(async () => view.rerender(element(true)));
    expect(enqueueAndProcessLocalFirstMutation).toHaveBeenCalledOnce();
    view.unmount();
  });

  it('does not create after an estimate read outlives current project authority', async () => {
    searchParamsValue = 'createFromEstimateId=est_v2';
    let resolve!: (value: unknown) => void;
    fetchQuery.mockImplementationOnce(() => new Promise((accept) => { resolve = accept; }));
    const element = (ready: boolean) => <ProjectCommercialProvider projectId="proj_1" ready={ready}><QuotesTab projectId="proj_1" /></ProjectCommercialProvider>;
    const view = renderIntoDocument(element(true));
    expect(fetchQuery).toHaveBeenCalledOnce();
    view.rerender(element(false));
    await act(async () => resolve({ id: 'est_v2', projectId: 'proj_1', commercialScopeId: null }));
    expect(buildOptimisticQuoteDetail).not.toHaveBeenCalled();
    expect(enqueueAndProcessLocalFirstMutation).not.toHaveBeenCalled();
    view.unmount();
  });

});
