import { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import QuoteEmailFixture from './QuoteEmailFixture';
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });
it('uses the real preview owner through failure/retry and draft switch while rejecting all non-render commands', async () => {
  vi.useFakeTimers(); window.history.replaceState(null, '', '/?readFailure=1'); const original = vi.fn(); vi.stubGlobal('fetch', original);
  const view = renderIntoDocument(<QuoteEmailFixture previews={[{ subject: 'Draft A', html: '<p>Fictional A</p>', text: 'A' }, { subject: 'Draft B', html: '<p>Fictional B</p>', text: 'B' }]} />);
  const frame = view.container.querySelector('iframe');
  await act(async () => vi.advanceTimersByTimeAsync(1700)); expect(view.container.textContent).toContain('Synthetic preview read failed');
  act(() => Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent === 'Retry preview')!.click());
  await act(async () => vi.advanceTimersByTimeAsync(1700)); expect(frame?.srcdoc).toContain('Fictional A');
  act(() => Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent === 'Draft B')!.click()); expect(frame?.getAttribute('srcdoc')).toBeNull();
  expect((await window.fetch('/api/quotes/qv_progressive_fixture/send', { method: 'POST' })).status).toBe(403);
  expect(original).not.toHaveBeenCalled(); view.unmount(); expect(window.fetch).toBe(original);
});
