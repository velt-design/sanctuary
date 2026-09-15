import { beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
const mocks = vi.hoisted(() => ({ session: vi.fn(), review: vi.fn() }));
vi.mock('./pilotAccess', () => ({ getPaymentPilotSession: mocks.session }));
vi.mock('../invoices/financeReviewRepository', () => ({ loadFinanceReview: mocks.review }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
import Page from '../../app/staff/payments/page';
beforeEach(() => vi.resetAllMocks());
it('denies access before loading finance information', async () => {
  mocks.session.mockResolvedValue(null);
  await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow('NOT_FOUND');
  expect(mocks.review).not.toHaveBeenCalled();
});
it('renders unavailable separately from an empty queue and hides diagnostics', async () => {
  mocks.session.mockResolvedValue({ user: { id: 'ellen' } });
  mocks.review.mockRejectedValue(new Error('private-query-detail'));
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(html).toContain('Finance could not be loaded');
  expect(html).toContain('data-state="error"');
  expect(html).not.toContain('No invoices need attention'); expect(html).not.toContain('private-query-detail');
});
it('shows partial balance and transfer freshness without claiming a live Xero check', async () => {
  mocks.session.mockResolvedValue({ user: { id: 'ellen' } });
  mocks.review.mockResolvedValue({ checkedAt: '2026-09-14T00:00:00Z', hasMore: false, rows: [{
    invoiceId: 'invoice', invoiceRef: 'INV-TEST', projectId: 'project', customerName: 'Example', projectName: 'Example project',
    status: 'OPEN', currency: 'NZD', dueDate: '2026-09-21', totalCents: 1000, recordedCents: 400,
    xeroInvoiceId: null, lastVerifiedAt: null, transferStatus: 'queued', transferError: null, captured: true, correctionRequired: false,
  }] });
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ search: 'Example' }) }));
  expect(html).toContain('$6.00'); expect(html).toContain('Waiting for Xero transfer');
  expect(html).toContain('Each linked invoice shows when Xero was last checked');
  expect(mocks.review).toHaveBeenCalledWith('ellen', 'Example', 0, 'attention');
});
