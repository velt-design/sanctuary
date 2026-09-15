import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ context: vi.fn() }));
vi.mock('@/lib/xero/pilotAccess', () => ({ getPaymentPilotSession: async () => ({ user: { id: 'owner' } }) }));
vi.mock('@/lib/invoices/financeMappingRepository', () => ({ financeMappingContext: mocks.context }));
vi.mock('./MappingReview', () => ({ default: ({ initialContext }: { initialContext: { invoiceRef: string } }) => <div>Review {initialContext.invoiceRef}</div> }));
import MappingPage from './page';
const invoice = '11111111-1111-4111-8111-111111111111';
it('supplies verified invoice context before the Xero client check starts', async () => {
  mocks.context.mockResolvedValue({ invoiceRef: 'INV-TEST' });
  const html = renderToStaticMarkup(await MappingPage({ searchParams: Promise.resolve({ invoice }) }));
  expect(mocks.context).toHaveBeenCalledWith('owner', invoice);
  expect(html).toContain('Review INV-TEST');
});
it('does not render mapping commands when invoice context cannot be verified', async () => {
  mocks.context.mockRejectedValue(new Error('unavailable'));
  const html = renderToStaticMarkup(await MappingPage({ searchParams: Promise.resolve({ invoice }) }));
  expect(html).toContain('Invoice details could not be loaded');
  expect(html).toContain('Try again');
  expect(html).not.toContain('Review INV-TEST');
});
