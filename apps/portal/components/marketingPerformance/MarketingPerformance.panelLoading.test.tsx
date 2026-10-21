import { act, type ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import MarketingPerformance from './MarketingPerformance';
import EnquiryCharts from './EnquiryCharts';
import type { ReportViewLoaders } from './usePreparedReportViews';
import { hubFixture } from '@/app/qa/marketing-performance-fixture/hubFixtures';
import { fixtureFilters, fixtureReport } from '@/app/qa/marketing-performance-fixture/fixtures';

let loaders: ReportViewLoaders;
// Exercise the real preparation hook and host together; control only code delivery.
vi.mock('./usePreparedReportViews', async importOriginal => {
  const actual = await importOriginal<typeof import('./usePreparedReportViews')>();
  return { ...actual, default: (view: Parameters<typeof actual.default>[0]) => actual.default(view, loaders) };
});
vi.mock('@/components/ui/drawer/Drawer', () => ({ Drawer: ({ open, children, title }: { open: boolean; children: ReactNode; title: string }) => open ? <div role="dialog" aria-label={title}>{children}</div> : null }));
vi.mock('recharts', () => ({ Bar: () => null, BarChart: () => null, Line: () => null, LineChart: () => null, Cell: () => null, CartesianGrid: () => null, ReferenceLine: () => null, ResponsiveContainer: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null }));

function deferred<Value>() {
  let resolve!: (value: Value) => void, reject!: (error: Error) => void;
  const promise = new Promise<Value>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
afterEach(() => {
  window.history.replaceState(null, '', '/');
  sessionStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it('keeps real records, return capture and filters through module loading, failure and a code-only retry', async () => {
  const first = deferred<{ default: typeof EnquiryCharts }>(), retry = deferred<{ default: typeof EnquiryCharts }>();
  loaders = {
    overview: vi.fn(async () => { throw new Error('Unexpected Overview import'); }),
    enquiries: vi.fn<ReportViewLoaders['enquiries']>().mockReturnValueOnce(first.promise).mockReturnValueOnce(retry.promise),
    sales: vi.fn(async () => { throw new Error('Unexpected Sales import'); }),
    portfolio: vi.fn(async () => { throw new Error('Unexpected Portfolio import'); }),
  };
  window.history.replaceState(null, '', '/?view=enquiries&source=google');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const hub = vi.fn(async () => hubFixture), prior = vi.fn(async () => fixtureReport);
  const commercial = vi.fn(), designer = vi.fn();
  const view = renderIntoDocument(<MarketingPerformance synthetic initialFilters={fixtureFilters} loader={hub} priorLoader={prior} commercialLoader={commercial} designerLoader={designer} />);
  await act(async () => {});
  const results = view.container.querySelector<HTMLDivElement>('#hub-results')!;
  const records = () => view.container.querySelector<HTMLElement>('[aria-label="Underlying hub records"]')!;
  const sourceChip = () => view.container.querySelector('[aria-label="Remove Source filter"]')?.textContent;
  const dateRange = () => ([...view.container.querySelectorAll('label')].find(label => label.textContent === 'Date range')?.control as HTMLSelectElement | null)?.value;
  const search = window.location.search, recordText = records().textContent;
  const links = () => [...records().querySelectorAll('a')].map(a => a.getAttribute('href'));
  const originalLinks = links(), originalDate = dateRange();
  expect(originalLinks.length).toBeGreaterThan(0);
  expect(originalDate).toBe('custom');
  expect(sourceChip()).toContain('google');
  expect(results.getAttribute('aria-busy')).toBe('true');
  expect(view.container.textContent).toContain('Preparing report view…');

  // Real links remain usable while only their chart code is pending.
  vi.spyOn(results, 'getBoundingClientRect').mockReturnValue({ height: 1120 } as DOMRect);
  vi.stubGlobal('scrollY', 640);
  const link = records().querySelector<HTMLAnchorElement>('a')!;
  link.addEventListener('click', event => event.preventDefault());
  act(() => link.click());
  expect(JSON.parse(sessionStorage.getItem(`marketing-report-position:${window.location.pathname}${search}`)!)).toEqual({ height: 1120, y: 640 });

  await act(async () => first.reject(new Error('Selected chunk unavailable')));
  expect(results.getAttribute('aria-busy')).toBe('false');
  expect(view.container.querySelector('[role="alert"]')?.textContent).toContain('Report view unavailable');
  expect(records().textContent).toBe(recordText); expect(links()).toEqual(originalLinks);
  await act(async () => [...view.container.querySelectorAll('button')].find(button => button.textContent === 'Retry report view')!.click());
  expect(results.getAttribute('aria-busy')).toBe('true');
  await act(async () => retry.resolve({ default: EnquiryCharts }));
  expect(results.getAttribute('aria-busy')).toBe('false');
  expect(view.container.textContent).toContain('Source performance');
  expect(view.container.textContent).not.toContain('Preparing report view…');
  expect(view.container.querySelector('[role="alert"]')).toBeNull();
  expect(records().textContent).toBe(recordText); expect(links()).toEqual(originalLinks);
  expect(window.location.search).toBe(search); expect(sourceChip()).toContain('google'); expect(dateRange()).toBe(originalDate);
  expect(loaders.enquiries).toHaveBeenCalledTimes(2);
  expect(hub).toHaveBeenCalledTimes(1); expect(prior).toHaveBeenCalledTimes(1);
  expect(commercial).not.toHaveBeenCalled(); expect(designer).not.toHaveBeenCalled();
  expect(loaders.overview).not.toHaveBeenCalled(); expect(loaders.sales).not.toHaveBeenCalled(); expect(loaders.portfolio).not.toHaveBeenCalled();
  view.unmount();
});
