import { act } from 'react';
import { expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import useMarketingReports, { type ReportLoader } from './useMarketingReports';
import { fixtureFilters, fixtureReport } from '../../app/qa/marketing-performance-fixture/fixtures';
import type { Filters, MarketingReport } from '../../lib/marketingPerformance/contract';

function Harness({ filters, loader }: { filters: Filters; loader: ReportLoader }) {
  const state = useMarketingReports(filters, 0, loader);
  return <div>{JSON.stringify({ busy: state.busy, current: state.report?.rows.length, prior: state.previous?.rows.length, error: state.error, comparisonError: state.comparisonError })}</div>;
}
function deferredLoader() {
  const pending: Array<{ filters: Filters; signal: AbortSignal; resolve: (value: MarketingReport) => void; reject: (error: Error) => void }> = [];
  const loader = vi.fn<ReportLoader>((filters, signal) => new Promise((resolve, reject) => pending.push({ filters, signal, resolve, reject })));
  const result = (index: number, count: number) => ({ ...fixtureReport, ...pending[index].filters, rows: fixtureReport.rows.slice(0, count) });
  return { pending, loader, result };
}
it('keeps verified current totals when the prior read fails, never substitutes zero', async () => {
  const { pending, loader, result } = deferredLoader();
  const rendered = renderIntoDocument(<Harness filters={fixtureFilters} loader={loader} />);
  expect(pending[1].filters).toMatchObject({ start: '2026-08-10', end: '2026-08-31' });
  await act(async () => { pending[0].resolve(result(0, 12)); pending[1].reject(new Error('Unavailable')); });
  const state = JSON.parse(rendered.container.textContent ?? '{}');
  expect(state.current).toBe(12); expect(state.prior).toBeUndefined(); expect(state.comparisonError).toContain('unavailable');
  expect(state.busy).toBe(false); expect(state.error).toBe('');
  rendered.unmount();
});
it('aborts stale pairs and retains only the final range after rapid changes', async () => {
  const { pending, loader, result } = deferredLoader();
  const rendered = renderIntoDocument(<Harness filters={fixtureFilters} loader={loader} />);
  const next = { ...fixtureFilters, start: '2026-09-16' };
  rendered.rerender(<Harness filters={next} loader={loader} />);
  expect(pending[0].signal.aborted).toBe(true); expect(pending[1].signal.aborted).toBe(true);
  await act(async () => { pending[2].resolve(result(2, 2)); pending[3].resolve(result(3, 3)); });
  await act(async () => { pending[0].resolve(result(0, 12)); pending[1].resolve(result(1, 6)); });
  expect(JSON.parse(rendered.container.textContent ?? '{}')).toMatchObject({ current: 2, prior: 3, busy: false });
  rendered.rerender(<Harness filters={{ ...next, source: 'meta' }} loader={loader} />);
  expect(loader).toHaveBeenCalledTimes(4); // Source filtering reuses both snapshots.
  rendered.unmount();
});
