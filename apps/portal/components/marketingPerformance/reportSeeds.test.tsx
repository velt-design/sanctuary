import {act,StrictMode} from 'react';
import {expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../test/reactHarness';
import {fixtureFilters} from '@/app/qa/marketing-performance-fixture/fixtures';
import {commercialFixture} from '@/app/qa/marketing-performance-fixture/commercialFixtures';
import {hubFixture} from '@/app/qa/marketing-performance-fixture/hubFixtures';
import {designerFixture} from '@/app/qa/marketing-performance-fixture/designerFixtures';
import type {InitialReport,ReportRead} from '@/lib/marketingPerformance/reportRead';
import type {Filters} from '@/lib/marketingPerformance/contract';
import type {CommercialReport} from '@/lib/marketingPerformance/commercial';
import type {DesignerReport} from '@/lib/marketingPerformance/designerContract';
import useCommercial,{type CommercialLoader} from './useCommercial';
import useDesigner,{type DesignerLoader} from './useDesigner';
const commercial=commercialFixture(hubFixture,fixtureFilters),designer=designerFixture();
function flight<T>(){
 const subscribers:Array<{yes:(value:T)=>void;no:(reason:unknown)=>void}>=[];
 let settled:{value:T}|{error:unknown}|undefined;
 const result=Object.assign(Object.create(Promise.prototype),{then(yes:(value:T)=>void,no:(error:unknown)=>void){if(settled){if('value'in settled)yes(settled.value);else no(settled.error);}else subscribers.push({yes,no});}}) as Promise<T>;
 return {result,resolve(value:T){settled={value};subscribers.forEach(s=>s.yes(value));},reject(error:unknown){settled={error};subscribers.forEach(s=>s.no(error));}};
}
function Commercial({filters=fixtureFilters,revision=0,loader,seed,skip=false}:{filters?:Filters|null;revision?:number;loader:CommercialLoader;seed:InitialReport<CommercialReport>;skip?:boolean}){const s=useCommercial(filters,revision,loader,seed,skip);return <div>{JSON.stringify({busy:s.busy,error:s.error,start:s.report?.start})}</div>;}
function Designer({revision=0,loader,seed}:{revision?:number;loader:DesignerLoader;seed:InitialReport<DesignerReport>}){const s=useDesigner(fixtureFilters,revision,loader,seed);return <div>{JSON.stringify({busy:s.busy,error:s.error,start:s.report?.start})}</div>;}
it('normalizes pending and already-fulfilled Flight thenables in Strict Mode with no duplicate Overview APIs',async()=>{
 for(const already of [false,true]){
  const f=flight<ReportRead<CommercialReport>>(),seed={key:`${commercial.start}:${commercial.end}`,result:f.result},loader=vi.fn<CommercialLoader>(async()=>commercial);
  if(already)f.resolve({ok:true,report:commercial});
  const view=renderIntoDocument(<StrictMode><Commercial seed={seed} loader={loader}/></StrictMode>);
  await act(async()=>{if(!already)f.resolve({ok:true,report:commercial});});
  expect(loader).not.toHaveBeenCalled();expect(view.container.textContent).toContain('"busy":false');
  view.rerender(<Commercial seed={seed} loader={loader} revision={1}/>);await act(async()=>{});expect(loader).toHaveBeenCalledOnce();view.unmount();
 }
 const f=flight<ReportRead<DesignerReport>>(),loader=vi.fn<DesignerLoader>(async()=>designer),seed={key:`${designer.start}:${designer.end}`,result:f.result};
 const view=renderIntoDocument(<StrictMode><Designer loader={loader} seed={seed}/></StrictMode>);await act(async()=>f.resolve({ok:true,report:designer}));expect(loader).not.toHaveBeenCalled();expect(view.container.textContent).toContain('"busy":false');view.unmount();
});
it('shows a safe seed failure, retries through the API and never revives a retired date/selection seed',async()=>{
 const f=flight<ReportRead<CommercialReport>>(),seed={key:`${commercial.start}:${commercial.end}`,result:f.result},loader=vi.fn<CommercialLoader>(async filters=>({...commercial,start:filters.start,end:filters.end}));
 const view=renderIntoDocument(<Commercial seed={seed} loader={loader}/>);await act(async()=>f.resolve({ok:false,status:503,error:'Commercial unavailable. Retry.'}));expect(view.container.textContent).toContain('Commercial unavailable');expect(loader).not.toHaveBeenCalled();
 view.rerender(<Commercial seed={seed} loader={loader} revision={1}/>);await act(async()=>{});expect(loader).toHaveBeenCalledOnce();view.unmount();
 const late=flight<ReportRead<CommercialReport>>(),later={...seed,result:late.result},second=vi.fn<CommercialLoader>(async filters=>({...commercial,start:filters.start}));
 const active=renderIntoDocument(<Commercial seed={later} loader={second}/>);
 active.rerender(<Commercial seed={later} loader={second} filters={{...fixtureFilters,start:'2026-09-02'}}/>);await act(async()=>{});
 active.rerender(<Commercial seed={later} loader={second}/>);await act(async()=>late.resolve({ok:true,report:commercial}));expect(second).toHaveBeenCalledTimes(2);
 active.rerender(<Commercial seed={later} loader={second} filters={null} skip/>);active.rerender(<Commercial seed={later} loader={second}/>);await act(async()=>{});expect(second).toHaveBeenCalledTimes(3);active.unmount();
});
it('ignores an abandoned seed and starts the current loader when its identity changes',async()=>{
 const f=flight<ReportRead<CommercialReport>>(),seed={key:`${commercial.start}:${commercial.end}`,result:f.result},first=vi.fn<CommercialLoader>(async()=>commercial),second=vi.fn<CommercialLoader>(async()=>commercial);
 const view=renderIntoDocument(<Commercial seed={seed} loader={first}/>);view.rerender(<Commercial seed={seed} loader={second}/>);await act(async()=>f.reject(new Error('private provider details')));expect(first).not.toHaveBeenCalled();expect(second).toHaveBeenCalledOnce();expect(view.container.textContent).not.toContain('private');view.unmount();
});
