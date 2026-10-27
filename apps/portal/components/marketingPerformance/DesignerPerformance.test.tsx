import { act } from 'react';
import { it,expect,vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { designerFixture } from '@/app/qa/marketing-performance-fixture/designerFixtures';
import { hubFixture } from '@/app/qa/marketing-performance-fixture/hubFixtures';
import { hubDefaults,parseHubFilters,hubQuery } from '@/lib/marketingPerformance/hub';
import { fixtureFilters } from '@/app/qa/marketing-performance-fixture/fixtures';
import type { DesignerReport } from '@/lib/marketingPerformance/designerContract';
import type { AssignmentClient } from './SalesDesignerAssignment';
import DesignerPerformance,{designerMetricValue} from './DesignerPerformance';
import { designerPerformance } from '@/lib/marketingPerformance/designer';
import useDesigner,{type DesignerLoader} from './useDesigner';
vi.mock('@/components/ui/drawer/Drawer',()=>({Drawer:({open,children,title}:any)=>open?<div role="dialog" aria-label={title}>{children}</div>:null}));
const filters={...hubDefaults(fixtureFilters),view:'overview' as const};
const flush=()=>act(async()=>{await Promise.resolve();});
it('labels quote-date estimates in visible visit metrics and exact records',async()=>{
 const report=designerFixture();Object.assign(report.visits[0],{origin:'history',day:'2026-09-07',at:null,basis:'Assumed original purpose: owner-approved.\nApproximate visit date: 2026-09-07 (original quote date; owner-approved).'});
 const view=renderIntoDocument(<DesignerPerformance hub={hubFixture} filters={filters} apply={vi.fn()} loader={async()=>report}/>);await flush();
 for(const selector of ['table[aria-label="Recorded visit conversion"]','[aria-label="Site visit results on small screens"]'])expect(view.container.querySelector(selector)!.textContent).toContain('1 approximate quote dates');
 act(()=>view.container.querySelector<HTMLButtonElement>('button[aria-label="Team: Visits completed, 4"]')!.click());
 expect(view.container.querySelector('[role=dialog]')!.textContent).toContain('2026-09-07 (approx. quote date)');
 expect(view.container.querySelector('[role=dialog]')!.textContent).toContain('original quote date; owner-approved');view.unmount();
});
it('shows incomplete activity, unavailable conversion and the undated inventory without inventing conflict',async()=>{
 const report=designerFixture('incomplete'),loader=vi.fn<DesignerLoader>(async()=>report);
 const view=renderIntoDocument(<DesignerPerformance hub={hubFixture} filters={filters} apply={vi.fn()} loader={loader}/>);await flush();
 expect(view.container.textContent).toContain('Conversion is unavailable');expect(view.container.textContent).toContain('further attended visit has no date');
 const review=[...view.container.querySelectorAll('button')].find(b=>b.textContent?.includes('Review dates'))!;act(()=>review.click());
 expect(view.container.querySelector('[role=dialog]')!.textContent).toContain('Date not recorded');expect(view.container.textContent).not.toContain('Conflicting original visits');
 const exact=view.container.querySelector('[role=dialog] a')!;expect(exact.getAttribute('href')).toContain('visit=');expect(exact.getAttribute('target')).toBe('_blank');view.unmount();
});
it('clears stale drilldown records during refresh and filters; recovers after source failure',async()=>{
 const pending:{resolve:(r:DesignerReport)=>void;reject:(e:Error)=>void;signal:AbortSignal}[]=[];
 const loader:DesignerLoader=(_,signal)=>new Promise((resolve,reject)=>pending.push({resolve,reject,signal}));
 const props={hub:hubFixture,filters,apply:vi.fn(),loader};const view=renderIntoDocument(<DesignerPerformance {...props}/>);
 await act(async()=>pending[0].resolve(designerFixture()));act(()=>view.container.querySelector<HTMLButtonElement>('button[aria-label^="Team: Visits completed,"]')!.click());expect(view.container.querySelector('[role=dialog]')).not.toBeNull();
 view.rerender(<DesignerPerformance {...props} revision={1}/>);expect(view.container.querySelector('[role=dialog]')).toBeNull();expect(pending[0].signal.aborted).toBe(true);
 await act(async()=>pending[1].reject(new Error('Unavailable source')));expect(view.container.textContent).toContain('No partial totals');
 act(()=>[...view.container.querySelectorAll('button')].find(b=>b.textContent==='Retry')!.click());await act(async()=>pending[2].resolve(designerFixture()));expect(view.container.textContent).toContain('Small cohort');view.unmount();
});
it('uses request identity for dates without refetching local designer selection',async()=>{
 const loader=vi.fn<DesignerLoader>(async f=>({...designerFixture(),start:f.start,end:f.end}));
 function Harness({f}:{f:typeof filters}){const state=useDesigner(f,0,loader);return <p>{state.busy?'Loading':state.report?.start}</p>;}
 const view=renderIntoDocument(<Harness f={filters}/>);await flush();view.rerender(<Harness f={{...filters,designer:'jp'}}/>);expect(loader).toHaveBeenCalledTimes(1);
 view.rerender(<Harness f={{...filters,start:'2026-09-10'}}/>);expect(view.container.textContent).toBe('Loading');await flush();expect(view.container.textContent).toBe('2026-09-10');view.unmount();
});
it('keeps selected attendee separate from owner in serialized report filters',()=>{
 const query=hubQuery({...filters,designer:'jp',owner:'dave'});expect(parseHubFilters(query,fixtureFilters)).toMatchObject({designer:'jp',owner:'dave'});
});
it('labels disabled-source activity as manual-only and leaves conversion unavailable',async()=>{
 const loader:DesignerLoader=async()=>designerFixture('disabled');const view=renderIntoDocument(<DesignerPerformance hub={hubFixture} filters={filters} apply={vi.fn()} loader={loader}/>);await flush();
 expect(view.container.textContent).toContain('Outlook records are withheld');expect(view.container.textContent).toContain('manual history only');expect(view.container.textContent).toContain('conversion is unavailable');view.unmount();
});
it('opens the exact original cohort from its count while keeping broader assignment management separate',async()=>{
 const report=designerFixture();report.assignments.push({projectId:report.visits[5].projectId!,designerKey:'jordan',revision:1,updatedAt:report.asOf,basis:'Synthetic assignment'});
 const view=renderIntoDocument(<DesignerPerformance hub={hubFixture} filters={filters} apply={vi.fn()} loader={async()=>report} synthetic/>);await flush();
 const row=[...view.container.querySelectorAll('table[aria-label="Recorded visit conversion"] tbody tr')].find(r=>r.querySelector('th')?.textContent==='Jordan')!;
 const original=row.querySelectorAll('td')[1].querySelector('button')!;expect(original.textContent).toBe('1');act(()=>original.click());
 let dialog=view.container.querySelector('[role=dialog]')!;expect(dialog.getAttribute('aria-label')).toContain('Jobs won');expect(dialog.querySelectorAll('ul > li')).toHaveLength(1);expect(dialog.textContent).not.toContain('2026-09-20');
 act(()=>row.querySelectorAll('td')[4].querySelector('button')!.click());dialog=view.container.querySelector('[role=dialog]')!;
 expect(dialog.getAttribute('aria-label')).toContain('Visits completed');expect(dialog.querySelectorAll('ul > li')).toHaveLength(2);expect(dialog.querySelector('ul')!.textContent).not.toContain('Date not recorded');
 act(()=>[...dialog.querySelectorAll('button')].find(b=>b.textContent?.startsWith('Designer projects'))!.click());
 expect(dialog.querySelectorAll('ul > li')).toHaveLength(3);expect(dialog.textContent).toContain('2026-09-20');expect(dialog.textContent).toContain('Date not recorded');view.unmount();
});
it('distinguishes zero personal workload from valid assigned sales',async()=>{
 const report=designerFixture();report.assignments[0].designerKey='ellen';
 const view=renderIntoDocument(<DesignerPerformance hub={hubFixture} filters={{...filters,designer:'ellen'}} apply={vi.fn()} loader={async()=>report}/>);await flush();
 expect(view.container.textContent).not.toContain('100%');expect(view.container.textContent).toContain('No dated personal visit workload is recorded for Ellen');
 expect(view.container.textContent).toContain('Assigned sales evidence is shown separately');expect(view.container.textContent).not.toContain('No dated visit records match');view.unmount();
});
it('retains the selected designer through clearing their last assignment and a fresh report read',async()=>{
 let current=designerFixture();current.assignments[0].designerKey='ellen';const projectId=current.assignments[0].projectId;
 const client:AssignmentClient={assign:async(id,command)=>{const value={projectId:id,designerKey:command.designerKey,revision:2,updatedAt:current.asOf,basis:command.basis};current={...current,assignments:current.assignments.map(a=>a.projectId===id?value:a)};return value;},read:async()=>current.assignments.find(a=>a.projectId===projectId)!};
 const apply=vi.fn(),selected={...filters,designer:'ellen'},loader:DesignerLoader=async()=>structuredClone(current);
 const props={hub:hubFixture,filters:selected,apply,loader,assignmentClient:client};const view=renderIntoDocument(<DesignerPerformance {...props}/>);await flush();
 const row=[...view.container.querySelectorAll('table[aria-label="Recorded visit conversion"] tbody tr')].find(r=>r.querySelector('th')?.textContent==='Ellen')!;
 act(()=>row.querySelectorAll('td')[4].querySelector('button')!.click());
 const dialog=view.container.querySelector('[role=dialog]')!;act(()=>[...dialog.querySelectorAll('button')].find(b=>b.textContent?.startsWith('Designer projects'))!.click());act(()=>[...dialog.querySelectorAll('button')].find(b=>b.textContent==='Assign sales designer')!.click());
 act(()=>{const select=dialog.querySelector('select')!;select.value='';select.dispatchEvent(new Event('change',{bubbles:true}));const textarea=dialog.querySelector('textarea')!;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(textarea,'Clear synthetic assignment');textarea.dispatchEvent(new Event('input',{bubbles:true}));});
 act(()=>[...dialog.querySelectorAll('button')].find(b=>b.textContent==='Save assignment')!.click());await flush();
 expect(view.container.querySelector('select')!.value).toBe('ellen');expect(view.container.querySelector('select')!.selectedOptions[0].textContent).toBe('Ellen');expect(view.container.textContent).not.toContain('100%');expect(apply).not.toHaveBeenCalled();
 view.rerender(<DesignerPerformance {...props} revision={1}/>);expect(view.container.querySelector('select')!.value).toBe('ellen');await flush();
 expect(view.container.querySelector('select')!.value).toBe('ellen');expect(parseHubFilters(hubQuery(selected),fixtureFilters).designer).toBe('ellen');expect(view.container.textContent).toContain('Conversion is unavailable');view.unmount();
});

it('presents attendee results first and opens the accepted values and exact close-rate cohort',async()=>{
 const report=designerFixture();report.scopes[0].paidAt=null;report.scopes[0].paymentEvidence=false;
 const view=renderIntoDocument(<DesignerPerformance hub={hubFixture} filters={filters} apply={vi.fn()} loader={async()=>report} synthetic/>);await flush();
 const table=view.container.querySelector('table[aria-label="Recorded visit conversion"]')!;
 expect([...table.querySelectorAll('thead th')].map(th=>th.textContent)).toEqual(['Person','Visits completed','Jobs won','Avg order value','Close rate','Details']);
 expect(view.container.querySelector('table')).toBe(table);
 const team=table.querySelector('tbody tr')!;expect([...team.querySelectorAll('td > button')].map(b=>b.textContent)).toEqual(['4','1','$18,500.00','50%','More']);
 const jp=[...table.querySelectorAll('tbody tr')].find(row=>row.querySelector('th')?.textContent==='JP')!;
 expect([...jp.querySelectorAll('td > button')].map(b=>b.textContent)).toEqual(['2','1','$18,500.00','50%','More']);
 act(()=>jp.querySelectorAll<HTMLButtonElement>('td > button')[4].click());
 const visits=view.container.querySelector('[role=dialog]')!;expect(visits.getAttribute('aria-label')).toContain('Visits completed');expect(visits.querySelectorAll('ul > li')).toHaveLength(2);expect(visits.querySelector('ul')!.textContent).toContain('Jordan, JP');
 act(()=>jp.querySelectorAll<HTMLButtonElement>('td > button')[2].click());
 let dialog=view.container.querySelector('[role=dialog]')!;
 expect(dialog.getAttribute('aria-label')).toContain('Avg order value');expect(dialog.querySelectorAll('ul > li')).toHaveLength(1);
 expect(dialog.querySelector('ul')!.textContent).toContain('$18,500.00 accepted initial scope');
 expect(dialog.querySelector('ul')!.textContent).not.toContain('DEMO-SCOPE-9');
 act(()=>jp.querySelectorAll<HTMLButtonElement>('td > button')[3].click());dialog=view.container.querySelector('[role=dialog]')!;
 expect(dialog.getAttribute('aria-label')).toContain('Close rate');expect(dialog.querySelectorAll('ul > li')).toHaveLength(2);
 expect(dialog.textContent).toContain('Close rate uses jobs won divided by the eligible original-visit projects');
 const mobile=view.container.querySelector('[aria-label="Site visit results on small screens"]')!;
 expect([...mobile.querySelectorAll('dl')][0].querySelectorAll('dt')).toHaveLength(4);
 expect(view.container.textContent).not.toContain('Sales conversion belongs to the explicitly assigned');view.unmount();
});

it('shows confirmed minimum rates and pending-date counts for Team and Jordan on desktop and mobile',async()=>{
 const report=designerFixture();report.visits[1].staff=['jordan'];report.scopes[1].accepted=true;
 const view=renderIntoDocument(<DesignerPerformance hub={hubFixture} filters={filters} apply={vi.fn()} loader={async()=>report} synthetic/>);await flush();
 const table=view.container.querySelector('table[aria-label="Recorded visit conversion"]')!;
 for(const name of ['Team','Jordan']){
  const row=[...table.querySelectorAll('tbody tr')].find(r=>r.querySelector('th')?.textContent?.startsWith(name))!;
  expect(row.querySelectorAll('td > button')[1].textContent).toBe('1');
  expect(row.querySelectorAll('td > button')[2].textContent).toBe('—');
  const rate=row.querySelectorAll<HTMLButtonElement>('td > button')[3];expect(rate.textContent).toBe('At least 50%');expect(rate.getAttribute('aria-label')).toContain('At least 50%');
  expect(row.textContent).toContain('1 job needs acceptance dates');
  act(()=>rate.click());expect(view.container.querySelector('[role=dialog]')!.textContent).toContain('Jobs won includes only confirmed dated wins');
 }
 expect(view.container.querySelector('[aria-label="Site visit results on small screens"]')!.textContent).toContain('At least 50%');
 expect(view.container.querySelector('[aria-label="Site visit results on small screens"]')!.textContent).toContain('1 job needs acceptance dates');view.unmount();
 const summary=designerPerformance(report).total,won=summary.outcomes.find(o=>o.accepted.length)!,pending=summary.outcomes.find(o=>o.undatedAcceptances.length)!;
 const example={...summary,outcomes:[...Array(50).fill(won),...Array(145).fill(pending)]};
 expect(designerMetricValue(example,'closeRate')).toBe('At least 25.6%');
 expect(designerMetricValue({...summary,outcomes:[pending]},'closeRate')).toBe('At least 0%');
 expect(designerMetricValue({...summary,outcomes:[]},'closeRate')).toBe('Unavailable');
 expect(designerMetricValue(designerPerformance(designerFixture()).total,'closeRate')).toBe('50%');
});
