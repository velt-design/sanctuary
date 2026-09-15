import { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import MappingReview from './MappingReview';
const id = '11111111-1111-4111-8111-111111111111';
const review = { context: { sourceContactId: id, invoiceRef: 'INV-TEST', customerName: 'Example' }, contacts: [],
  accounts: [], taxes: [], limited: false, checkedAt: '2026-09-14T00:00:00Z', customerCreationEnabled: true };
let view: ReturnType<typeof renderIntoDocument> | undefined;
afterEach(() => { view?.unmount(); vi.unstubAllGlobals(); });
const button = (label: string) => [...view!.container.querySelectorAll('button')].find(item => item.textContent === label);
async function inspect() { await act(async () => button('Check Xero records')!.click()); }
it('exposes customer creation only when enabled and the lookup has no customer candidates', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ...review, customerCreationEnabled: false })));
  view = renderIntoDocument(<MappingReview invoiceId={id} />); await inspect();
  expect(button('Create Xero customer')).toBeUndefined();
});
it('requires confirmation, then offers the verified new customer for account/tax mapping', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(review))
    .mockResolvedValueOnce(Response.json({ contact: { id, name: 'Example', email: '' } }));
  vi.stubGlobal('fetch', fetcher); view = renderIntoDocument(<MappingReview invoiceId={id} />); await inspect();
  const form = button('Create Xero customer')!.closest('form')!;
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () => form.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(fetcher.mock.calls[1][0]).toBe('/api/payments/xero/customers');
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ invoiceId: id, sourceContactId: id, name: 'Example', confirmed: true });
  expect(view.container.querySelector('select[name="contactId"]')!.textContent).toContain('Example');
  expect(view.container.textContent).toContain('Xero customer verified');
  expect(button('Create Xero customer')).toBeUndefined();
});
it('keeps the same reviewed name after a lost response so retry uses the durable intent', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(review)).mockRejectedValueOnce(new Error('Connection interrupted'))
    .mockResolvedValueOnce(Response.json({ contact: { id, name: 'Example', email: '' } }));
  vi.stubGlobal('fetch', fetcher); view = renderIntoDocument(<MappingReview invoiceId={id} />); await inspect();
  const form = button('Create Xero customer')!.closest('form')!;
  await act(async () => form.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(view.container.textContent).toContain('Connection interrupted');
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(fetcher.mock.calls[2][1].body).toBe(fetcher.mock.calls[1][1].body);
});
