import {sampleFinancialPanel} from '@/app/qa/marketing-performance-fixture/financialFixtures';
import {financialRequestKey} from '@/lib/xero/financials/contract';
import { act, type ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import MarketingPerformance from './MarketingPerformance';
import SalesActivity from './SalesActivity';
import { hubFixture } from '@/app/qa/marketing-performance-fixture/hubFixtures';
import { fixtureFilters } from '@/app/qa/marketing-performance-fixture/fixtures';
import type { HubReadResult, InitialHubSeed } from '@/lib/marketingPerformance/initialHub';
import { columnarRead } from '@/lib/marketingPerformance/columnarReports';

// Code is already prepared here, so these tests isolate the real host's data
// boundary. Optimized browser evidence covers actual Flight/code delivery.
vi.mock('./usePreparedReportViews', () => ({ default: () => ({ components: { sales: SalesActivity }, preparing: false, error: '', retry: vi.fn() }) }));
vi.mock('@/components/ui/drawer/Drawer', () => ({ Drawer: ({ open, children, title }: { open: boolean; children: ReactNode; title: string }) => open ? <div role="dialog" aria-label={title}>{children}</div> : null }));
vi.mock('recharts', () => ({ Bar: () => null, BarChart: () => null, Line: () => null, LineChart: () => null, Cell: () => null, CartesianGrid: () => null, ReferenceLine: () => null, ResponsiveContainer: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null }));
function deferred(wire=false) {
  let resolve!: (result: HubReadResult) => void;
  const native = new Promise<HubReadResult>(yes => { resolve = yes; });
  const result = Object.create(Promise.prototype, { then: { value: (yes: (value: Awaited<InitialHubSeed['result']>) => unknown, no: (error: unknown) => unknown) => {
    void native.then(value=>yes(wire?columnarRead('hub',value):value), no);
  } } }) as InitialHubSeed['result'];
  return { resolve, seed: { ...fixtureFilters, result } satisfies InitialHubSeed };
}
afterEach(() => { window.history.replaceState(null, '', '/'); sessionStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function setup(wire=false) {
  window.history.replaceState(null, '', '/?view=sales&source=google&start=2026-09-01&end=2026-09-22');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const pending = deferred(wire), loader = vi.fn(async () => hubFixture), prior = vi.fn(), commercial = vi.fn(), designer = vi.fn();
  const view = renderIntoDocument(<MarketingPerformance synthetic initialFilters={fixtureFilters} initialHubSeed={pending.seed}
    loader={loader} priorLoader={prior} commercialLoader={commercial} designerLoader={designer} />);
  const results = () => view.container.querySelector<HTMLElement>('#hub-results')!;
  const records = () => view.container.querySelector<HTMLElement>('[aria-label="Underlying hub records"]');
  const source = () => view.container.querySelector('[aria-label="Remove Source filter"]')?.textContent;
  const button = (label: string) => [...view.container.querySelectorAll('button')].find(item => item.textContent === label)!;
  return { ...view, pending, loader, prior, commercial, designer, results, records, source, button };
}
it.each([false,true])('renders complete seeded Sales records and preserves filters, inspection, return capture and normal refresh (columns=%s)', async wire => {
  const view = setup(wire), query = window.location.search;
  expect(view.results().getAttribute('aria-busy')).toBe('true'); expect(view.container.textContent).toContain('Reading saved enquiries');
  expect(view.source()).toContain('google'); expect(view.loader).not.toHaveBeenCalled();
  await act(async () => view.pending.resolve({ ok: true, report: hubFixture }));
  expect(view.results().getAttribute('aria-busy')).toBe('false'); expect(view.container.textContent).toContain('Quote versions');
  expect(view.container.textContent).toContain('Net recorded receipts'); expect(view.records()).not.toBeNull();
  const links = [...view.records()!.querySelectorAll('a')]; expect(links.length).toBeGreaterThan(0);
  vi.spyOn(view.results(), 'getBoundingClientRect').mockReturnValue({ height: 1050 } as DOMRect);
  vi.stubGlobal('scrollY', 420);
  links[0].addEventListener('click', event => event.preventDefault()); act(() => links[0].click());
  expect(JSON.parse(sessionStorage.getItem(`marketing-report-position:${window.location.pathname}${query}`)!)).toEqual({ height: 1050, y: 420 });
  await act(async () => view.button('Refresh').click());
  expect(view.loader).toHaveBeenCalledTimes(1); expect(view.results().getAttribute('aria-busy')).toBe('false');
  expect(window.location.search).toBe(query); expect(view.source()).toContain('google');
  expect(view.prior).not.toHaveBeenCalled(); expect(view.commercial).not.toHaveBeenCalled(); expect(view.designer).not.toHaveBeenCalled(); view.unmount();
});
it.each([false,true])('shows a failed seed without partial records and recovers through the ordinary API with the same URL (columns=%s)', async wire => {
  const view = setup(wire), query = window.location.search;
  await act(async () => view.pending.resolve({ ok: false, status: 503, error: 'The hub could not be loaded. Please retry.' }));
  expect(view.results().getAttribute('aria-busy')).toBe('false'); expect(view.container.querySelector('[role="alert"]')?.textContent).toContain('Hub unavailable');
  expect(view.container.textContent).toContain('No partial totals'); expect(view.records()).toBeNull(); expect(view.loader).not.toHaveBeenCalled();
  await act(async () => view.button('Retry').click());
  expect(view.loader).toHaveBeenCalledTimes(1); expect(view.records()).not.toBeNull(); expect(view.container.querySelector('[role="alert"]')).toBeNull();
  expect(window.location.search).toBe(query); expect(view.source()).toContain('google');
  expect(view.prior).not.toHaveBeenCalled(); expect(view.commercial).not.toHaveBeenCalled(); expect(view.designer).not.toHaveBeenCalled(); view.unmount();
});

it('does not reuse a pending Financial seed after leaving and returning to the Financial tab',async()=>{
 const query={from:'2026-09-01',to:'2026-09-30',basis:'accrual' as const,section:'profit' as const};
 window.history.replaceState(null,'','/?view=financials&financeFrom=2026-09-01&financeTo=2026-09-30&financeBasis=accrual&financeSection=profit');vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 let resolve!:(value:{ok:true;report:ReturnType<typeof sampleFinancialPanel>})=>void;
 const initialFinancialSeed={key:financialRequestKey(query),result:new Promise<{ok:true;report:ReturnType<typeof sampleFinancialPanel>}>(yes=>{resolve=yes;})};
 const financials=vi.fn(async()=>sampleFinancialPanel(query));
 const view=renderIntoDocument(<MarketingPerformance synthetic initialFilters={fixtureFilters} initialFinancialSeed={initialFinancialSeed} financialsLoader={financials} loader={async()=>hubFixture}/>);
 expect(financials).not.toHaveBeenCalled();
 const tab=(text:string)=>[...view.container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===text)!;
 await act(async()=>tab('Sales activity').click());
 await act(async()=>tab('Financials').click());
 await act(async()=>resolve({ok:true,report:sampleFinancialPanel(query)}));
 expect(financials).toHaveBeenCalledOnce();expect(window.location.search).toContain('financeFrom=2026-09-01');expect(view.container.textContent).toContain('Profit & loss');view.unmount();
});
