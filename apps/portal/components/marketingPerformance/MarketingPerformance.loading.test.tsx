import { act } from 'react';
import { expect,it,vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import MarketingPerformance from './MarketingPerformance';
import {hubFixture} from '@/app/qa/marketing-performance-fixture/hubFixtures';
import {fixtureFilters,fixtureReport} from '@/app/qa/marketing-performance-fixture/fixtures';
import {commercialFixture} from '@/app/qa/marketing-performance-fixture/commercialFixtures';
import {designerFixture} from '@/app/qa/marketing-performance-fixture/designerFixtures';
import type {HubReport} from '@/lib/marketingPerformance/hub';
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
