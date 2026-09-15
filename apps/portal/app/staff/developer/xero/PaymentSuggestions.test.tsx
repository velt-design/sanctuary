import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import PaymentSuggestions from './PaymentSuggestions';
let view: ReturnType<typeof renderIntoDocument> | undefined;
afterEach(() => { view?.unmount(); vi.unstubAllGlobals(); });
const result = {
  invoice: { invoiceRef: 'INV-0001', projectId: 'proj-1', projectName: 'Example project', status: 'OPEN', totalIncGstCents: 10000 },
  checkedAt: '2026-09-14T06:00:00Z', note: 'Review only. Nothing changed.', limited: false,
  suggestions: [{ receipt: { id: 'receipt-1', contact: 'Example Customer', date: '2026-09-01', status: 'AUTHORISED', reconciled: true, currency: 'NZD', reference: '' }, amountCents: 100, reasons: ['Partial deposit'], blockers: [], depositRemainingIfApprovedCents: 9900 }],
};
async function submit() {
  const input = view!.container.querySelector<HTMLInputElement>('[name="invoiceRef"]')!;
  input.value = 'INV-0001';
  await act(async () => { view!.container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
}
describe('deposit review screen', () => {
  it('shows conditional outcomes with no payment approval or mutation control', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(result)); vi.stubGlobal('fetch', fetcher);
    view = renderIntoDocument(<PaymentSuggestions />); await submit();
    expect(view.container.textContent).toContain('remaining requested deposit $99.00');
    expect(view.container.textContent).toContain('Portal invoice: OPEN');
    expect(view.container.querySelectorAll('button')).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe('/api/integrations/xero/payment-suggestions');
  });
  it('clears stale results on another search and reports failure rather than absence of payment', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(result)).mockResolvedValueOnce(Response.json({ error: 'Read unavailable. Nothing changed.' }, { status: 503 }));
    vi.stubGlobal('fetch', fetcher); view = renderIntoDocument(<PaymentSuggestions />);
    await submit(); expect(view.container.textContent).toContain('If confirmed as');
    await submit(); expect(view.container.querySelector('[role="alert"]')?.textContent).toContain('Read unavailable');
    expect(view.container.textContent).not.toContain('If confirmed as');
  });
});
