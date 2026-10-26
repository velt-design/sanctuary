import { act, type ReactNode } from 'react';
import { expect,it,vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import MarketingPerformance from './MarketingPerformance';
import {hubFixture} from '@/app/qa/marketing-performance-fixture/hubFixtures';
import {fixtureFilters,fixtureReport} from '@/app/qa/marketing-performance-fixture/fixtures';
import {commercialFixture} from '@/app/qa/marketing-performance-fixture/commercialFixtures';
import {designerFixture} from '@/app/qa/marketing-performance-fixture/designerFixtures';
import type {HubReport} from '@/lib/marketingPerformance/hub';
import type {OutcomeClient} from './ProjectSalesOutcome';
import {unrecordedSalesOutcome} from '@/lib/marketingPerformance/salesOutcome';
import type {AssignmentClient} from './SalesDesignerAssignment';
vi.mock('@/components/ui/drawer/Drawer',()=>({Drawer:({open,children,title}:{open:boolean;children:ReactNode;title:string})=>open?<div role="dialog" aria-label={title}>{children}</div>:null}));
vi.mock('recharts',()=>({Bar:()=>null,BarChart:()=>null,Line:()=>null,LineChart:()=>null,Cell:()=>null,CartesianGrid:()=>null,ReferenceLine:()=>null,ResponsiveContainer:()=>null,Tooltip:()=>null,XAxis:()=>null,YAxis:()=>null}));
it('starts independent Overview reads before hub resolves and does not reread on local tab/filter changes',async()=>{
  window.history.replaceState(null,'','/');
  let resolveHub!:(value:HubReport)=>void;
  const hub=vi.fn(()=>new Promise<HubReport>(resolve=>{resolveHub=resolve;})),prior=vi.fn(async()=>fixtureReport);
  const commercial=vi.fn(async()=>commercialFixture(hubFixture,fixtureFilters)),designer=vi.fn(async()=>designerFixture('empty'));
  const view=renderIntoDocument(<MarketingPerformance synthetic initialFilters={fixtureFilters} loader={hub} priorLoader={prior} commercialLoader={commercial} designerLoader={designer}/>);
  await act(async()=>{});
  expect(hub).toHaveBeenCalledTimes(1);expect(commercial).toHaveBeenCalledTimes(1);expect(designer).toHaveBeenCalledTimes(1);expect(prior).not.toHaveBeenCalled();
  expect(view.container.textContent).toContain('Reading saved enquiries');
  await act(async()=>resolveHub(hubFixture));
  const ready=async(selector:string)=>vi.waitFor(async()=>{await act(async()=>{await new Promise(resolve=>setTimeout(resolve,10));});expect(view.container.querySelector(selector)).not.toBeNull();},{timeout:3000});
  await ready('[aria-label="Inspect Quoted value"]');
  expect(view.container.querySelector('[aria-label="Source and outcome comparison"] tbody tr')).not.toBeNull();
  expect(commercial).toHaveBeenCalledTimes(1);expect(designer).toHaveBeenCalledTimes(1);
  for(const name of ['Sales activity','Project portfolio','Enquiries']){
    const tab=[...view.container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(tab=>tab.textContent===name)!;
    await act(async()=>tab.click());expect(hub).toHaveBeenCalledTimes(1);
    await ready('[aria-label="Underlying hub records"]');
  }
  expect(prior).toHaveBeenCalledTimes(1);view.unmount();window.history.replaceState(null,'','/');
});
it('keeps assignment edits and personal attendance separate with hoisted Designer evidence and refresh',async()=>{
  window.history.replaceState(null,'','/?view=overview&designer=ellen');
  let current=designerFixture();current.assignments[0].designerKey='ellen';
  const designer=vi.fn(async()=>structuredClone(current));
  const client:AssignmentClient={read:vi.fn(async id=>current.assignments.find(a=>a.projectId===id)!),assign:vi.fn(async(id,command)=>{
    const value={projectId:id,designerKey:command.designerKey,revision:2,updatedAt:current.asOf,basis:command.basis};
    current={...current,assignments:current.assignments.map(a=>a.projectId===id?value:a)};return value;
  })};
  const hub=vi.fn(async()=>hubFixture),commercial=vi.fn(async()=>commercialFixture(hubFixture,fixtureFilters));
  const view=renderIntoDocument(<MarketingPerformance synthetic initialFilters={fixtureFilters} loader={hub} priorLoader={async()=>fixtureReport} commercialLoader={commercial} designerLoader={designer} assignmentClient={client}/>);
  await vi.waitFor(async()=>{await act(async()=>{await new Promise(resolve=>setTimeout(resolve,10));});expect(view.container.textContent).toContain('No dated personal visit workload is recorded for Ellen');},{timeout:3000});
  expect(designer).toHaveBeenCalledTimes(1);
  const row=[...view.container.querySelectorAll('table[aria-label="Recorded visit conversion"] tbody tr')].find(r=>r.querySelector('th')?.textContent==='Ellen')!;
  expect(row.textContent).not.toContain('100%');expect(row.querySelectorAll('td')[0].textContent).toBe('0');
  act(()=>row.querySelectorAll('td')[4].querySelector('button')!.click());
  const dialog=view.container.querySelector('[role=dialog]')!;
  act(()=>[...dialog.querySelectorAll('button')].find(b=>b.textContent?.startsWith('Designer projects'))!.click());
  act(()=>[...dialog.querySelectorAll('button')].find(b=>b.textContent==='Assign sales designer')!.click());
  act(()=>{
    const select=dialog.querySelector('select')!;select.value='';select.dispatchEvent(new Event('change',{bubbles:true}));
    const textarea=dialog.querySelector('textarea')!;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(textarea,'Clear synthetic sales assignment');textarea.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await act(async()=>[...dialog.querySelectorAll('button')].find(b=>b.textContent==='Save assignment')!.click());
  expect(client.assign).toHaveBeenCalledTimes(1);expect(designer).toHaveBeenCalledTimes(1);
  expect(view.container.textContent).toContain('Conversion is unavailable for this selection');
  await act(async()=>[...view.container.querySelectorAll('button')].find(b=>b.textContent==='Refresh')!.click());
  await vi.waitFor(async()=>{await act(async()=>{await Promise.resolve();});expect(view.container.textContent).toContain('Conversion is unavailable for this selection');});
  expect(designer).toHaveBeenCalledTimes(2);expect(hub).toHaveBeenCalledTimes(2);
  expect(view.container.querySelector<HTMLSelectElement>('select[aria-label="Designer"]')?.value??[...view.container.querySelectorAll('select')].find(s=>s.value==='ellen')?.value).toBe('ellen');
  expect(view.container.textContent).toContain('No dated personal visit workload is recorded for Ellen');
  view.unmount();window.history.replaceState(null,'','/');
});

it('preserves assignment and outcome edits through parallel evidence, retry, refresh and URL reload',async()=>{
  window.history.replaceState(null,'','/?view=overview&designer=ellen&acceptedDates=all');
  let current=designerFixture();current.assignments[0].designerKey='ellen';let failNext=false;
  const designer=vi.fn(async()=>{if(failNext){failNext=false;throw new Error('Synthetic designer read failed');}return structuredClone(current);});
  const assignment:AssignmentClient={read:async id=>current.assignments.find(a=>a.projectId===id)!,assign:async(id,command)=>{
    const next={projectId:id,designerKey:command.designerKey,revision:2,updatedAt:current.asOf,basis:command.basis};
    current={...current,assignments:current.assignments.map(a=>a.projectId===id?next:a)};return next;
  }};
  const outcome:OutcomeClient={read:async id=>current.salesOutcomes.find(o=>o.projectId===id)??unrecordedSalesOutcome(id),record:vi.fn(async(id,command)=>{
    const next={projectId:id,outcome:command.outcome,revision:command.expectedRevision+1,updatedAt:current.asOf,basis:command.basis};
    current={...current,salesOutcomes:[...current.salesOutcomes.filter(o=>o.projectId!==id),next]};return next;
  })};
  const hub=vi.fn(async()=>hubFixture),commercial=vi.fn(async()=>commercialFixture(hubFixture,fixtureFilters));
  const element=<MarketingPerformance synthetic initialFilters={fixtureFilters} loader={hub} priorLoader={async()=>fixtureReport} commercialLoader={commercial} designerLoader={designer} assignmentClient={assignment} outcomeClient={outcome}/>;
  let view=renderIntoDocument(element);
  const ready=async(label:string,value:string)=>vi.waitFor(async()=>{await act(async()=>{await new Promise(resolve=>setTimeout(resolve,10));});expect(view.container.querySelector(`button[aria-label="${label}"]`)?.textContent).toBe(value);},{timeout:3000});
  const click=(text:string,scope:ParentNode=view.container)=>{const button=[...scope.querySelectorAll('button')].find(b=>b.textContent===text);expect(button).toBeTruthy();act(()=>button!.click());};
  const fields=(scope:ParentNode,value:string,basis:string)=>act(()=>{const select=scope.querySelector('select')!;select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));const text=scope.querySelector('textarea')!;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(text,basis);text.dispatchEvent(new Event('input',{bubbles:true}));});
  await ready('Ellen: Accepted jobs','1');
  act(()=>view.container.querySelector<HTMLButtonElement>('button[aria-label="Ellen: Accepted jobs"]')!.click());
  let dialog=view.container.querySelector('[role=dialog]')!;
  click('Assign sales designer',dialog);fields(dialog,'jordan','Synthetic confirmed sales designer');click('Save assignment',dialog);await act(async()=>{});
  act(()=>{const select=view.container.querySelector<HTMLSelectElement>('select[aria-label="Designer"]')??[...view.container.querySelectorAll('select')].find(s=>s.value==='ellen')!;select.value='jordan';select.dispatchEvent(new Event('change',{bubbles:true}));});
  await ready('Jordan: Net accepted jobs','1');expect(designer).toHaveBeenCalledTimes(1);
  expect(new URLSearchParams(window.location.search).get('designer')).toBe('jordan');expect(new URLSearchParams(window.location.search).get('acceptedDates')).toBe('all');
  act(()=>view.container.querySelector<HTMLButtonElement>('button[aria-label="Jordan: Accepted jobs"]')!.click());dialog=view.container.querySelector('[role=dialog]')!;
  click('Record sales outcome',dialog);fields(dialog,'refunded','Synthetic confirmed whole-job refund');click('Save outcome',dialog);await ready('Jordan: Net accepted jobs','0');
  expect(outcome.record).toHaveBeenCalledTimes(1);expect(designer).toHaveBeenCalledTimes(1);expect(view.container.querySelector('button[aria-label="Jordan: Accepted jobs"]')!.textContent).toBe('1');
  failNext=true;click('Refresh');await vi.waitFor(async()=>{await act(async()=>{});expect(view.container.textContent).toContain('Synthetic designer read failed');});
  click('Retry');await ready('Jordan: Net accepted jobs','0');expect(designer).toHaveBeenCalledTimes(3);expect(hub).toHaveBeenCalledTimes(2);
  act(()=>view.container.querySelector<HTMLButtonElement>('button[aria-label="Jordan: Accepted jobs"]')!.click());dialog=view.container.querySelector('[role=dialog]')!;
  click('Record sales outcome',dialog);fields(dialog,'','Synthetic corrected report-only outcome');click('Save outcome',dialog);await ready('Jordan: Net accepted jobs','1');expect(outcome.record).toHaveBeenCalledTimes(2);
  view.unmount();view=renderIntoDocument(element);await ready('Jordan: Net accepted jobs','1');expect(designer).toHaveBeenCalledTimes(4);
  expect(view.container.querySelector('button[aria-label="Jordan: Accepted jobs"]')!.textContent).toBe('1');expect(new URLSearchParams(window.location.search).get('acceptedDates')).toBe('all');
  view.unmount();window.history.replaceState(null,'','/');
});
