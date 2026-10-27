import { act } from 'react';
import { expect,it,vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { hubFixture } from '@/app/qa/marketing-performance-fixture/hubFixtures';
import { fixtureFilters } from '@/app/qa/marketing-performance-fixture/fixtures';
import { commercialFixture } from '@/app/qa/marketing-performance-fixture/commercialFixtures';
import { hubDefaults,selectHub } from '@/lib/marketingPerformance/hub';
import type { CommercialReport } from '@/lib/marketingPerformance/commercial';
import CommercialOverview from './CommercialOverview';
import BusinessOverview from './BusinessOverview';
import { designerFixture } from '@/app/qa/marketing-performance-fixture/designerFixtures';
vi.mock('recharts',()=>({Bar:()=>null,BarChart:()=>null,Line:()=>null,LineChart:()=>null,CartesianGrid:()=>null,ReferenceLine:()=>null,ResponsiveContainer:()=>null,Tooltip:()=>null,XAxis:()=>null,YAxis:()=>null}));
it('retains geometry through parent remount without retaining stale quote values',async()=>{
 sessionStorage.clear();
 const bounds=vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({height:860,width:1200,x:0,y:0,top:0,left:0,bottom:860,right:1200,toJSON:()=>({})});
 const filters=hubDefaults(fixtureFilters),report=commercialFixture(hubFixture,fixtureFilters),loader=async()=>report;
 const props={hub:hubFixture,filters,apply:vi.fn()};
 const view=renderIntoDocument(<CommercialOverview {...props} loader={loader}/>);await act(async()=>{});
 expect(sessionStorage.getItem(`commercial-report-height:${window.innerWidth}`)).toBe('860');view.unmount();
 let resolve!:(r:CommercialReport)=>void;
 const pending=()=>new Promise<CommercialReport>(r=>{resolve=r;});
 const refreshed=renderIntoDocument(<CommercialOverview {...props} loader={pending}/>);
 expect(refreshed.container.querySelector('section')?.style.minHeight).toBe('860px');expect(refreshed.container.querySelector<HTMLButtonElement>('[aria-label="Inspect Quoted value"]')?.disabled).toBe(true);expect(refreshed.container.textContent).toContain('Reading…');
 await act(async()=>resolve(report));expect(refreshed.container.textContent).toContain('Quoted value');refreshed.unmount();bounds.mockRestore();sessionStorage.clear();
});

it('keeps incomplete history and exact period visible from headline into the drawer',async()=>{
 const filters={...hubDefaults(fixtureFilters),start:'2024-01-01',end:'2024-01-31'};
 const report=commercialFixture(hubFixture,filters),loader=async()=>report;
 const view=renderIntoDocument(<CommercialOverview hub={hubFixture} filters={filters} apply={vi.fn()} loader={loader}/>);await act(async()=>{});
 expect(view.container.textContent).toContain('Incomplete history');expect(view.container.textContent).not.toContain('$0.00');expect(view.container.textContent).toContain('No verified values to plot');
 await act(async()=>{view.container.querySelector<HTMLButtonElement>('[aria-label="Inspect Quoted value"]')!.click();});
 const drawer=document.querySelector('[role="dialog"]')!;
 expect(drawer.textContent).toContain('2024-01-01 – 2024-01-31 NZ');expect(drawer.textContent).toContain('Incomplete history');expect(drawer.textContent).not.toContain('$0.00');view.unmount();
});
it('keeps useful partial recorded values qualified, including prior-period inspection',async()=>{
 const filters=hubDefaults(fixtureFilters),report=commercialFixture(hubFixture,filters);
 report.earliestSentAt='2026-09-10T00:00:00Z';
 const view=renderIntoDocument(<CommercialOverview hub={hubFixture} filters={filters} apply={vi.fn()} loader={async()=>report}/>);await act(async()=>{});
 expect(view.container.textContent).toContain('Partial recorded history');
 const comparisons=[...view.container.querySelectorAll('details')].filter(d=>d.querySelector('summary')?.textContent==='Previous period comparison');
 expect(comparisons).toHaveLength(1);
 act(()=>comparisons[0].querySelector('summary')!.click());expect(comparisons[0].open).toBe(true);
 const priorButtons=[...comparisons[0].querySelectorAll('button')];expect(priorButtons).toHaveLength(3);
 const previous=priorButtons[0];
 await act(async()=>previous.click());
 const drawer=document.querySelector('[role="dialog"]')!;
 expect(drawer.textContent).toContain(`${report.priorStart} – ${report.priorEnd} NZ`);expect(drawer.textContent).toContain('Incomplete history');expect(drawer.textContent).not.toContain('$0.00');view.unmount();
});

it('carries filtered missing-send coverage through quoted headlines, trends and inspection without invalidating accepted value',async()=>{
 const filters=hubDefaults(fixtureFilters),report=commercialFixture(hubFixture,filters);
 report.earliestSentAt='2000-01-01T00:00:00Z';report.rows[0].undatedSendCount=1;
 const view=renderIntoDocument(<CommercialOverview hub={hubFixture} filters={filters} apply={vi.fn()} loader={async()=>report}/>);await act(async()=>{});
 const quoted=view.container.querySelector<HTMLButtonElement>('[aria-label="Inspect Quoted value"]')!;
 const accepted=view.container.querySelector<HTMLButtonElement>('[aria-label="Inspect Accepted value"]')!;
 expect(quoted.textContent).toMatch(/Partial recorded history|Incomplete history/);
 expect(accepted.textContent).not.toMatch(/Partial recorded history|Incomplete history/);
 expect(view.container.textContent).toContain('1 scopes across all dates');
 const quotedCells=[...view.container.querySelectorAll('tbody tr')].map(r=>r.querySelector('td')?.textContent);
 expect(quotedCells.every(t=>/Partial recorded history|Incomplete history/.test(t??''))).toBe(true);
 await act(async()=>quoted.click());
 expect(document.querySelector('[role="dialog"]')?.textContent).toContain('1 scopes with missing send dates · all dates');
 view.unmount();
});

it('keeps real source rows inspectable through independent commercial loading, failure and retry',async()=>{
 window.history.replaceState(null,'','/');
 const filters={...hubDefaults(fixtureFilters),view:'overview' as const},apply=vi.fn();
 const reads:Array<{resolve:(report:CommercialReport)=>void;reject:(error:Error)=>void}>=[];
 const commercialLoader=()=>new Promise<CommercialReport>((resolve,reject)=>reads.push({resolve,reject}));
 const designerLoader=async()=>designerFixture('empty');
 const view=renderIntoDocument(<BusinessOverview hub={hubFixture} filters={filters} apply={apply} commercialLoader={commercialLoader} designerLoader={designerLoader} synthetic/>);
 await act(async()=>{});
 const inspectSource=()=>{
  const region=view.container.querySelector('[aria-label="Source and outcome comparison"]')!;
  expect(region.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
  const source=region.querySelector<HTMLButtonElement>('[aria-label="Inspect Enquiries from google: 5"]')!;
  expect(source.textContent).toContain('5');expect(source.disabled).toBe(false);
  expect(source.closest('[aria-busy="true"]')).toBeNull();
  act(()=>source.click());expect(apply.mock.lastCall?.[0]).toMatchObject({view:'enquiries',source:'google',inspect:'all',start:filters.start,end:filters.end});
  expect(selectHub(hubFixture,apply.mock.lastCall![0]).enquiries).toHaveLength(5);
  expect(view.container.querySelector('[aria-label="Site visits and sales"]')).not.toBeNull();
 };
 expect(view.container.textContent).toContain('Reading quote values and timing');inspectSource();
 await act(async()=>reads[0].reject(new Error('Synthetic commercial failure')));
 expect(view.container.querySelector('[role="alert"]')?.textContent).toContain('Synthetic commercial failure');
 expect(view.container.querySelector<HTMLButtonElement>('[aria-label="Inspect Quoted value"]')?.disabled).toBe(true);inspectSource();
 const retry=[...view.container.querySelectorAll('button')].find(button=>button.textContent==='Retry commercial report')!;
 act(()=>retry.click());expect(reads).toHaveLength(2);
 expect(view.container.textContent).toContain('Reading quote values and timing');inspectSource();
 await act(async()=>reads[1].resolve(commercialFixture(hubFixture,filters)));
 expect(view.container.querySelector('[aria-label="Inspect Quoted value"]')).not.toBeNull();inspectSource();
 view.unmount();
});

it.each([['quoted','Quoted value'],['accepted','Accepted value'],['average','Average accepted quote'],['enquiryDays','Enquiry to first quote'],['acceptanceDays','First quote to acceptance']])('returns a URL-restored %s drawer to its real metric after evidence arrives',async(metric,label)=>{
 window.history.replaceState(null,'','/?commercialMetric='+metric);
 let resolve!:(report:CommercialReport)=>void;
 const view=renderIntoDocument(<CommercialOverview hub={hubFixture} filters={hubDefaults(fixtureFilters)} apply={vi.fn()} loader={()=>new Promise<CommercialReport>(yes=>{resolve=yes;})}/>);
 await act(async()=>{});expect(document.querySelector('[role="dialog"]')).not.toBeNull();
 await act(async()=>resolve(commercialFixture(hubFixture,fixtureFilters)));
 const target=view.container.querySelector<HTMLButtonElement>(`[aria-label="Inspect ${label}"]`)!;
 await act(async()=>{document.querySelector<HTMLButtonElement>('[role="dialog"] button[aria-label^="Close"]')!.click();});
 await vi.waitFor(()=>expect(document.activeElement).toBe(target));
 expect(document.querySelector('[role="dialog"]')).toBeNull();view.unmount();window.history.replaceState(null,'','/');
});
it('keeps ordinary click-owned drawer focus restoration',async()=>{
 window.history.replaceState(null,'','/');
 const view=renderIntoDocument(<CommercialOverview hub={hubFixture} filters={hubDefaults(fixtureFilters)} apply={vi.fn()} loader={async()=>commercialFixture(hubFixture,fixtureFilters)}/>);await act(async()=>{});
 const target=view.container.querySelector<HTMLButtonElement>('[aria-label="Inspect Quoted value"]')!;
 await act(async()=>{target.focus();target.click();});
 await act(async()=>{document.querySelector<HTMLButtonElement>('[role="dialog"] button[aria-label^="Close"]')!.click();});
 expect(document.activeElement).toBe(target);view.unmount();window.history.replaceState(null,'','/');
});
