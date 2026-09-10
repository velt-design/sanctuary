import { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import EnquiryJourneysPreview from './EnquiryJourneysPreview';

afterEach(() => vi.unstubAllGlobals());
it('reviews each journey through read-only requests and contains the email in a sandbox', async () => {
  const fetcher = vi.fn(async (url: string) => ({ ok: true, json: async () => ({ layouts: [{ subject: url.split('experience-')[1], htmlLight: '<p>Preview</p>' }] }) }));
  vi.stubGlobal('fetch', fetcher);
  const view = renderIntoDocument(<EnquiryJourneysPreview />);
  await act(async () => { await Promise.resolve(); });
  for (const label of ['Bespoke residential', 'Commercial', 'Professional', 'Configured pergola']) {
    const button = Array.from(view.container.querySelectorAll('button')).find(b => b.textContent === label)!;
    await act(async () => { button.click(); });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(view.container.querySelector('iframe')?.getAttribute('sandbox')).toBe('');
  }
  expect(fetcher).toHaveBeenCalledTimes(5);
  for (const call of fetcher.mock.calls) expect(call[0]).toContain('?variant=experience-');
  view.unmount();
});
