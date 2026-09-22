import { act } from 'react';
import { expect,it,vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { hubFixture } from '@/app/qa/marketing-performance-fixture/hubFixtures';
import { fixtureFilters,fixtureReport } from '@/app/qa/marketing-performance-fixture/fixtures';
import type { Filters } from '@/lib/marketingPerformance/contract';
import type { HubReport } from '@/lib/marketingPerformance/hub';
import useHub,{type HubLoader} from './useHub';
import type { ReportLoader } from './useMarketingReports';

function Harness({filters,loader,prior}:{filters:Filters;loader:HubLoader;prior:ReportLoader}) {
  const state=useHub(filters,0,loader,prior);
  return <div>{JSON.stringify({busy:state.busy,start:state.hub?.start,error:state.error,comparisonError:state.comparisonError})}</div>;
}
it('ignores stale hub reads and reuses a complete snapshot for local filters',async()=>{
  const pending:Array<{signal:AbortSignal;resolve:(hub:HubReport)=>void}>=[];
  const loader=vi.fn<HubLoader>((_,signal)=>new Promise(resolve=>pending.push({signal,resolve})));
  const prior=vi.fn<ReportLoader>(async()=>fixtureReport);
  const rendered=renderIntoDocument(<Harness filters={fixtureFilters} loader={loader} prior={prior}/>);
  const next={...fixtureFilters,start:'2026-09-16'};
  rendered.rerender(<Harness filters={next} loader={loader} prior={prior}/>);
  expect(pending[0].signal.aborted).toBe(true);
  await act(async()=>pending[1].resolve({...hubFixture,start:next.start}));
  await act(async()=>pending[0].resolve(hubFixture));
  expect(JSON.parse(rendered.container.textContent!)).toMatchObject({start:next.start,busy:false,error:''});
  rendered.rerender(<Harness filters={{...next,source:'meta'}} loader={loader} prior={prior}/>);
  expect(loader).toHaveBeenCalledTimes(2);rendered.unmount();
});
it('retains current evidence when comparison fails, and never substitutes a zero hub after a failed read',async()=>{
  const unavailable:ReportLoader=async()=>{throw new Error('Unavailable');};
  const loader:HubLoader=async()=>hubFixture;
  const rendered=renderIntoDocument(<Harness filters={fixtureFilters} loader={loader} prior={unavailable}/>);
  await act(async()=>{});
  expect(JSON.parse(rendered.container.textContent!)).toMatchObject({start:fixtureFilters.start,error:'',comparisonError:'Previous-period evidence unavailable.'});
  const failed:HubLoader=async()=>{throw new Error('Read failed');};
  rendered.rerender(<Harness filters={fixtureFilters} loader={failed} prior={unavailable}/>);await act(async()=>{});
  expect(JSON.parse(rendered.container.textContent!)).toEqual({busy:false,error:'Read failed',comparisonError:'Previous-period evidence unavailable.'});
  rendered.unmount();
});
