import { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import Page from './page';
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NEXT_NOT_FOUND'); } }));
afterEach(() => vi.unstubAllEnvs());
it('is unavailable without the explicit QA flag', () => {
  vi.stubEnv('ENABLE_PORTAL_QA_FIXTURES', '0');
  expect(() => Page()).toThrow('NEXT_NOT_FOUND');
});
it('requires confirmation and demonstrates the result without network commands', async () => {
  vi.stubEnv('ENABLE_PORTAL_QA_FIXTURES', '1');
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const view = renderIntoDocument(Page());
  try {
    const approve = view.container.querySelector('button')!;
    expect(approve.disabled).toBe(true);
    await act(async () => view.container.querySelector<HTMLInputElement>('input')!.click());
    await act(async () => approve.click());
    expect(view.container.textContent).toContain('$75.00 still owing');
    expect(view.container.textContent).toContain('Already recorded');
    expect(fetcher).not.toHaveBeenCalled();
  } finally { view.unmount(); vi.unstubAllGlobals(); }
});
