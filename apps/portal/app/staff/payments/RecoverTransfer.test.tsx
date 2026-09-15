import { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import RecoverTransfer from './RecoverTransfer';
const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
let view: ReturnType<typeof renderIntoDocument> | undefined;
afterEach(() => { view?.unmount(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('requires confirmation, sends only invoice identity, and refreshes after verified recovery', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ state: 'recovered' })); vi.stubGlobal('fetch', fetcher);
  view = renderIntoDocument(<RecoverTransfer invoiceId="invoice" />);
  const button = view.container.querySelector('button')!;
  expect(button.disabled).toBe(true);
  await act(async () => view!.container.querySelector<HTMLInputElement>('input')!.click());
  await act(async () => button.click());
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ invoiceId: 'invoice', confirmed: true });
  expect(view.container.textContent).toContain('Nothing was resent'); expect(mocks.refresh).toHaveBeenCalledOnce();
});
it('keeps an uncertain response retryable without claiming success', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection interrupted')));
  view = renderIntoDocument(<RecoverTransfer invoiceId="invoice" />);
  await act(async () => view!.container.querySelector<HTMLInputElement>('input')!.click());
  await act(async () => view!.container.querySelector('button')!.click());
  expect(view.container.textContent).toContain('Connection interrupted'); expect(mocks.refresh).not.toHaveBeenCalled();
  expect(view.container.querySelector('button')!.disabled).toBe(false);
});
