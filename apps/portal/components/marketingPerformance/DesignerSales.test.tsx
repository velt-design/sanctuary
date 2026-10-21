import { act,useState } from 'react';
import { it,expect,vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { designerFixture } from '@/app/qa/marketing-performance-fixture/designerFixtures';
import { hubFixture } from '@/app/qa/marketing-performance-fixture/hubFixtures';
import { hubDefaults,hubQuery,parseHubFilters,type HubFilters } from '@/lib/marketingPerformance/hub';
import { fixtureFilters } from '@/app/qa/marketing-performance-fixture/fixtures';
import { unrecordedSalesOutcome,type SalesOutcome } from '@/lib/marketingPerformance/salesOutcome';
import DesignerPerformance from './DesignerPerformance';
import type { OutcomeClient } from './ProjectSalesOutcome';
vi.mock('@/components/ui/drawer/Drawer',()=>({Drawer:({open,children,title}:any)=>open?<div role="dialog" aria-label={title}>{children}</div>:null}));
const filters={...hubDefaults(fixtureFilters),view:'overview' as const},flush=()=>act(async()=>{await Promise.resolve();});
it('lets the owner inspect accepted scopes and record a whole-job refund, retaining history and removing positive visit credit',async()=>{
  const report=designerFixture();let current:SalesOutcome=unrecordedSalesOutcome(report.scopes[0].projectId);
  const client:OutcomeClient={read:async()=>current,record:async(id,c)=>current={projectId:id,outcome:c.outcome,revision:1,updatedAt:report.asOf,basis:c.basis}};
  const view=renderIntoDocument(<DesignerPerformance hub={hubFixture} filters={filters} apply={vi.fn()} loader={async()=>report} outcomeClient={client} synthetic/>);await flush();
  act(()=>view.container.querySelector<HTMLButtonElement>('button[aria-label="Jordan: Accepted jobs"]')!.click());
  const dialog=view.container.querySelector('[role=dialog]')!;expect(dialog.querySelectorAll('ul>li')).toHaveLength(1);expect(dialog.textContent).toContain('Add-on');
  act(()=>[...dialog.querySelectorAll('button')].find(b=>b.textContent==='Record sales outcome')!.click());
  expect(dialog.textContent).toContain('Applies to the whole job');
  act(()=>{const select=dialog.querySelector('select')!;select.value='refunded';select.dispatchEvent(new Event('change',{bubbles:true}));const text=dialog.querySelector('textarea')!;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(text,'Owner confirmed whole-job refund');text.dispatchEvent(new Event('input',{bubbles:true}));});
  act(()=>[...dialog.querySelectorAll('button')].find(b=>b.textContent==='Save outcome')!.click());await flush();
  expect(view.container.querySelector('button[aria-label="Jordan: Accepted jobs"]')!.textContent).toBe('1');expect(view.container.querySelector('button[aria-label="Jordan: Net accepted jobs"]')!.textContent).toBe('0');expect(view.container.querySelector('button[aria-label="Jordan: Excluded jobs"]')!.textContent).toBe('1');
  const visitRow=[...view.container.querySelectorAll('table[aria-label="Recorded visit conversion"] tbody tr')].find(r=>r.querySelector('th')!.textContent==='Jordan')!;
  expect(visitRow.textContent).toContain('0%');expect(dialog.textContent).toContain('Refunded');view.unmount();
});
it('shows no-visit and unassigned acceptance with source withheld, while all-date toggle reveals earlier and undated history',async()=>{
  const report=designerFixture();report.visits=[];report.source.enabled=false;report.start='2026-09-20';report.scopes[2].lastAcceptedAt=null;
  const loader=async()=>report;
  function Harness(){const [f,setF]=useState<HubFilters>({...filters,start:report.start});return <DesignerPerformance hub={hubFixture} filters={f} apply={setF} loader={loader} synthetic/>;}
  const view=renderIntoDocument(<Harness/>);await flush();
  expect(view.container.textContent).toContain('No recorded accepted scopes in this selection');expect(view.container.textContent).toContain('1 jobs have an unknown');
  act(()=>{const select=view.container.querySelectorAll('select')[1];select.value='all';select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(view.container.querySelector('button[aria-label="Team: Accepted jobs"]')!.textContent).toBe('2');expect(view.container.querySelector('button[aria-label="Unassigned: Accepted jobs"]')!.textContent).toBe('1');
  expect(view.container.textContent).toContain('conversion is unavailable');
  expect(parseHubFilters(hubQuery({...filters,designer:'jordan',acceptedDates:'all'}),fixtureFilters)).toMatchObject({designer:'jordan',acceptedDates:'all'});
  expect(parseHubFilters(new URLSearchParams('acceptedDates=invalid'),fixtureFilters).acceptedDates).toBe('selected');view.unmount();
});
