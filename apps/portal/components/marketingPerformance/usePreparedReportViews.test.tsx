import { act, StrictMode, useEffect } from 'react';
import { expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { hubFixture } from '@/app/qa/marketing-performance-fixture/hubFixtures';
import { fixtureFilters } from '@/app/qa/marketing-performance-fixture/fixtures';
import { hubDefaults, type HubView } from '@/lib/marketingPerformance/hub';
import usePreparedReportViews, { type ReportViewLoaders } from './usePreparedReportViews';

const filters = hubDefaults(fixtureFilters);
const apply = vi.fn();
const mounts = vi.fn();
type Component<View extends keyof ReportViewLoaders> = Awaited<ReturnType<ReportViewLoaders[View]>>['default'];
const Overview: Component<'overview'> = ({ hub }) => <h2>Overview {hub.projects.length}</h2>;
const Enquiries: Component<'enquiries'> = ({ rows }) => <h2>Enquiries {rows.length}</h2>;
const Sales: Component<'sales'> = ({ filters }) => { useEffect(() => { mounts(); }, []); return <h2>Sales {filters.source || 'all sources'}</h2>; };
const Portfolio: Component<'portfolio'> = ({ projects }) => <h2>Portfolio {projects.length}</h2>;
function makeLoaders(): ReportViewLoaders {
  return { overview: vi.fn(async () => ({ default: Overview })), enquiries: vi.fn(async () => ({ default: Enquiries })), sales: vi.fn(async () => ({ default: Sales })), portfolio: vi.fn(async () => ({ default: Portfolio })) };
}
function deferred<Value>() {
  let resolve!: (value: Value) => void, reject!: (error: Error) => void;
  const promise = new Promise<Value>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function Harness({ view, ready = true, source = '', loaders }: { view: HubView | null; ready?: boolean; source?: string; loaders: ReportViewLoaders }) {
  const prepared = usePreparedReportViews(view, loaders);
  const { overview: BusinessOverview, enquiries: EnquiryCharts, sales: SalesActivity, portfolio: PortfolioChart } = prepared.components;
  if (!ready) return <p role="status">Waiting for saved evidence</p>;
  if (!view || view === 'financials') return <h2>Other view</h2>;
  if (prepared.error) return <div role="alert">{prepared.error}<button onClick={prepared.retry}>Retry report view</button></div>;
  const selected = { ...filters, view, source };
  if (view === 'overview' && BusinessOverview) return <BusinessOverview hub={hubFixture} filters={selected} apply={apply} />;
  if (view === 'enquiries' && EnquiryCharts) return <EnquiryCharts rows={hubFixture.enquiries.rows} filters={selected} apply={apply} />;
  if (view === 'sales' && SalesActivity) return <SalesActivity events={hubFixture.events} filters={selected} apply={apply} />;
  if (view === 'portfolio' && PortfolioChart) return <PortfolioChart projects={hubFixture.projects} filters={selected} apply={apply} />;
  return <p role="status">Preparing report view…</p>;
}
const flush = () => act(async () => { await Promise.resolve(); });

it('prepares only the selected component before data and renders it synchronously with current props', async () => {
  mounts.mockClear(); const loaders = makeLoaders();
  const view = renderIntoDocument(<Harness view="sales" ready={false} loaders={loaders} />); await flush();
  expect(view.container.textContent).toBe('Waiting for saved evidence'); expect(mounts).not.toHaveBeenCalled();
  expect(loaders.sales).toHaveBeenCalledTimes(1); expect(loaders.overview).not.toHaveBeenCalled(); expect(loaders.enquiries).not.toHaveBeenCalled(); expect(loaders.portfolio).not.toHaveBeenCalled();
  // No timer, Suspense retry or additional asynchronous import is needed after data.
  view.rerender(<Harness view="sales" source="facebook" loaders={loaders} />);
  expect(view.container.textContent).toBe('Sales facebook'); expect(view.container.querySelector('[role=status]')).toBeNull();
  view.rerender(<Harness view="sales" source="fb" loaders={loaders} />);
  expect(view.container.textContent).toBe('Sales fb'); expect(mounts).toHaveBeenCalledTimes(1); expect(loaders.sales).toHaveBeenCalledTimes(1); view.unmount();
});

it('keeps honest pending content when data wins the race against a slow module', async () => {
  const pending = deferred<{ default: typeof Portfolio }>(), loaders = makeLoaders(); loaders.portfolio = vi.fn(() => pending.promise);
  const view = renderIntoDocument(<Harness view="portfolio" loaders={loaders} />); await flush();
  expect(view.container.textContent).toBe('Preparing report view…');
  await act(async () => pending.resolve({ default: Portfolio }));
  expect(view.container.textContent).toBe(`Portfolio ${hubFixture.projects.length}`); expect(loaders.portfolio).toHaveBeenCalledTimes(1); view.unmount();
});

it('shows a rejected module and makes a fresh retry attempt without caching rejection', async () => {
  const loaders = makeLoaders(); loaders.enquiries = vi.fn<ReportViewLoaders['enquiries']>().mockRejectedValueOnce(new Error('Chunk unavailable')).mockResolvedValueOnce({ default: Enquiries });
  const view = renderIntoDocument(<Harness view="enquiries" loaders={loaders} />); await flush();
  expect(view.container.querySelector('[role=alert]')).not.toBeNull();
  await act(async () => view.container.querySelector('button')!.click());
  expect(view.container.textContent).toBe(`Enquiries ${hubFixture.enquiries.rows.length}`); expect(loaders.enquiries).toHaveBeenCalledTimes(2); expect(loaders.overview).not.toHaveBeenCalled(); view.unmount();
});

it.each(['resolve', 'reject'] as const)('ignores a stale %s after the selected view changes', async outcome => {
  const old = deferred<{ default: typeof Sales }>(), next = deferred<{ default: typeof Portfolio }>(), loaders = makeLoaders();
  loaders.sales = vi.fn(() => old.promise); loaders.portfolio = vi.fn(() => next.promise);
  const view = renderIntoDocument(<Harness view="sales" loaders={loaders} />); await flush();
  view.rerender(<Harness view="portfolio" loaders={loaders} />); await flush();
  await act(async () => { if (outcome === 'resolve') old.resolve({ default: Sales }); else old.reject(new Error('Old selection failed')); });
  expect(view.container.textContent).toBe('Preparing report view…'); expect(view.container.querySelector('[role=alert]')).toBeNull();
  await act(async () => next.resolve({ default: Portfolio }));
  expect(view.container.textContent).toBe(`Portfolio ${hubFixture.projects.length}`); view.unmount();
});

it('does not import Marketing panels for null/Financials and discards a previous loader owner', async () => {
  const loaders = makeLoaders(), replacement = makeLoaders();
  const view = renderIntoDocument(<Harness view={null} loaders={loaders} />); await flush();
  view.rerender(<Harness view="financials" loaders={loaders} />); await flush();
  for (const load of Object.values(loaders)) expect(load).not.toHaveBeenCalled();
  view.rerender(<Harness view="sales" loaders={loaders} />); await flush(); expect(view.container.textContent).toBe('Sales all sources');
  const pending = deferred<{ default: typeof Sales }>(); replacement.sales = vi.fn(() => pending.promise);
  view.rerender(<Harness view="sales" loaders={replacement} />); expect(view.container.textContent).toBe('Preparing report view…');
  await act(async () => pending.resolve({ default: Sales })); expect(view.container.textContent).toBe('Sales all sources'); view.unmount();
});

it('cleans up StrictMode and unmount attempts without stale updates or unhandled rejection', async () => {
  const pending = deferred<{ default: typeof Sales }>(), loaders = makeLoaders(); loaders.sales = vi.fn(() => pending.promise);
  const view = renderIntoDocument(<StrictMode><Harness view="sales" loaders={loaders} /></StrictMode>); await flush();
  expect(loaders.sales).toHaveBeenCalledTimes(1); view.unmount();
  await act(async () => pending.reject(new Error('Unmounted selection failed')));
});
