import { act, type ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import MarketingPerformance from './MarketingPerformance';
import {loadHub} from './useHub';
import {loadCommercial} from './useCommercial';
import Financials from '../financials/Financials';
import { representativeFixture } from '@/app/qa/marketing-performance-fixture/representativeFixture';
import { designerPerformance } from '@/lib/marketingPerformance/designer';
import { hubFixture } from '@/app/qa/marketing-performance-fixture/hubFixtures';
import { fixtureFilters, fixtureReport } from '@/app/qa/marketing-performance-fixture/fixtures';
import { commercialFixture } from '@/app/qa/marketing-performance-fixture/commercialFixtures';
import { designerFixture } from '@/app/qa/marketing-performance-fixture/designerFixtures';
import { sampleFinancialPanel } from '@/app/qa/marketing-performance-fixture/financialFixtures';
import type { HubReport } from '@/lib/marketingPerformance/hub';
import type { CommercialReport } from '@/lib/marketingPerformance/commercial';
import type { DesignerReport } from '@/lib/marketingPerformance/designerContract';
import type { FinancialPanelQuery, FinancialEvidence } from '@/lib/xero/financials/contract';
vi.mock('@/components/ui/drawer/Drawer',()=>({Drawer:({open,children,title}:{open:boolean;children:ReactNode;title:string})=>open?<div role="dialog" aria-label={title}>{children}</div>:null}));
vi.mock('recharts',()=>({Bar:()=>null,BarChart:()=>null,Line:()=>null,LineChart:()=>null,Cell:()=>null,CartesianGrid:()=>null,ReferenceLine:()=>null,ResponsiveContainer:()=>null,Tooltip:()=>null,XAxis:()=>null,YAxis:()=>null}));
function deferred<T>() {let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function quoteSourceDetails(container:HTMLElement) {
 const owner=container.querySelector('[aria-label="Commercial performance"]')!,trigger=[...owner.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Details')!;
 act(()=>trigger.click());const text=document.querySelector('[role="dialog"]')?.textContent;
 act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(document.activeElement).toBe(trigger);return text;
}
afterEach(()=>{window.history.replaceState(null,'','/');sessionStorage.clear();});
it.each([hubFixture,representativeFixture])('keeps actual controls while complete quote-source values arrive, then applies exact Hub membership to all reports',async(selectedHub)=>{
  const hub=deferred<HubReport>(),commercial=deferred<CommercialReport>(),designer=deferred<DesignerReport>();
  const query=new URLSearchParams(fixtureFilters).toString();window.history.replaceState(null,'','/?'+query);
  const view=renderIntoDocument(<MarketingPerformance synthetic initialFilters={fixtureFilters} initialQuery={query} loader={()=>hub.promise} priorLoader={async()=>fixtureReport} commercialLoader={()=>commercial.promise} designerLoader={()=>designer.promise}/>);
  const metric=view.container.querySelector<HTMLButtonElement>('[aria-label="Inspect Quoted value"]')!;
  const grouping=[...view.container.querySelectorAll('label')].find(label=>label.textContent==='Group values by')!.control as HTMLSelectElement;
  expect(metric.disabled).toBe(true);expect(metric.textContent).toContain('Reading');
  expect(view.container.querySelector('[aria-selected="true"]')?.textContent).toContain('Business overview');
  await act(async()=>commercial.resolve(commercialFixture(selectedHub,fixtureFilters)));
  expect(view.container.querySelector('[aria-label="Inspect Quoted value"]')).toBe(metric);expect(metric.disabled).toBe(false);
  const sourceTable=view.container.querySelector('[aria-label="Source and outcome comparison"] table'),designerTable=view.container.querySelector('[aria-label="Recorded visit conversion"]');
  expect(sourceTable?.textContent).toContain('Observed source');expect(sourceTable?.textContent).not.toContain('0 enquiries');expect(designerTable?.textContent).toContain('Person');
  const before=metric.textContent;expect(before).toContain('$');expect(view.container.querySelector('[data-hub-pending]')).not.toBeNull();
  expect(metric.closest('[aria-busy="true"]')).toBeNull();
  const designerReport={...designerFixture('accepted',selectedHub),start:fixtureFilters.start,end:fixtureFilters.end};
  await act(async()=>designer.resolve(designerReport));
  expect(view.container.querySelector('[aria-label="Accepted jobs by designer"]')).not.toBeNull();
  expect(designerTable?.textContent).toContain('Reading');
  expect(view.container.textContent).toContain('Quote source · project filters pending');
  expect(quoteSourceDetails(view.container)).toContain('Complete quote source read at');
  await act(async()=>hub.resolve(selectedHub));
  const attended=view.container.querySelector('table[aria-label="Recorded visit conversion"] tbody tr td button');
  expect(attended?.textContent).toBe(String(designerPerformance(designerReport,new Set(selectedHub.projects.map(p=>p.id))).total.attended.length));
  expect(Number(attended?.textContent)).toBeGreaterThan(0);expect(metric.textContent).toBe(before);expect(view.container.querySelector('[aria-label="Source and outcome comparison"] table')).toBe(sourceTable);expect(view.container.querySelector('[aria-label="Recorded visit conversion"]')).toBe(designerTable);
  expect([...view.container.querySelectorAll('select')]).toContain(grouping);view.unmount();
});
it('labels an independent source read and applies the exact completed intersection after source-time membership skew',async()=>{
  const hub=deferred<HubReport>(),query=new URLSearchParams({...fixtureFilters,view:'overview'}).toString();window.history.replaceState(null,'','/?'+query);
  const commercial=commercialFixture(hubFixture,fixtureFilters),designer=designerFixture('accepted');
  // This project existed at the quote read and is absent from the later Hub read.
  const sourceOnly='99999999-9999-4999-8999-999999999999';
  commercial.rows.push({...commercial.rows.find(row=>row.currentSent)!,projectId:sourceOnly,quoteId:sourceOnly});
  const selectedHub={...hubFixture,projects:hubFixture.projects.filter(p=>p.id!==designer.visits[0].projectId)};
  const ids=new Set(selectedHub.projects.map(p=>p.id));
  const view=renderIntoDocument(<MarketingPerformance synthetic initialFilters={fixtureFilters} initialQuery={query} loader={()=>hub.promise} priorLoader={async()=>fixtureReport} commercialLoader={async()=>commercial} designerLoader={async()=>designer}/>);
  await act(async()=>{});
  expect(view.container.textContent).toContain('Quote source · project filters pending');
  expect(quoteSourceDetails(view.container)).toContain('these source figures will be checked against the completed project selection');
  expect(view.container.querySelector('table[aria-label="Recorded visit conversion"] tbody')?.textContent).toContain('Reading');
  const early=view.container.querySelector('[aria-label="Inspect Quoted value"] strong')?.textContent;
  await act(async()=>hub.resolve(selectedHub));
  expect(view.container.textContent).not.toContain('Quote source · project filters pending');
  expect(quoteSourceDetails(view.container)).not.toContain('these source figures will be checked');
  expect(view.container.querySelector('[aria-label="Inspect Quoted value"] strong')?.textContent).toBe('$12k');
  expect(early).not.toBe('$12k');
  expect(view.container.querySelector('table[aria-label="Recorded visit conversion"] tbody tr td button')?.textContent).toBe(String(designerPerformance(designer,ids).total.attended.length));
  view.unmount();
});
it('withholds project-filtered totals until complete Hub evidence and clears independent values on late access denial',async()=>{
  const hub=deferred<HubReport>(),query=new URLSearchParams({...fixtureFilters,view:'overview',owner:'unassigned'}).toString();window.history.replaceState(null,'','/?'+query);
  const view=renderIntoDocument(<MarketingPerformance synthetic initialFilters={fixtureFilters} initialQuery={query} loader={()=>hub.promise} priorLoader={async()=>fixtureReport} commercialLoader={async()=>commercialFixture(hubFixture,fixtureFilters)} designerLoader={async()=>designerFixture('accepted')}/>);
  await act(async()=>{});expect(view.container.querySelector<HTMLButtonElement>('[aria-label="Inspect Quoted value"]')?.disabled).toBe(true);
  await act(async()=>hub.reject(Object.assign(new Error('Denied'),{status:403})));
  expect(view.container.textContent).toContain('Report access unavailable');expect(view.container.querySelector('[aria-label="Commercial performance"]')).toBeNull();expect(view.container.querySelector('[aria-label="Recorded visit conversion"]')).toBeNull();view.unmount();
});
it('uses the same P&L metric, comparison control and account table while evidence is pending and after it arrives',async()=>{
  const pending=deferred<FinancialEvidence>(),query:FinancialPanelQuery={from:'2026-09-01',to:'2026-09-30',basis:'cash',section:'profit'};
  const params=new URLSearchParams({financeFrom:query.from,financeTo:query.to,financeBasis:query.basis,financeSection:'profit'}).toString();window.history.replaceState(null,'','/?'+params);
  const loader=vi.fn(()=>pending.promise),view=renderIntoDocument(<Financials synthetic initialQuery={params} loader={loader}/>);
  const table=view.container.querySelector('[aria-label="Profit and loss accounts"] table')!,compare=[...view.container.querySelectorAll('label')].find(label=>label.textContent==='Compare with')!.control;
  expect(view.container.textContent).toContain('Reading comparison');expect(view.container.textContent).not.toContain('Comparison unavailable');expect(view.container.textContent).not.toContain('months ·  ·');
  expect(table.textContent).toContain('Account / report row');expect(table.textContent).toContain('Reading source accounts');expect(view.container.textContent).toContain('Revenue');expect(view.container.textContent).not.toContain('$0');
  await act(async()=>pending.resolve(sampleFinancialPanel(query)));
  expect(view.container.querySelector('[aria-label="Profit and loss accounts"] table')).toBe(table);expect([...view.container.querySelectorAll('select')]).toContain(compare);expect(loader).toHaveBeenCalledTimes(1);expect(view.container.textContent).toContain('$183,336');view.unmount();
});

it.each([loadHub,loadCommercial])('recognises access denial before parsing an unavailable response body',async(loader)=>{const json=vi.fn().mockRejectedValue(new Error('Body unavailable'));const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue({status:403,ok:false,json} as unknown as Response);await expect(loader(fixtureFilters,new AbortController().signal)).rejects.toMatchObject({status:403});expect(json).not.toHaveBeenCalled();fetch.mockRestore();});

it('enters Financials on RSC selection without a seed and returns with the latest basis without an old-query request',async()=>{
 const query='view=financials&financeFrom=2026-09-01&financeTo=2026-09-30&financeBasis=accrual&financeSection=profit';window.history.replaceState(null,'','/?'+query);
 const financial=vi.fn(async(query:FinancialPanelQuery)=>sampleFinancialPanel(query));
 const view=renderIntoDocument(<MarketingPerformance synthetic initialQuery={query} initialFilters={fixtureFilters} financialsLoader={financial} loader={async()=>hubFixture} priorLoader={async()=>fixtureReport} commercialLoader={async()=>commercialFixture(hubFixture,fixtureFilters)} designerLoader={async()=>designerFixture()}/>);
 await act(async()=>{});expect(financial).toHaveBeenCalledTimes(1);
 const basis=[...view.container.querySelectorAll('label')].find(label=>label.textContent==='P&L basis')!.control as HTMLSelectElement;
 await act(async()=>{basis.value='cash';basis.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(financial).toHaveBeenCalledTimes(2);
 await act(async()=>[...view.container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(button=>button.textContent==='Business overview')!.click());
 await act(async()=>[...view.container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(button=>button.textContent==='Financials')!.click());
 expect(financial).toHaveBeenCalledTimes(3);expect(financial.mock.calls.map(([query])=>query.basis)).toEqual(['accrual','cash','cash']);view.unmount();
});

it.each(['enquiries','sales','portfolio'] as const)('keeps the actual %s metric/chart/table controls through pending, terminal failure, Retry and complete filtered evidence',async(viewName)=>{
 const pending:ReturnType<typeof deferred<HubReport>>[]=[],query=new URLSearchParams({...fixtureFilters,view:viewName}).toString();window.history.replaceState(null,'','/?'+query);
 const loader=vi.fn(()=>{const next=deferred<HubReport>();pending.push(next);return next.promise;});
 const view=renderIntoDocument(<MarketingPerformance synthetic initialFilters={fixtureFilters} initialQuery={query} loader={loader} priorLoader={async()=>fixtureReport}/>);
 // Module preparation is independent of the deliberately unresolved data read.
 for(let turn=0;turn<20;turn++){await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});if(view.container.querySelector(viewName==='sales'?'[aria-label="Quote activity trend"]':viewName==='portfolio'?'[aria-label="Projects by current stage and state"]':'[aria-label="Weekly enquiry chart"]'))break;}
 const table=view.container.querySelector('[aria-label="Underlying hub records"] table')!,filter=view.container.querySelector('[aria-label="Underlying hub records"]')!.closest('section')?.querySelector('select');
 expect(table.textContent).toContain('Project / record');expect(table.textContent).toContain('Reading complete underlying records');expect(view.container.textContent).not.toContain('Loading evidence');expect(view.container.textContent).not.toContain('0 projects match');expect(view.container.querySelectorAll('tbody a')).toHaveLength(0);
 if(viewName==='sales'){const grouping=[...view.container.querySelectorAll('label')].find(label=>label.textContent==='Group sales by')!.control as HTMLSelectElement;await act(async()=>{grouping.value='month';grouping.dispatchEvent(new Event('change',{bubbles:true}));});expect(grouping.value).toBe('month');}
 await act(async()=>pending[0].reject(new Error('Synthetic source unavailable')));expect(view.container.querySelector('[aria-label="Underlying hub records"] table')).toBe(table);expect(table.textContent).toContain('Underlying records unavailable');expect(view.container.textContent).not.toContain('No matching records.');
 const retry=[...view.container.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Retry')!;await act(async()=>retry.click());expect(loader).toHaveBeenCalledTimes(2);
 await act(async()=>pending[1].resolve({...hubFixture,start:fixtureFilters.start,end:fixtureFilters.end}));expect(view.container.querySelector('[aria-label="Underlying hub records"] table')).toBe(table);if(filter)expect(view.container.contains(filter)).toBe(true);expect(table.textContent).not.toContain('Reading complete underlying records');expect(table.querySelectorAll('tbody a').length).toBeGreaterThan(0);view.unmount();
});
