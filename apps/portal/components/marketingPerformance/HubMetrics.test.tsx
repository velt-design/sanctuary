import { act } from 'react';
import { expect,it,vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { hubFixture } from '@/app/qa/marketing-performance-fixture/hubFixtures';
import { fixtureFilters } from '@/app/qa/marketing-performance-fixture/fixtures';
import { hubDefaults,selectHub, type HubFilters as Filters } from '@/lib/marketingPerformance/hub';
import HubMetrics from './HubMetrics';
import HubFilters from './HubFilters';

it('headline inspections intersect the displayed population, including an existing evidence filter',()=>{
  const filters:Filters={...hubDefaults(fixtureFilters),view:'portfolio',evidence:'no_receipt'};
  const apply=vi.fn();const rendered=renderIntoDocument(<HubMetrics hub={hubFixture} filters={filters} apply={apply} inspectEvents={()=>{}}/>);
  for(const [label,count] of [['all projects',3],['projects without receipts',3],['projects marked paid',2],['portfolio payment evidence',0],['paid evidence gaps',2],['test candidates',1]] as const){
    const button=rendered.container.querySelector<HTMLButtonElement>(`button[aria-label="Inspect ${label}"]`)!;
    expect(button.textContent).toBe(String(count));act(()=>button.click());
    const selection=apply.mock.lastCall![0] as Filters;
    expect(selection.evidence).toBe('no_receipt');expect(selectHub(hubFixture,selection).projects).toHaveLength(count);
  }
  rendered.unmount();
});
it('a mixed qualification headline opens the qualified count, not the awaiting-review count',()=>{
  const filters=hubDefaults(fixtureFilters),apply=vi.fn();
  const rendered=renderIntoDocument(<HubMetrics hub={hubFixture} filters={filters} apply={apply} inspectEvents={()=>{}}/>);
  const button=rendered.container.querySelector<HTMLButtonElement>('button[aria-label="Inspect qualification assessments"]')!;
  expect(button.textContent).toBe('4 qualified');act(()=>button.click());
  expect(selectHub(hubFixture,apply.mock.lastCall![0]).enquiries).toHaveLength(4);
  rendered.unmount();
});
it('clear filters resets event and record inspections as well as shared filters',()=>{
  const filters:Filters={...hubDefaults(fixtureFilters),view:'sales',kind:'receipts',inspect:'paid',source:'meta',owner:'dave',created:true};
  const apply=vi.fn();const rendered=renderIntoDocument(<HubFilters draft={filters} setDraft={()=>{}} apply={apply} hub={hubFixture} validation=""/>);
  const clear=Array.from(rendered.container.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent==='Clear filters')!;
  act(()=>clear.click());expect(apply.mock.lastCall![0]).toMatchObject({kind:'',inspect:'all',source:'',owner:'',created:false});
  rendered.unmount();
});

it('a missing payment amount remains unavailable instead of becoming a zero contribution',()=>{
  const filters:Filters={...hubDefaults(fixtureFilters),view:'sales'};
  const report={...hubFixture,events:[{id:'missing',projectId:hubFixture.projects[0].id,kind:'payment' as const,day:fixtureFilters.start,status:'RECORDED',amountCents:null}]};
  const rendered=renderIntoDocument(<HubMetrics hub={report} filters={filters} apply={()=>{}} inspectEvents={()=>{}}/>);
  expect(rendered.container.querySelector('button[aria-label="Inspect payments and reversals"]')?.textContent).toBe('Unavailable');
  rendered.unmount();
});
