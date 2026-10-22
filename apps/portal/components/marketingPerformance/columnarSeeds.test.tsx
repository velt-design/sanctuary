import { act, StrictMode } from 'react';
import { expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { hubFixture } from '@/app/qa/marketing-performance-fixture/hubFixtures';
import { fixtureFilters } from '@/app/qa/marketing-performance-fixture/fixtures';
import { commercialFixture } from '@/app/qa/marketing-performance-fixture/commercialFixtures';
import { designerFixture } from '@/app/qa/marketing-performance-fixture/designerFixtures';
import { columnarRead, type ColumnarReport } from '@/lib/marketingPerformance/columnarReports';
import type { InitialHubSeed } from '@/lib/marketingPerformance/initialHub';
import type { InitialReport } from '@/lib/marketingPerformance/reportRead';
import type { CommercialReport } from '@/lib/marketingPerformance/commercial';
import type { DesignerReport } from '@/lib/marketingPerformance/designerContract';
import useHub from './useHub';
import useCommercial from './useCommercial';
import useDesigner from './useDesigner';

const commercial = commercialFixture(hubFixture, fixtureFilters), designer = designerFixture();
// The real Flight Promise inherits Promise.prototype but then returns void.
const flight = <T,>(value:T) => Object.create(Promise.prototype, { then: { value: (yes:(value:T)=>void) => { yes(value); } } }) as Promise<T>;
const key = `${fixtureFilters.start}:${fixtureFilters.end}`;
const seeds = () => ({
  hub: { ...fixtureFilters, result: flight(columnarRead('hub', { ok:true as const, report:hubFixture })) } satisfies InitialHubSeed,
  commercial: { key, result:flight(columnarRead('commercial', { ok:true as const, report:commercial })) } satisfies InitialReport<CommercialReport|ColumnarReport>,
  designer: { key, result:flight(columnarRead('designer', { ok:true as const, report:designer })) } satisfies InitialReport<DesignerReport|ColumnarReport>,
});
const loaders = () => ({ hub:vi.fn(async()=>hubFixture),commercial:vi.fn(async()=>commercial),designer:vi.fn(async()=>designer) });
function Harness({initial,readers,commercialRevision=0}:{initial:ReturnType<typeof seeds>;readers:ReturnType<typeof loaders>;commercialRevision?:number}) {
  const hub = useHub(fixtureFilters,0,readers.hub,undefined,false,initial.hub);
  const c = useCommercial(fixtureFilters,commercialRevision,readers.commercial,initial.commercial);
  const d = useDesigner(fixtureFilters,0,readers.designer,initial.designer);
  return <div>{JSON.stringify({hub:hub.hub,commercial:c.report,designer:d.report,errors:[hub.error,c.error,d.error],busy:[hub.busy,c.busy,d.busy]})}</div>;
}
it('consumes all nine decoded arrays under StrictMode/void-returning Flight without duplicate reads, then refreshes only the selected reader', async()=>{
  const initial=seeds(),readers=loaders();
  const view=renderIntoDocument(<StrictMode><Harness initial={initial} readers={readers}/></StrictMode>);
  await act(async()=>{});
  expect(JSON.parse(view.container.textContent!)).toStrictEqual({hub:hubFixture,commercial,designer,errors:['','',''],busy:[false,false,false]});
  expect(readers.hub).not.toHaveBeenCalled();expect(readers.commercial).not.toHaveBeenCalled();expect(readers.designer).not.toHaveBeenCalled();
  view.rerender(<StrictMode><Harness initial={initial} readers={readers} commercialRevision={1}/></StrictMode>);await act(async()=>{});
  expect(readers.commercial).toHaveBeenCalledOnce();expect(readers.hub).not.toHaveBeenCalled();expect(readers.designer).not.toHaveBeenCalled();view.unmount();
});
it('withholds malformed column evidence and recovers through the same ordinary API while independent reports remain complete',async()=>{
  const initial=seeds(),readers=loaders();
  initial.commercial.result=flight({ok:true,report:{format:'marketing-columns-v1',kind:'commercial',report:{...commercial,rows:{fields:['quoteId'],count:1,columns:[[]]}}}});
  const view=renderIntoDocument(<Harness initial={initial} readers={readers}/>);await act(async()=>{});
  expect(JSON.parse(view.container.textContent!)).toMatchObject({hub:hubFixture,commercial:null,designer,errors:['',expect.stringContaining('No partial totals'),''],busy:[false,false,false]});
  expect(readers.commercial).not.toHaveBeenCalled();
  view.rerender(<Harness initial={initial} readers={readers} commercialRevision={1}/>);await act(async()=>{});
  expect(JSON.parse(view.container.textContent!)).toMatchObject({hub:hubFixture,commercial,designer,errors:['','','']});
  expect(readers.commercial).toHaveBeenCalledOnce();expect(readers.hub).not.toHaveBeenCalled();expect(readers.designer).not.toHaveBeenCalled();view.unmount();
});
