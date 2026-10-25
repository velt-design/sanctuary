import {act,Profiler} from 'react';
import { afterEach,expect,it,vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import Financials from './Financials';
import OutstandingView from './OutstandingView';
import {sampleFinancialPanel} from '@/app/qa/marketing-performance-fixture/financialFixtures';
import type {FinancialPanel} from '@/lib/xero/financials/contract';
import { sampleFinancials } from '@/app/qa/marketing-performance-fixture/financialFixtures';
import type { Financials as FinancialsData, FinancialsQuery } from '@/lib/xero/financials/contract';
const query={from:'2026-09-01',to:'2026-09-30',basis:'accrual' as const};
afterEach(()=>window.history.replaceState(null,'','/'));
it('opens the selected account after reload and preserves basis/comparison when switching sections',async()=>{
  window.history.replaceState(null,'','/?view=financials&financeFrom=2026-09-01&financeTo=2026-09-30&financeBasis=cash&financeSection=profit&financeCompare=yearAgo&financeDetail=account%3A10000000-0000-4000-8000-000000000003');
  const loader=vi.fn(async (query:FinancialsQuery)=>sampleFinancials(query)),view=renderIntoDocument(<Financials loader={loader} synthetic/>);
  await act(async()=>{});
  expect(document.body.textContent).toContain('Materials');expect(document.body.textContent).toContain('2025-09-01');
  const close=document.querySelector<HTMLButtonElement>('[aria-label="Close Materials"]')!;act(()=>close.click());
  const bank=[...view.container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(button=>button.textContent==='Bank balances')!;await act(async()=>bank.click());
  expect(view.container.textContent).toContain('Opening Balance');expect(window.location.search).toContain('financeSection=bank');expect(window.location.search).toContain('financeBasis=cash');expect(window.location.search).toContain('financeCompare=yearAgo');expect(loader).toHaveBeenCalledTimes(2);view.unmount();
});
it('ageing drilldown matches the exact currency population and does not include a second currency',()=>{
  const report=sampleFinancials(query),family=report.position.receivables;if(family.status!=='available')throw new Error('fixture');
  const view=renderIntoDocument(<OutstandingView family={family} payable={false} onDetail={()=>{}} baseCurrency="NZD"/>);
  const currency=view.container.querySelector<HTMLElement>('[aria-label="AUD balances"]')!;
  const band=[...currency.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent?.startsWith('1–30'))!;act(()=>band.click());
  const rows=view.container.querySelectorAll('tbody tr');expect(rows).toHaveLength(1);expect(rows[0].textContent).toContain('AUD');expect(rows[0].textContent).not.toContain('NZD');view.unmount();
});
it('missing comparison and partial families stay explicit with retry while current profit remains visible',async()=>{
  window.history.replaceState(null,'','/?financeFrom=2026-09-01&financeTo=2026-09-30&financeBasis=accrual');
  const view=renderIntoDocument(<Financials loader={async query=>sampleFinancials(query,'partial')} synthetic/>);await act(async()=>{});
  expect(view.container.textContent).toContain('$201,468');expect(view.container.textContent).toContain('Comparison unavailable');
  const bills=[...view.container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(button=>button.textContent==='Bills to pay')!;await act(async()=>bills.click());
  expect(view.container.textContent).toContain('Bills to pay unavailable');
  const details=[...view.container.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Details')!;act(()=>details.click());
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('does not currently grant');expect(view.container.querySelector('tbody')?.textContent).toContain('Document evidence unavailable');expect(view.container.querySelectorAll('tbody button')).toHaveLength(0);view.unmount();
});
it('keeps one status row and dated evidence through a changed selection, failed read and retry',async()=>{
  window.history.replaceState(null,'','/?financeFrom=2026-09-02&financeTo=2026-09-30&financeBasis=accrual');
  const selected={...query,from:'2026-09-02'},pending:Array<{resolve:(value:FinancialsData)=>void;reject:(error:Error)=>void}>=[];
  const loader=vi.fn(()=>new Promise<FinancialsData>((resolve,reject)=>pending.push({resolve,reject})));
  const view=renderIntoDocument(<Financials loader={loader} synthetic/>);await act(async()=>pending[0].resolve(sampleFinancials(selected)));
  const region=view.container.querySelector('#financial-results')!,children=region.children.length,status=region.firstElementChild;
  const basis=view.container.querySelector<HTMLSelectElement>('select[aria-label="P&L basis"]')??view.container.querySelectorAll<HTMLSelectElement>('select')[1];
  act(()=>{basis.value='cash';basis.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(region.children.length).toBe(children);expect(region.firstElementChild).toBe(status);expect(region.textContent).toContain('Updating · earlier report shown');
  expect(region.textContent).toContain('2026-09-02 to 2026-09-30 · NZD · accrual');expect(region.textContent).toContain('partial calendar month');
  await act(async()=>pending[1].reject(new Error('Source offline')));
  expect(region.children.length).toBe(children);expect(region.textContent).toContain('Financial reports unavailable');
  const retry=[...region.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Retry')!;act(()=>retry.click());
  await act(async()=>pending[2].resolve(sampleFinancials({...selected,basis:'cash'})));
  expect(region.children.length).toBe(children);expect(region.textContent).toContain('2026-09-02 to 2026-09-30 · NZD · cash');view.unmount();
});

it.each(['bank','receivables','payables'] as const)('keeps the actual %s table and safe controls through initial failure, Retry and genuine rows',async section=>{
 const params=`financeSection=${section}&financeFrom=2026-09-01&financeTo=2026-09-30&financeBasis=accrual`;window.history.replaceState(null,'','/?'+params);
 const waiting:Array<{resolve:(value:FinancialPanel)=>void;reject:(error:Error)=>void}>=[],loader=vi.fn(()=>new Promise<FinancialPanel>((resolve,reject)=>waiting.push({resolve,reject})));
 const view=renderIntoDocument(<Financials loader={loader} synthetic initialQuery={params}/>);const table=view.container.querySelector('table')!,input=view.container.querySelector<HTMLInputElement>('input:not([type="checkbox"])');
 expect(table.textContent).toContain(section==='bank'?'Bank account':'Issued');expect(table.textContent).toContain('Reading');expect(view.container.textContent).not.toContain('No outstanding');expect(view.container.textContent).not.toContain('No matching');expect(view.container.textContent).not.toContain('$0');
 if(input)act(()=>{const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!;set.call(input,'Sample');input.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>waiting[0].reject(new Error('Source offline')));expect(view.container.querySelector('table')).toBe(table);expect(table.textContent).toContain('unavailable');
 const retry=[...view.container.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Retry')!;await act(async()=>retry.click());await act(async()=>waiting[1].resolve(sampleFinancialPanel({...query,section})));
 expect(view.container.querySelector('table')).toBe(table);if(input){expect(view.container.contains(input)).toBe(true);expect(input.value).toBe('Sample');}expect(table.querySelectorAll('tbody button').length).toBeGreaterThan(0);view.unmount();
});

it('never commits a failed/unavailable state for a newly selected AR/AP/basis request before that request has failed',async()=>{
 const params='financeSection=receivables&financeFrom=2026-09-01&financeTo=2026-09-30&financeBasis=accrual';window.history.replaceState(null,'','/?'+params);
 const waiting:Array<{resolve:(value:FinancialPanel)=>void;reject:(error:Error)=>void}>=[],loader=vi.fn(()=>new Promise<FinancialPanel>((resolve,reject)=>waiting.push({resolve,reject})));
 const commits:Array<{section:string;busy:string|null;text:string}>=[];
 const view=renderIntoDocument(<Profiler id="financial-owner" onRender={()=>{const region=document.querySelector('#financial-results');if(region)commits.push({section:document.querySelector('[role="tab"][aria-selected="true"]')?.textContent??'',busy:region.getAttribute('aria-busy'),text:region.textContent??''});}}><Financials loader={loader} initialQuery={params} synthetic/></Profiler>);
 await act(async()=>waiting[0].resolve(sampleFinancialPanel({...query,section:'receivables'})));
 const tab=(text:string)=>[...view.container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(button=>button.textContent===text)!;
 commits.length=0;act(()=>tab('Bills to pay').click());expect(commits.length).toBeGreaterThan(0);expect(commits.every(commit=>commit.busy==='true'&&!commit.text.includes('unavailable')&&!commit.text.includes('Financial reports unavailable'))).toBe(true);
 await act(async()=>waiting[1].resolve(sampleFinancialPanel({...query,section:'payables'})));commits.length=0;
 act(()=>tab('Money owed').click());expect(commits.every(commit=>commit.busy==='true'&&!commit.text.includes('Document evidence unavailable'))).toBe(true);
 await act(async()=>waiting[2].reject(new Error('Actual selected-source failure')));expect(view.container.textContent).toContain('Financial reports unavailable');commits.length=0;
 const basis=view.container.querySelectorAll<HTMLSelectElement>('select')[1];act(()=>{basis.value='cash';basis.dispatchEvent(new Event('change',{bubbles:true}));});expect(commits.length).toBeGreaterThan(0);expect(commits.every(commit=>commit.busy==='true'&&!commit.text.includes('Financial reports unavailable'))).toBe(true);
 await act(async()=>waiting[3].resolve(sampleFinancialPanel({...query,basis:'cash',section:'receivables'})));
 const period=[...view.container.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='2026-09-01 – 2026-09-30')!;act(()=>period.click());const from=[...document.querySelectorAll('label')].find(label=>label.textContent==='From')!.control as HTMLInputElement;
 act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(from,'2026-09-02');from.dispatchEvent(new Event('input',{bubbles:true}));});commits.length=0;
 act(()=>[...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(button=>button.textContent==='Apply')!.click());expect(commits.length).toBeGreaterThan(0);expect(commits.every(commit=>commit.busy==='true'&&!commit.text.includes('Financial reports unavailable'))).toBe(true);
 await act(async()=>waiting[4].reject(new Error('Date read failed')));expect(view.container.textContent).toContain('Financial reports unavailable');expect(view.container.textContent).toContain('2026-09-02');view.unmount();
});
