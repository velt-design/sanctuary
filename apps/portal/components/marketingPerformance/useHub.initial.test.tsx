import { act, StrictMode } from 'react';
import { expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { hubFixture } from '@/app/qa/marketing-performance-fixture/hubFixtures';
import { fixtureFilters } from '@/app/qa/marketing-performance-fixture/fixtures';
import type { Filters } from '@/lib/marketingPerformance/contract';
import type { HubReport } from '@/lib/marketingPerformance/hub';
import type { InitialHubSeed, HubReadResult } from '@/lib/marketingPerformance/initialHub';
import useHub, { type HubLoader } from './useHub';

function deferred<Value>() {
  let resolve!: (value: Value) => void, reject!: (error: Error) => void;
  const promise = new Promise<Value>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function Harness({ filters = fixtureFilters, seed, loader, revision = 0, skip = false }: {
  filters?: Filters | null; seed?: InitialHubSeed; loader: HubLoader; revision?: number; skip?: boolean;
}) {
  const state = useHub(filters, revision, loader, undefined, false, seed, skip);
  return <div>{JSON.stringify({ busy: state.busy, error: state.error, report: state.hub })}</div>;
}
const state = (container: HTMLElement) => JSON.parse(container.textContent!);
const seedFrom = (result: Promise<HubReadResult>): InitialHubSeed => ({ ...fixtureFilters, result });
const reportFor = (filters: Filters): HubReport => ({ ...hubFixture, start: filters.start, end: filters.end,
  enquiries: { ...hubFixture.enquiries, start: filters.start, end: filters.end },
  events: hubFixture.events.filter(event => event.day >= filters.start && event.day <= filters.end) });

it('consumes the complete initial report once without duplicate API reads, then refreshes normally', async () => {
  const pending = deferred<HubReadResult>(), seed = seedFrom(pending.promise), loader = vi.fn<HubLoader>(async filters => reportFor(filters));
  const view = renderIntoDocument(<Harness loader={loader} seed={seed} />);
  expect(state(view.container)).toMatchObject({ busy: true, report: null }); expect(loader).not.toHaveBeenCalled();
  await act(async () => pending.resolve({ ok: true, report: hubFixture }));
  expect(state(view.container)).toEqual({ busy: false, error: '', report: hubFixture });
  view.rerender(<Harness filters={{ ...fixtureFilters, source: 'facebook' }} loader={loader} seed={seed} />);
  expect(loader).not.toHaveBeenCalled();
  view.rerender(<Harness loader={loader} seed={seed} revision={1} />); await act(async () => {});
  expect(loader).toHaveBeenCalledTimes(1); expect(state(view.container).report).toEqual(hubFixture); view.unmount();
});
it('keeps loading and public denial honest, with API-only retry after an initial failure', async () => {
  const pending = deferred<HubReadResult>(), seed = seedFrom(pending.promise), loader = vi.fn<HubLoader>(async () => hubFixture);
  const view = renderIntoDocument(<Harness loader={loader} seed={seed} />);
  await act(async () => pending.resolve({ ok: false, status: 403, error: 'Developer access is required.' }));
  expect(state(view.container)).toEqual({ busy: false, report: null, error: 'Developer access is required.' });
  expect(loader).not.toHaveBeenCalled();
  view.rerender(<Harness loader={loader} seed={seed} revision={1} />); await act(async () => {});
  expect(loader).toHaveBeenCalledTimes(1); expect(state(view.container)).toMatchObject({ busy: false, error: '', report: hubFixture }); view.unmount();
});
it('retires a late seed when dates change, including a return to its original dates at revision zero', async () => {
  const pending = deferred<HubReadResult>(), seed = seedFrom(pending.promise);
  const requests: Array<{ filters: Filters; signal: AbortSignal; resolve: (report: HubReport) => void }> = [];
  const loader = vi.fn<HubLoader>((filters, signal) => new Promise(resolve => requests.push({ filters, signal, resolve })));
  const view = renderIntoDocument(<Harness loader={loader} seed={seed} />), next = { ...fixtureFilters, start: '2026-09-16' };
  view.rerender(<Harness filters={next} loader={loader} seed={seed} />);
  await act(async () => requests[0].resolve(reportFor(next)));
  expect(state(view.container).report.start).toBe(next.start);
  view.rerender(<Harness loader={loader} seed={seed} />);
  expect(loader).toHaveBeenCalledTimes(2);
  await act(async () => requests[1].resolve(hubFixture));
  await act(async () => pending.resolve({ ok: false, status: 503, error: 'Abandoned initial read' }));
  expect(state(view.container)).toEqual({ busy: false, error: '', report: hubFixture }); view.unmount();
});
it('falls back for mismatching client dates and never makes a later match eligible', async () => {
  const seed = seedFrom(Promise.resolve({ ok: true, report: hubFixture })), loader = vi.fn<HubLoader>(async filters => reportFor(filters));
  const next = { ...fixtureFilters, end: '2026-09-21' }, view = renderIntoDocument(<Harness filters={next} loader={loader} seed={seed} />);
  await act(async () => {}); expect(state(view.container).report.end).toBe(next.end);
  view.rerender(<Harness loader={loader} seed={seed} />); await act(async () => {});
  expect(loader).toHaveBeenCalledTimes(2); view.unmount();
});
it('does not consume a seed before filters restore, or after a Financials selection', async () => {
  const seed = seedFrom(Promise.resolve({ ok: true, report: hubFixture })), loader = vi.fn<HubLoader>(async () => hubFixture);
  const view = renderIntoDocument(<Harness filters={null} loader={loader} seed={seed} />);
  expect(loader).not.toHaveBeenCalled();
  view.rerender(<Harness filters={null} skip loader={loader} seed={seed} />);
  view.rerender(<Harness loader={loader} seed={seed} />); await act(async () => {});
  expect(loader).toHaveBeenCalledTimes(1); view.unmount();
});
it('retires a pending seed on Financials and uses the API on return before that seed settles', async () => {
  const pending = deferred<HubReadResult>(), seed = seedFrom(pending.promise), loader = vi.fn<HubLoader>(async () => hubFixture);
  const view = renderIntoDocument(<Harness loader={loader} seed={seed} />);
  view.rerender(<Harness filters={null} skip loader={loader} seed={seed} />);
  expect(loader).not.toHaveBeenCalled();
  view.rerender(<Harness loader={loader} seed={seed} />); await act(async () => {});
  expect(loader).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve({ ok: false, status: 403, error: 'Abandoned initial read' }));
  expect(state(view.container)).toEqual({ busy: false, error: '', report: hubFixture }); view.unmount();
});
it('shares the pending attempt across StrictMode replay and ignores a rejected seed after unmount', async () => {
  const pending = deferred<HubReadResult>(), seed = seedFrom(pending.promise), loader = vi.fn<HubLoader>(async () => hubFixture);
  const view = renderIntoDocument(<StrictMode><Harness loader={loader} seed={seed} /></StrictMode>);
  expect(loader).not.toHaveBeenCalled(); await act(async () => pending.resolve({ ok: true, report: hubFixture }));
  expect(state(view.container).report).toEqual(hubFixture); expect(loader).not.toHaveBeenCalled(); view.unmount();
  const settled = renderIntoDocument(<StrictMode><Harness loader={loader} seed={seedFrom(Promise.resolve({ ok: true, report: hubFixture }))} /></StrictMode>);
  await act(async () => {}); expect(state(settled.container).report).toEqual(hubFixture); expect(loader).not.toHaveBeenCalled(); settled.unmount();
  const late = deferred<HubReadResult>(), removed = renderIntoDocument(<Harness loader={loader} seed={seedFrom(late.promise)} />);
  removed.unmount(); await act(async () => late.reject(new Error('private transport details')));
  expect(loader).not.toHaveBeenCalled();
  const returned = renderIntoDocument(<Harness loader={loader} />); await act(async () => {});
  expect(loader).toHaveBeenCalledTimes(1); returned.unmount();
});
it('shows a safe failure for a broken streamed transport rather than its server exception', async () => {
  const pending = deferred<HubReadResult>(), loader = vi.fn<HubLoader>(async () => hubFixture);
  const view = renderIntoDocument(<Harness loader={loader} seed={seedFrom(pending.promise)} />);
  await act(async () => pending.reject(new Error('private transport details')));
  expect(state(view.container)).toEqual({ busy: false, report: null, error: 'The hub could not be loaded. Please retry.' });
  expect(loader).not.toHaveBeenCalled(); view.unmount();
});
it('rejects mismatching or incomplete seed evidence and retires an attempt when its loader owner changes', async () => {
  const loader = vi.fn<HubLoader>(async () => hubFixture);
  for (const report of [{ ...hubFixture, end: '2026-09-21' }, { ...hubFixture, projects: [] }]) {
    const view = renderIntoDocument(<Harness loader={loader} seed={seedFrom(Promise.resolve({ ok: true, report }))} />);
    await act(async () => {}); expect(state(view.container)).toMatchObject({ busy: false, report: null, error: expect.stringContaining('No partial totals') }); view.unmount();
  }
  const pending = deferred<HubReadResult>(), seed = seedFrom(pending.promise), replacement = vi.fn<HubLoader>(async () => hubFixture);
  const view = renderIntoDocument(<Harness loader={loader} seed={seed} />);
  view.rerender(<Harness loader={replacement} seed={seed} />); await act(async () => {});
  await act(async () => pending.resolve({ ok: false, status: 503, error: 'Old failure' }));
  expect(state(view.container)).toMatchObject({ busy: false, error: '', report: hubFixture });
  expect(loader).not.toHaveBeenCalled(); expect(replacement).toHaveBeenCalledTimes(1); view.unmount();
});
