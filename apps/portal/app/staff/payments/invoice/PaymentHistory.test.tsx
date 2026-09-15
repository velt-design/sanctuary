import { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import PaymentHistory from './PaymentHistory';
let view: ReturnType<typeof renderIntoDocument> | undefined;
const id = '11111111-1111-4111-8111-111111111111';
const history = { invoice: { id, projectId: id, invoiceRef: 'INV-TEST', status: 'OPEN' }, recordedCents: 4000, hasMore: false,
  hasUnmatchedPaymentHistory: false, matches: [{ id, sourceKind: 'INVOICE_PAYMENT', amountCents: 4000, receiptDate: '2026-09-14',
    approvedAt: '2026-09-14T00:00:00Z', approvedBy: 'finance@example.test', reversedAt: null, reference: 'Deposit' }] };
const button = (text: string) => [...view!.container.querySelectorAll('button')].find(item => item.textContent === text)!;
afterEach(() => { view?.unmount(); vi.unstubAllGlobals(); });
async function mount(onCorrection = vi.fn()) { await act(async () => { view = renderIntoDocument(<PaymentHistory invoiceId={id} refreshKey={0} disabled={false} onCorrection={onCorrection} />); }); }
it('shows recorded and reversed payments with their finance audit evidence', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ ...history, recordedCents: 0, matches: [{ ...history.matches[0],
    reversedAt: '2026-09-15T00:00:00Z', reversedBy: 'owner@example.test', reversalReason: 'Wrong project' }] }));
  vi.stubGlobal('fetch', fetcher); await mount();
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ action: 'history', invoiceId: id, offset: 0 });
  expect(view!.container.textContent).toContain('finance@example.test'); expect(view!.container.textContent).toContain('Wrong project');
  expect(button('Correct this match')).toBeUndefined();
});
it('requires a reason and explicit confirmation before reversing a portal match', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(history)).mockResolvedValueOnce(Response.json({ reversed: true })).mockResolvedValue(Response.json({ ...history, matches: [] }));
  vi.stubGlobal('fetch', fetcher); const corrected = vi.fn(); await mount(corrected);
  await act(async () => button('Correct this match').click()); expect(button('Reverse portal match').disabled).toBe(true);
  await act(async () => {
    const textarea = view!.container.querySelector('textarea')!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Wrong invoice');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    view!.container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
  });
  await act(async () => button('Reverse portal match').click());
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ action: 'reverse', invoiceId: id, matchId: id, confirmed: true, reason: 'Wrong invoice' });
  expect(corrected).toHaveBeenCalledOnce();
});
it('shows a history failure rather than claiming no payments exist', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline'))); await mount();
  expect(view!.container.textContent).toContain('Payment history could not be loaded');
  expect(view!.container.textContent).not.toContain('No Xero matches');
});
it('distinguishes automatic recording from a staff approval', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ...history, matches: [{ ...history.matches[0], recordingMethod: 'AUTOMATIC', approvedBy: 'Automatic Xero sync' }] })));
  await mount(); expect(view!.container.textContent).toContain('Recorded automatically from Xero');
  expect(view!.container.textContent).not.toContain('Approved by');
});
