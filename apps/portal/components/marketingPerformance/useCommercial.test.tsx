import { act } from 'react';
import { expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { hubFixture } from '@/app/qa/marketing-performance-fixture/hubFixtures';
import { fixtureFilters } from '@/app/qa/marketing-performance-fixture/fixtures';
import { commercialFixture } from '@/app/qa/marketing-performance-fixture/commercialFixtures';
import type { Filters } from '@/lib/marketingPerformance/contract';
import type { CommercialReport } from '@/lib/marketingPerformance/commercial';
import useCommercial, { type CommercialLoader } from './useCommercial';
import CommercialRecords from './CommercialRecords';
import { contributions } from '@/lib/marketingPerformance/commercial';
const report = commercialFixture(hubFixture,fixtureFilters);
function Harness({filters,loader,revision=0}:{filters:Filters;loader:CommercialLoader;revision?:number}) {
 const state=useCommercial(filters,revision,loader);return <div>{JSON.stringify({busy:state.busy,start:state.report?.start,error:state.error})}</div>;
}
it('aborts stale requests, resets on refresh/date change, retains local source filtering, and recovers after failure',async()=>{
 const pending:Array<{signal:AbortSignal;resolve:(r:CommercialReport)=>void;reject:(e:Error)=>void}>=[];
 const loader=vi.fn<CommercialLoader>((_,signal)=>new Promise((resolve,reject)=>pending.push({signal,resolve,reject})));
 const view=renderIntoDocument(<Harness filters={fixtureFilters} loader={loader}/>);
 await act(async()=>pending[0].resolve(report));
 view.rerender(<Harness filters={{...fixtureFilters,source:'google'}} loader={loader}/>);expect(loader).toHaveBeenCalledTimes(1);
 const next={...fixtureFilters,start:'2026-09-16'};
 view.rerender(<Harness filters={next} loader={loader}/>);expect(pending[0].signal.aborted).toBe(true);expect(view.container.textContent).not.toContain(report.start);
 await act(async()=>pending[1].reject(new Error('Unavailable')));expect(view.container.textContent).toContain('Unavailable');
 view.rerender(<Harness filters={next} loader={loader} revision={1}/>);
 expect(view.container.textContent).not.toContain('Unavailable');
 await act(async()=>pending[2].resolve({...report,start:next.start}));expect(view.container.textContent).toContain(next.start);view.unmount();
});
it('production project inspection preserves the report in its original tab and labels that behaviour',()=>{
 const rows=contributions(report,report.rows).quoted;
 const view=renderIntoDocument(<CommercialRecords metric="quoted" rows={rows} projects={new Map(hubFixture.projects.map(p=>[p.id,p]))} summary="Synthetic amount"/>);
 const link=view.container.querySelector('a')!;expect(link.target).toBe('_blank');expect(link.rel).toContain('noopener');expect(link.getAttribute('aria-label')).toContain('report stays open');expect(link.href).toContain('?tab=quotes');view.unmount();
});
