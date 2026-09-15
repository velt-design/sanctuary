import { act } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import InvoicePayments from './InvoicePayments';
vi.mock('./PaymentHistory', () => ({ default: () => <div>Payment history</div> }));
let view: ReturnType<typeof renderIntoDocument> | undefined;
const id = '11111111-1111-4111-8111-111111111111';
const result = { invoice: { invoiceRef: 'INV-TEST', customerName: 'Customer', totalIncGstCents: 11500 }, checkedAt: '2026-09-14T00:00:00Z',
  suggestions: [{ payment: { id, contact: 'Customer', reference: '', date: '2026-09-14' }, amountCents: 4000, remainingIfApprovedCents: 7500, blockers: [], approvalToken: 'exact-token', approvalId: id }] };
const button = (label: string) => [...view!.container.querySelectorAll('button')].find(item => item.textContent === label)!;
beforeEach(() => sessionStorage.clear());
afterEach(() => { view?.unmount(); vi.unstubAllGlobals(); });
async function review() { await act(async () => button('Refresh payment review').click()); }
async function approve() {
  await act(async () => view!.container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  await act(async () => button('Approve payment').click());
}
it('requires explicit confirmation and submits only the reviewed envelope', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(result)).mockResolvedValueOnce(Response.json({ matchId: id }));
  vi.stubGlobal('fetch', fetcher); view = renderIntoDocument(<InvoicePayments invoiceId={id} />); await review();
  expect(button('Approve payment').disabled).toBe(true); await approve();
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ action: 'approve', confirmed: true, approvalToken: 'exact-token' });
  expect(view.container.textContent).toContain('Payment recorded.'); expect(sessionStorage.length).toBe(0);
});
it('recovers a lost response after reload by status, without repeating approval', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(result)).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(Response.json({ match: { reversedAt: null } }));
  vi.stubGlobal('fetch', fetcher); view = renderIntoDocument(<InvoicePayments invoiceId={id} />); await review(); await approve();
  expect(sessionStorage.getItem(`sanctuary.invoice-payment.pending:${id}`)).toBe(id);
  view.unmount(); view = renderIntoDocument(<InvoicePayments invoiceId={id} />);
  expect(button('Refresh payment review').disabled).toBe(true);
  await act(async () => button('Check approval status').click());
  expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual({ action: 'status', approvalId: id });
  expect(view.container.textContent).toContain('Payment was recorded successfully'); expect(sessionStorage.length).toBe(0);
});
it('shows the before and after balance and the scope of approval', async () => {
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json(result)));
 view=renderIntoDocument(<InvoicePayments invoiceId={id} />); await review();
 expect(view.container.textContent).toContain('Still owing now');
 expect(view.container.textContent).toContain('$115.00');
 expect(view.container.textContent).toContain('Still owing after approval');
 expect(view.container.textContent).toContain('$75.00');
 expect(view.container.textContent).toContain('does not move money, change Xero or email');
});
it('does not offer duplicate approval and keeps other investigation reasons visible', async () => {
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({...result,suggestions:[{...result.suggestions[0],alreadyRecorded:true,blockers:['This payment is already recorded in the portal.','Check changed Xero evidence.']}]})));
 view=renderIntoDocument(<InvoicePayments invoiceId={id} />); await review();
 expect(view.container.textContent).toContain('Already recorded');
 expect(view.container.textContent).toContain('Check changed Xero evidence.');
 expect(button('Approve payment')).toBeUndefined();
});
