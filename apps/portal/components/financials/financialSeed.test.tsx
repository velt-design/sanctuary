import {act,StrictMode} from 'react';
import {expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../test/reactHarness';
import {sampleFinancialPanel} from '@/app/qa/marketing-performance-fixture/financialFixtures';
import {financialRequestKey,type FinancialPanelQuery,type FinancialEvidence} from '@/lib/xero/financials/contract';
import type {InitialReport,ReportRead} from '@/lib/marketingPerformance/reportRead';
import useFinancials,{type FinancialsLoader} from './useFinancials';
const query:FinancialPanelQuery={from:'2026-09-01',to:'2026-09-30',basis:'accrual',section:'profit'};
function pending(){let resolve!:(result:ReportRead<FinancialEvidence>)=>void;return {result:new Promise<ReportRead<FinancialEvidence>>(yes=>{resolve=yes;}),resolve:(result:ReportRead<FinancialEvidence>)=>resolve(result)};}
function Harness({selection=query,loader,seed,revision=0}:{selection?:FinancialPanelQuery;loader:FinancialsLoader;seed:InitialReport<FinancialEvidence>;revision?:number}){const r=useFinancials(selection,revision,loader,seed);return <div>{JSON.stringify({busy:r.busy,error:r.error,section:r.report&&'requestedSection'in r.report?r.report.requestedSection:undefined,basis:r.report?.position.query.basis})}</div>;}
it('uses exactly the matching full initial Financial report, while refresh uses the API',async()=>{
 const f=pending(),seed={key:financialRequestKey(query),result:f.result},loader=vi.fn<FinancialsLoader>(async q=>sampleFinancialPanel(q));
 const view=renderIntoDocument(<StrictMode><Harness seed={seed} loader={loader}/></StrictMode>);await act(async()=>f.resolve({ok:true,report:sampleFinancialPanel(query)}));expect(loader).not.toHaveBeenCalled();expect(view.container.textContent).toContain('"section":"profit"');
 view.rerender(<Harness seed={seed} loader={loader} revision={1}/>);await act(async()=>{});expect(loader).toHaveBeenCalledOnce();view.unmount();
});
it('retires a pending seed on section/basis changes, ignores late completion and recovers from denial',async()=>{
 const f=pending(),seed={key:financialRequestKey(query),result:f.result},loader=vi.fn<FinancialsLoader>(async q=>sampleFinancialPanel(q));
 const view=renderIntoDocument(<Harness seed={seed} loader={loader}/>);view.rerender(<Harness seed={seed} loader={loader} selection={{...query,section:'bank'}}/>);await act(async()=>{});
 view.rerender(<Harness seed={seed} loader={loader} selection={{...query,basis:'cash'}}/>);await act(async()=>f.resolve({ok:true,report:sampleFinancialPanel(query)}));expect(loader).toHaveBeenCalledTimes(2);expect(view.container.textContent).toContain('"basis":"cash"');view.unmount();
 const denied=pending(),next={...seed,result:denied.result},current=renderIntoDocument(<Harness seed={next} loader={loader}/>);await act(async()=>denied.resolve({ok:false,status:403,error:'Current access required'}));expect(current.container.textContent).toContain('Current access required');expect(current.container.textContent).not.toContain('"section"');current.rerender(<Harness seed={next} loader={loader} revision={1}/>);await act(async()=>{});expect(loader).toHaveBeenCalledTimes(3);current.unmount();
});

it('supports fulfilled void-returning Flight thenables and cannot resurrect a seed after A to B to A',async()=>{
 const full=sampleFinancialPanel(query);
 const flight=Object.create(Promise.prototype,{then:{value:(yes:(value:ReportRead<FinancialEvidence>)=>void)=>{yes({ok:true,report:full});}}}) as Promise<ReportRead<FinancialEvidence>>;
 const seed={key:financialRequestKey(query),result:flight},loader=vi.fn<FinancialsLoader>(async q=>sampleFinancialPanel(q));
 const view=renderIntoDocument(<StrictMode><Harness seed={seed} loader={loader}/></StrictMode>);await act(async()=>{});expect(loader).not.toHaveBeenCalled();expect(view.container.textContent).toContain('"section":"profit"');
 view.rerender(<Harness seed={seed} loader={loader} selection={{...query,basis:'cash'}}/>);await act(async()=>{});view.rerender(<Harness seed={seed} loader={loader}/>);await act(async()=>{});expect(loader).toHaveBeenCalledTimes(2);view.unmount();
});
