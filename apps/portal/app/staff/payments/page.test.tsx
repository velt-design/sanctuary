import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
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
afterEach(() => vi.unstubAllEnvs());
async function page(row: FinanceInvoice, view = 'attention') {
  mocks.load.mockResolvedValue({ rows: [row], checkedAt: '2026-09-15T00:00:00Z', hasMore: false });
  return renderToStaticMarkup(await FinancePage({ searchParams: Promise.resolve({ view }) }));
}
it('keeps historical invoices visible without presenting customer mapping as required work', async () => {
  const html = await page(invoice, 'history');
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
it('puts the payment decision before optional Xero checks', async () => {
  vi.stubEnv('XERO_INVOICE_PAYMENTS_ENABLED', 'true');
  const html = await page({ ...invoice, captured: true, xeroInvoiceId: 'xero', observation: { invoiceId: 'xero', state: 'payment_recorded', amountPaidCents: 4000, reason: '', checkedAt: new Date().toISOString() } });
  const primaryContent = html.split('<details>')[0];
  expect(primaryContent).toContain('Review invoice payments');
  expect(primaryContent).toContain('balance before and after approval');
  expect(primaryContent).not.toContain('>Open in Xero</a>');
});
it('prioritises existing receipt problems over importing a new payment', async () => {
  vi.stubEnv('XERO_INVOICE_PAYMENTS_ENABLED', 'true');
  const html = await page({ ...invoice, unassignedReceipts: true, xeroInvoiceId: 'xero', observation: { invoiceId: 'xero', state: 'payment_recorded', amountPaidCents: 4000, reason: '', checkedAt: new Date().toISOString() } });
  expect(html.split('<details>')[0]).toContain('Review project payments');
  expect(html.split('<details>')[0]).not.toContain('Review invoice payments');
});
it('gives the draft one primary next step and explains approval without email', async () => {
  const html = await page({ ...invoice, captured: true, xeroInvoiceId: 'xero' });
  expect(html).toContain('Review draft in Xero');
  expect(html).toContain('Check the customer, amount and GST');
  expect(html).toContain('Do not choose Approve &amp; email');
  expect(html).toContain('<details><summary>Checks and other options');
});
it('explains a stopped transfer without asking the owner to issue another invoice', async () => {
  const html = await page({ ...invoice, captured: true, transferStatus: 'permanent_failed', transferError: 'UNKNOWN' });
  expect(html).toContain('A developer needs to investigate');
  expect(html).toContain('Do not issue another invoice');
});
it('defaults to server-filtered attention and keeps the selected view through search and pagination', async () => {
  mocks.load.mockResolvedValue({ rows: [], checkedAt: '2026-09-15T00:00:00Z', hasMore: true });
  const html = renderToStaticMarkup(await FinancePage({ searchParams: Promise.resolve({ search: 'Example', offset: '50', view: 'history' }) }));
  expect(mocks.load).toHaveBeenCalledWith('owner', 'Example', 50, 'history');
  expect(html).toContain('offset=100&amp;view=history');
  expect(html).toContain('No matching invoices in this view');
  expect(html).not.toContain('No invoices need attention');
});
it('shows a truthful attention empty state and treats load failures separately', async () => {
  mocks.load.mockResolvedValue({ rows: [], checkedAt: '2026-09-15T00:00:00Z', hasMore: false });
  expect(renderToStaticMarkup(await FinancePage({ searchParams: Promise.resolve({}) }))).toContain('No invoices need attention');
  expect(mocks.load).toHaveBeenCalledWith('owner', '', 0, 'attention');
  mocks.load.mockRejectedValue(new Error('unavailable'));
  const html = renderToStaticMarkup(await FinancePage({ searchParams: Promise.resolve({}) }));
  expect(html).toContain('Finance could not be loaded');
  expect(html).not.toContain('No invoices need attention');
});

it('does not ask for draft approval when the frozen transfer was approved',async()=>{
  const html=await page({...invoice,captured:true,xeroInvoiceId:'xero',transferTargetStatus:'AUTHORISED'});
  expect(html).not.toContain('Review draft in Xero');expect(html).toContain('waiting for its next check');
});
it('makes an automatic payment exception actionable',async()=>{
  vi.stubEnv('XERO_AUTOMATIC_PAYMENTS_ENABLED','true');vi.stubEnv('XERO_INVOICE_PAYMENTS_ENABLED','true');
  const html=await page({...invoice,captured:true,xeroInvoiceId:'xero',transferTargetStatus:'AUTHORISED',paymentSync:{state:'review',reason:'CHECK',checkedAt:new Date().toISOString()}});
  expect(html).toContain('Only deal with the exceptions');expect(html).toContain('Payment needs a finance check');expect(html).toContain('Review invoice payments');
});
