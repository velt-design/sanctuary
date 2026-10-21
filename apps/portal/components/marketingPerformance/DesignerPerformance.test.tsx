import { act } from 'react';
import { it,expect,vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { designerFixture } from '@/app/qa/marketing-performance-fixture/designerFixtures';
import { hubFixture } from '@/app/qa/marketing-performance-fixture/hubFixtures';
import { hubDefaults,parseHubFilters,hubQuery } from '@/lib/marketingPerformance/hub';
import { fixtureFilters } from '@/app/qa/marketing-performance-fixture/fixtures';
import type { DesignerReport } from '@/lib/marketingPerformance/designerContract';
import DesignerPerformance from './DesignerPerformance';
import useDesigner,{type DesignerLoader} from './useDesigner';
vi.mock('@/components/ui/drawer/Drawer',()=>({Drawer:({open,children,title}:any)=>open?<div role="dialog" aria-label={title}>{children}</div>:null}));
const filters={...hubDefaults(fixtureFilters),view:'overview' as const};
const flush=()=>act(async()=>{await Promise.resolve();});
it('shows incomplete activity, unavailable conversion and the undated inventory without inventing conflict',async()=>{
 const report=designerFixture('incomplete'),loader=vi.fn<DesignerLoader>(async()=>report);
 const view=renderIntoDocument(<DesignerPerformance hub={hubFixture} filters={filters} apply={vi.fn()} loader={loader}/>);await flush();
 expect(view.container.textContent).toContain('Conversion is unavailable');expect(view.container.textContent).toContain('further attended visit has no date');
 const review=[...view.container.querySelectorAll('button')].find(b=>b.textContent?.includes('Review dates'))!;act(()=>review.click());
 expect(view.container.querySelector('[role=dialog]')!.textContent).toContain('Date not recorded');expect(view.container.textContent).not.toContain('Conflicting original visits');
 const exact=view.container.querySelector('[role=dialog] a')!;expect(exact.getAttribute('href')).toContain('visit=');expect(exact.getAttribute('target')).toBe('_blank');view.unmount();
});
it('clears stale drilldown records during refresh and filters; recovers after source failure',async()=>{
 const pending:{resolve:(r:DesignerReport)=>void;reject:(e:Error)=>void;signal:AbortSignal}[]=[];
 const loader:DesignerLoader=(_,signal)=>new Promise((resolve,reject)=>pending.push({resolve,reject,signal}));
 const props={hub:hubFixture,filters,apply:vi.fn(),loader};const view=renderIntoDocument(<DesignerPerformance {...props}/>);
 await act(async()=>pending[0].resolve(designerFixture()));act(()=>[...view.container.querySelectorAll('button')].find(b=>b.textContent?.includes('Attended visits'))!.click());expect(view.container.querySelector('[role=dialog]')).not.toBeNull();
 view.rerender(<DesignerPerformance {...props} revision={1}/>);expect(view.container.querySelector('[role=dialog]')).toBeNull();expect(pending[0].signal.aborted).toBe(true);
 await act(async()=>pending[1].reject(new Error('Unavailable source')));expect(view.container.textContent).toContain('No partial totals');
 act(()=>[...view.container.querySelectorAll('button')].find(b=>b.textContent==='Retry')!.click());await act(async()=>pending[2].resolve(designerFixture()));expect(view.container.textContent).toContain('Small cohort');view.unmount();
});
it('uses request identity for dates without refetching local designer selection',async()=>{
 const loader=vi.fn<DesignerLoader>(async f=>({...designerFixture(),start:f.start,end:f.end}));
 function Harness({f}:{f:typeof filters}){const state=useDesigner(f,0,loader);return <p>{state.busy?'Loading':state.report?.start}</p>;}
 const view=renderIntoDocument(<Harness f={filters}/>);await flush();view.rerender(<Harness f={{...filters,designer:'jp'}}/>);expect(loader).toHaveBeenCalledTimes(1);
 view.rerender(<Harness f={{...filters,start:'2026-09-10'}}/>);expect(view.container.textContent).toBe('Loading');await flush();expect(view.container.textContent).toBe('2026-09-10');view.unmount();
});
it('keeps selected attendee separate from owner in serialized report filters',()=>{
 const query=hubQuery({...filters,designer:'jp',owner:'dave'});expect(parseHubFilters(query,fixtureFilters)).toMatchObject({designer:'jp',owner:'dave'});
});
it('labels disabled-source activity as manual-only and leaves conversion unavailable',async()=>{
 const loader:DesignerLoader=async()=>designerFixture('disabled');const view=renderIntoDocument(<DesignerPerformance hub={hubFixture} filters={filters} apply={vi.fn()} loader={loader}/>);await flush();
 expect(view.container.textContent).toContain('Outlook records are withheld');expect(view.container.textContent).toContain('manual history only');expect(view.container.textContent).toContain('conversion is unavailable');view.unmount();
});
