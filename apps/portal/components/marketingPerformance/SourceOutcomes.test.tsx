import { act } from 'react';
import { expect,it,vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { hubFixture } from '@/app/qa/marketing-performance-fixture/hubFixtures';
import { fixtureFilters } from '@/app/qa/marketing-performance-fixture/fixtures';
import { hubDefaults } from '@/lib/marketingPerformance/hub';
import SourceOutcomes from './SourceOutcomes';

it('unassessed qualification shows unavailable and pending evidence without a zero rate',()=>{
  const rows=hubFixture.enquiries.rows.map(row=>({...row,qualification:'unreviewed' as const}));
  const apply=vi.fn();
  const rendered=renderIntoDocument(<SourceOutcomes rows={rows} filters={hubDefaults(fixtureFilters)} apply={apply}/>);
  const cell=rendered.container.querySelector<HTMLButtonElement>('button[aria-label="Inspect awaiting assessments from google: 5 of 5 eligible"]');
  expect(cell?.textContent).toContain('Unavailable');
  expect(cell?.textContent).toContain('5 awaiting');
  expect(cell?.textContent).not.toContain('%');
  act(()=>cell?.click());expect(apply.mock.lastCall?.[0]).toMatchObject({inspect:'unreviewed',source:'google',start:fixtureFilters.start,end:fixtureFilters.end});
  rendered.unmount();
});
it('assessed zero qualification is a recorded zero rate, distinct from unavailable',()=>{
  const rows=hubFixture.enquiries.rows.map(row=>({...row,qualification:'not_qualified' as const}));
  const rendered=renderIntoDocument(<SourceOutcomes rows={rows} filters={hubDefaults(fixtureFilters)} apply={vi.fn()}/>);
  const cell=rendered.container.querySelector('button[aria-label="Inspect Qualified enquiries from google: 0"]');
  expect(cell?.textContent).toContain('0%');expect(cell?.textContent).not.toContain('Unavailable');
  rendered.unmount();
});
it('overview source cells open the enquiry records and keep saved source aliases separate',()=>{
  const rows=['fb','facebook'].map((source,index)=>({...hubFixture.enquiries.rows[0],source,enquiryId:`alias-${index}`}));
  const apply=vi.fn(),filters={...hubDefaults(fixtureFilters),view:'overview' as const};
  const rendered=renderIntoDocument(<SourceOutcomes rows={rows} filters={filters} apply={apply} compact/>);
  const cells=[...rendered.container.querySelectorAll<HTMLButtonElement>('button')];
  const fb=cells.find(cell=>cell.getAttribute('aria-label')?.startsWith('Inspect Enquiries from fb:'));
  const facebook=cells.find(cell=>cell.getAttribute('aria-label')?.startsWith('Inspect Enquiries from facebook:'));
  expect(fb).toBeDefined();expect(facebook).toBeDefined();
  act(()=>fb!.click());expect(apply.mock.lastCall?.[0]).toMatchObject({view:'enquiries',source:'fb',inspect:'all',start:filters.start,end:filters.end});
  act(()=>facebook!.click());expect(apply.mock.lastCall?.[0]).toMatchObject({view:'enquiries',source:'facebook',inspect:'all'});
  rendered.unmount();
});
