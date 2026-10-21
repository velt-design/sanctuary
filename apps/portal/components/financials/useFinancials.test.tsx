import { act } from 'react';
import { expect,it,vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import useFinancials,{FinancialAccessError,type FinancialsLoader} from './useFinancials';
import type { Financials,FinancialsQuery,FinancialPanel,FinancialPanelQuery } from '@/lib/xero/financials/contract';
import { sampleFinancials,sampleFinancialPanel } from '@/app/qa/marketing-performance-fixture/financialFixtures';
const query={from:'2026-09-01',to:'2026-09-30',basis:'accrual' as const};
function Harness({query,revision=0,loader}:{query:FinancialsQuery & {section?:FinancialPanelQuery['section']};revision?:number;loader:FinancialsLoader}){
  const state=useFinancials(query,revision,loader);return <div>{JSON.stringify({basis:state.report?.position.query.basis,busy:state.busy,error:state.error,bank:state.report?.position.bankSummary.status,retainedBank:state.retained?.position.bankSummary.status,profitEvidence:state.profitEvidence?.checkedAt})}</div>;
}
it('cancels a superseded section read, rejects a mismatched panel, and clears all retained evidence on denial',async()=>{
 const pending:Array<{query:FinancialPanelQuery;signal:AbortSignal;resolve:(value:FinancialPanel)=>void;reject:(error:Error)=>void}>=[];
 const loader:FinancialsLoader=(query,signal)=>new Promise((resolve,reject)=>pending.push({query,signal,resolve,reject}));
 const view=renderIntoDocument(<Harness query={{...query,section:'bank'}} loader={loader}/>);
 view.rerender(<Harness query={{...query,section:'payables'}} loader={loader}/>);
 expect(pending[0].signal.aborted).toBe(true);expect(pending[1].query.section).toBe('payables');
 await act(async()=>pending[1].resolve(sampleFinancialPanel({...query,section:'payables'})));
 await act(async()=>pending[0].resolve(sampleFinancialPanel({...query,section:'bank'})));
 expect(JSON.parse(view.container.textContent!)).toMatchObject({bank:'not_requested',busy:false});
 view.rerender(<Harness query={{...query,section:'payables'}} revision={1} loader={loader}/>);
 await act(async()=>pending[2].resolve(sampleFinancialPanel({...query,section:'bank'})));
 expect(JSON.parse(view.container.textContent!).error).toContain('different financial section');
 view.rerender(<Harness query={{...query,section:'payables'}} revision={2} loader={loader}/>);
 await act(async()=>pending[3].reject(new FinancialAccessError('Denied')));
 expect(JSON.parse(view.container.textContent!)).toEqual({busy:false,error:'Denied'});view.unmount();
});
function deferred(){const pending:Array<{signal:AbortSignal;resolve:(data:Financials)=>void;reject:(error:Error)=>void}>=[];return {pending,loader:vi.fn<FinancialsLoader>((_query,signal)=>new Promise((resolve,reject)=>pending.push({signal,resolve,reject})))};}
it('rapid changes cancel old reads and ignore late responses without erasing dated data',async()=>{
  const {loader,pending}=deferred(),view=renderIntoDocument(<Harness query={query} loader={loader}/>);
  await act(async()=>pending[0].resolve(sampleFinancials(query)));
  view.rerender(<Harness query={{...query,basis:'cash'}} loader={loader}/>);
  expect(pending[0].signal.aborted).toBe(true);expect(JSON.parse(view.container.textContent!).basis).toBe('accrual');
  await act(async()=>pending[1].resolve(sampleFinancials({...query,basis:'cash'})));
  await act(async()=>pending[0].resolve(sampleFinancials(query)));
  expect(JSON.parse(view.container.textContent!)).toMatchObject({basis:'cash',busy:false,error:''});view.unmount();
});
it('retains per-family evidence after a failed refresh, but clears private evidence when access is denied',async()=>{
  const {loader,pending}=deferred(),view=renderIntoDocument(<Harness query={query} loader={loader}/>);
  await act(async()=>pending[0].resolve(sampleFinancials(query)));
  view.rerender(<Harness query={query} revision={1} loader={loader}/>);
  await act(async()=>pending[1].resolve(sampleFinancials(query,'bank-failure')));
  expect(JSON.parse(view.container.textContent!)).toMatchObject({bank:'unavailable',retainedBank:'available'});
  view.rerender(<Harness query={query} revision={2} loader={loader}/>);
  await act(async()=>pending[2].reject(new Error('Retry source')));
  expect(JSON.parse(view.container.textContent!)).toMatchObject({bank:'unavailable',retainedBank:'available',error:'Retry source'});
  view.rerender(<Harness query={query} revision={3} loader={loader}/>);
  await act(async()=>pending[3].reject(new FinancialAccessError('Denied')));
  expect(JSON.parse(view.container.textContent!)).toEqual({busy:false,error:'Denied'});view.unmount();
});
it('does not carry a failed-family fallback across different periods or accounting bases',async()=>{
  const {loader,pending}=deferred(),view=renderIntoDocument(<Harness query={query} loader={loader}/>);
  await act(async()=>pending[0].resolve(sampleFinancials(query)));
  const cash={...query,basis:'cash' as const};view.rerender(<Harness query={cash} loader={loader}/>);
  await act(async()=>pending[1].resolve(sampleFinancials(cash,'bank-failure')));
  expect(JSON.parse(view.container.textContent!)).toMatchObject({basis:'cash',retainedBank:'unavailable'});view.unmount();
});
