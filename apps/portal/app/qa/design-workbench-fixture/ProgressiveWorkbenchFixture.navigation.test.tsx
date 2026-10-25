import { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { __resetLocalFirstStoreForTests, __setLocalFirstStorageAdapterForTests } from '@/lib/localFirst/store';
import Fixture from './ProgressiveWorkbenchFixture';
import { progressiveWorkbenchFixture } from './progressiveRead.server';
const { replace, refresh } = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock('@/app/staff/projects/[projectId]/design-workbench/DesignWorkbenchEstimateClient', () => ({ default: ({ projectName }: any) => <div data-verified-runtime>{projectName}</div> }));
afterEach(() => { __resetLocalFirstStoreForTests(); vi.useRealTimers(); vi.unstubAllGlobals(); replace.mockReset(); refresh.mockReset(); });

it('recovers the actual Retry host through router-owned canonical navigation and a fresh real-reader seed', async () => {
  vi.useFakeTimers();
  __setLocalFirstStorageAdapterForTests({ get: async () => undefined, set: async () => undefined });
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const fixture = getSanctuaryGeometryWorkbenchFixture('multi-house-u-two-pergola')!;
  let canonical = new URL('http://localhost/qa/design-workbench-fixture?fixture=multi-house-u-two-pergola&progressive=1&scenario=denied');
  window.history.replaceState(null, '', canonical.pathname + canonical.search);
  function element() {
    const { projectId, estimateId, read } = progressiveWorkbenchFixture(fixture, 'a', canonical.searchParams.get('scenario') === 'denied' ? 'denied' : 'complete');
    return <Fixture projectId={projectId} estimateId={estimateId} initialRead={read} draft={fixture.draft!} />;
  }
  const view = renderIntoDocument(element());
  // Router canonical state is intentionally separate from window.history. A
  // history-only replacement followed by refresh would repeat the denied read.
  replace.mockImplementation((href: string) => { canonical = new URL(href, canonical); window.history.replaceState(null, '', canonical.pathname + canonical.search); view.rerender(element()); });
  refresh.mockImplementation(() => view.rerender(element()));
  const plan = view.container.querySelector('[data-workbench-nav-id="plan"]') as HTMLButtonElement;
  act(() => plan.click());
  await act(async () => vi.advanceTimersByTimeAsync(2300));
  expect(view.container.querySelector('main')?.getAttribute('data-workbench-read-state')).toBe('error');
  expect(view.container.querySelector('[data-verified-runtime]')).toBeNull();
  act(() => Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent === 'Retry workbench')!.click());
  expect(canonical.searchParams.get('scenario')).toBe('complete');
  expect(replace).toHaveBeenCalledOnce(); expect(refresh).not.toHaveBeenCalled();
  expect(view.container.querySelector('main')?.getAttribute('data-workbench-read-state')).toBe('pending');
  await act(async () => vi.advanceTimersByTimeAsync(2300));
  expect(view.container.querySelector('main')?.getAttribute('data-workbench-read-state')).toBe('ready');
  expect(view.container.querySelector('[data-verified-runtime]')?.textContent).toBe('Fictional courtyard A');
  expect(view.container.querySelector('[data-workbench-nav-id="plan"]')).toBe(plan);
  expect(plan.getAttribute('aria-selected')).toBe('true');
  expect(fetch).not.toHaveBeenCalled(); view.unmount();
});
