import { beforeEach, expect, it, vi } from 'vitest';
import { renderToReadableStream } from 'react-dom/server.edge';
const mocks = vi.hoisted(() => ({ session: vi.fn(), review: vi.fn() }));
vi.mock('./pilotAccess', () => ({ getPaymentPilotSession: mocks.session }));
vi.mock('../invoices/financeReviewRepository', () => ({ loadFinanceReview: mocks.review }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
import Page from '../../app/staff/payments/page';
beforeEach(() => vi.resetAllMocks());
async function renderPage(query: { search?: string } = {}) {
  const stream = await renderToReadableStream(await Page({ searchParams: Promise.resolve(query) }));
  await stream.allReady;
  return new Response(stream).text();
}
it('denies access before loading finance information', async () => {
  mocks.session.mockResolvedValue(null);
  await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow('NOT_FOUND');
  expect(mocks.review).not.toHaveBeenCalled();
});
it('renders unavailable separately from an empty queue and hides diagnostics', async () => {
  mocks.session.mockResolvedValue({ user: { id: 'ellen' } });
  mocks.review.mockRejectedValue(new Error('private-query-detail'));
  const html = await renderPage();
  expect(html).toContain('Finance could not be loaded');
  expect(html).toContain('data-state="error"');
  expect(html).not.toContain('No invoices need attention'); expect(html).not.toContain('private-query-detail');
  expect(mocks.review).toHaveBeenCalledExactlyOnceWith('ellen', '', 0, 'attention');
});
it('shows partial balance and transfer freshness without claiming a live Xero check', async () => {
  mocks.session.mockResolvedValue({ user: { id: 'ellen' } });
  mocks.review.mockResolvedValue({ checkedAt: '2026-09-14T00:00:00Z', hasMore: false, rows: [{
    invoiceId: 'invoice', invoiceRef: 'INV-TEST', projectId: 'project', customerName: 'Example', projectName: 'Example project',
    status: 'OPEN', currency: 'NZD', dueDate: '2026-09-21', totalCents: 1000, recordedCents: 400,
    xeroInvoiceId: null, lastVerifiedAt: null, transferStatus: 'queued', transferError: null, captured: true, correctionRequired: false,
  }] });
  const html = await renderPage({ search: 'Example' });
  expect(html).toContain('$6.00'); expect(html).toContain('Waiting for Xero transfer');
  expect(html).toContain('Each linked invoice shows when Xero was last checked');
  expect(mocks.review).toHaveBeenCalledExactlyOnceWith('ellen', 'Example', 0, 'attention');
});

it('streams the actual controls and table before the one read, then distinguishes confirmed empty records', async () => {
  mocks.session.mockResolvedValue({ user: { id: 'ellen' } });
  let finish!: (value: unknown) => void;
  mocks.review.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  const stream = await renderToReadableStream(await Page({ searchParams: Promise.resolve({}) }));
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let initial = '';
  // HTTP chunks need not coincide with the complete pending interface.
  for (let chunks = 0; chunks < 20 && !initial.includes('Reading verified invoices'); chunks += 1) {
    const part = await reader.read();
    if (part.done) break;
    initial += decoder.decode(part.value, { stream: true });
  }
  expect(initial).toContain('Finance review');
  expect(initial).toContain('Finance views');
  expect(initial).toContain('Invoice / customer');
  expect(initial).toContain('Reading verified invoices');
  expect(initial).not.toContain('No invoices need attention');
  expect(mocks.review).toHaveBeenCalledExactlyOnceWith('ellen', '', 0, 'attention');
  finish({ checkedAt: '2026-09-14T00:00:00Z', hasMore: false, rows: [] });
  let settled = initial;
  for (;;) { const part = await reader.read(); if (part.done) break; settled += decoder.decode(part.value, { stream: true }); }
  expect(settled).toContain('No invoices need attention');
  expect(settled).toContain('Portal records checked');
  expect(mocks.review).toHaveBeenCalledOnce();
});
