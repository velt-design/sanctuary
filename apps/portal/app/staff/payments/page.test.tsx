import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import type { FinanceInvoice } from '@/lib/xero/financeReview';
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/lib/xero/pilotAccess', () => ({ getPaymentPilotSession: async () => ({ user: { id: 'owner' } }) }));
vi.mock('@/lib/invoices/financeReviewRepository', () => ({ loadFinanceReview: mocks.load }));
vi.mock('./CheckXero', () => ({ default: () => null }));
vi.mock('./RecoverTransfer', () => ({ default: () => null }));
import FinancePage from './page';

const invoice: FinanceInvoice = { invoiceId: 'invoice', invoiceRef: 'INV-0014', projectId: 'project', customerName: 'Example',
  projectName: 'Example project', status: 'OPEN', currency: 'NZD', dueDate: null, totalCents: 10000, recordedCents: 0,
  xeroInvoiceId: null, lastVerifiedAt: null, transferStatus: null, transferError: null, captured: false,
  correctionRequired: false, unassignedReceipts: false, observation: null };
beforeEach(() => vi.clearAllMocks());
async function page(row: FinanceInvoice) {
  mocks.load.mockResolvedValue({ rows: [row], checkedAt: '2026-09-15T00:00:00Z', hasMore: false });
  return renderToStaticMarkup(await FinancePage({ searchParams: Promise.resolve({}) }));
}
it('keeps historical invoices visible without presenting customer mapping as required work', async () => {
  const html = await page(invoice);
  expect(html).toContain('INV-0014');
  expect(html).toContain('Older invoices remain here for reference');
  expect(html).not.toContain('/staff/payments/mapping?');
});
it('sends an unassigned receipt issue to the project payment surface rather than customer matching', async () => {
  const html = await page({ ...invoice, unassignedReceipts: true, captured: true });
  expect(html).toContain('Review project payments');
  expect(html).toContain('/staff/projects/project?tab=invoices');
  expect(html).not.toContain('/staff/payments/mapping?');
});
it('preserves customer matching for a captured unbound invoice', async () => {
  expect(await page({ ...invoice, captured: true, transferStatus: 'needs_attention' })).toContain('/staff/payments/mapping?invoice=invoice');
});
it('does not ask to rematch an invoice already linked to Xero', async () => {
  expect(await page({ ...invoice, captured: true, xeroInvoiceId: 'xero' })).not.toContain('/staff/payments/mapping?');
});
