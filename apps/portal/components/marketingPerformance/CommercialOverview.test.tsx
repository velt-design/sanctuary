import { act } from 'react';
import { expect,it,vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { hubFixture } from '@/app/qa/marketing-performance-fixture/hubFixtures';
import { fixtureFilters } from '@/app/qa/marketing-performance-fixture/fixtures';
import { commercialFixture } from '@/app/qa/marketing-performance-fixture/commercialFixtures';
import { hubDefaults } from '@/lib/marketingPerformance/hub';
import type { CommercialReport } from '@/lib/marketingPerformance/commercial';
import CommercialOverview from './CommercialOverview';
vi.mock('recharts',()=>({Bar:()=>null,BarChart:()=>null,CartesianGrid:()=>null,Legend:()=>null,ResponsiveContainer:()=>null,Tooltip:()=>null,XAxis:()=>null,YAxis:()=>null}));
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
 expect(refreshed.container.querySelector('section')?.style.minHeight).toBe('860px');expect(refreshed.container.textContent).not.toContain('Quoted value');
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
 const previous=[...view.container.querySelectorAll('button')].find(b=>b.textContent?.startsWith('Previous:'))!;
 await act(async()=>previous.click());
 const drawer=document.querySelector('[role="dialog"]')!;
 expect(drawer.textContent).toContain(`${report.priorStart} – ${report.priorEnd} NZ`);expect(drawer.textContent).toContain('Incomplete history');expect(drawer.textContent).not.toContain('$0.00');view.unmount();
});
