import { act } from 'react';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuoteVersionDetail } from '@/lib/quotes/types';
import { useQuoteLifecycleActions } from './useQuoteLifecycleActions';

const h = vi.hoisted(() => ({
  accept: vi.fn(), invalidate: vi.fn(), setData: vi.fn(), success: vi.fn(), error: vi.fn(), refresh: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: h.invalidate, setQueryData: h.setData }) }));
vi.mock('@/components/ui/toast/ToastProvider', () => ({ useToast: () => ({ success: h.success, error: h.error }) }));
vi.mock('@/lib/localFirst/portalEntities', () => ({ isLocalQuoteId: () => false, upsertQuoteDetailCache: vi.fn() }));
vi.mock('@/lib/queries/projectCache', () => ({ invalidateProjectReadCaches: vi.fn() }));
vi.mock('@/lib/repo/jobPacksRepo', () => ({ generateJobPack: vi.fn() }));
vi.mock('@/lib/quotes/quotesRepo', () => ({ markQuoteAccepted: h.accept, markQuoteDeclined: vi.fn(), createQuoteClientIntentId: vi.fn(), previewDraftQuoteRefreshFromEstimate: vi.fn(), refreshDraftQuoteFromEstimate: vi.fn(), reviseQuote: vi.fn() }));

let mounted: ReturnType<typeof renderIntoDocument> | undefined;
function renderHook(callback: () => ReturnType<typeof useQuoteLifecycleActions>) {
  const result = { current: undefined! as ReturnType<typeof useQuoteLifecycleActions> };
  function Harness() { result.current = callback(); return null; }
  mounted = renderIntoDocument(<Harness />);
  return { result };
}
afterEach(() => { mounted?.unmount(); });

const detail = { id: 'qv-synthetic', status: 'SENT' } as QuoteVersionDetail;
function input(): Parameters<typeof useQuoteLifecycleActions>[0] {
  return { projectId: 'proj-synthetic', hostKey: 'synthetic-host', detail, draftSyncPending: false, refreshEstimateTarget: null,
    refreshUsesLatestDesign: false, refreshQuotes: h.refresh, selectQuote: vi.fn(), openSendModal: vi.fn(), resetDraftFormFromDetail: vi.fn(),
    setMoreActionsOpen: vi.fn(), pendingResendId: null, setPendingResendId: vi.fn(), setExpiredPromptOpen: vi.fn(), refreshConfirmOpen: false,
    setRefreshConfirmOpen: vi.fn(), refreshMode: 'pricing_only', setRefreshMode: vi.fn(), setRefreshPreview: vi.fn(), setRefreshPreviewLoading: vi.fn(),
    setRefreshPreviewError: vi.fn(), refreshBusy: false, setRefreshBusy: vi.fn(), jobPackBusy: false, setJobPackBusy: vi.fn() };
}
describe('ordinary staff quote acceptance action', () => {
  beforeEach(() => { vi.clearAllMocks(); h.invalidate.mockResolvedValue(undefined); h.refresh.mockResolvedValue(undefined); });
  it('accepts a funded revision, updates quote/invoice/Overview schedule caches, and directs staff to progress billing', async () => {
    const accepted = { ...detail, status: 'ACCEPTED' };
    h.accept.mockResolvedValue({ quoteVersion: accepted, invoice: null });
    const hook = renderHook(() => useQuoteLifecycleActions(input()));
    await act(() => hook.result.current.accept());
    expect(h.accept).toHaveBeenCalledWith(detail.id);
    expect(h.setData).toHaveBeenCalledWith(['quotes', 'synthetic-host', 'detail', detail.id], accepted);
    expect(h.invalidate).toHaveBeenCalledWith({ queryKey: ['invoices', 'synthetic-host', 'byProject', 'proj-synthetic'] });
    expect(h.invalidate).toHaveBeenCalledWith({ queryKey: ['invoices', 'synthetic-host', 'scheduleByProject', 'proj-synthetic'] });
    expect(h.success).toHaveBeenCalledWith('Quote accepted. Existing payments retained; create your progress invoice in Invoices.');
    expect(h.error).not.toHaveBeenCalled();
    expect(hook.result.current.acceptBusy).toBe(false);
  });
  it('prevents overlapping acceptance requests', async () => {
    let finish!: (value: unknown) => void;
    h.accept.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const hook = renderHook(() => useQuoteLifecycleActions(input()));
    await act(async () => {
      const first = hook.result.current.accept();
      await hook.result.current.accept();
      finish({ quoteVersion: { ...detail, status: 'ACCEPTED' }, invoice: null });
      await first;
    });
    expect(h.accept).toHaveBeenCalledOnce();
  });
});
