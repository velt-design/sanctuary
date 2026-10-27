import { act } from 'react';
import { expect,it,vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { hubFixture } from '@/app/qa/marketing-performance-fixture/hubFixtures';
import { fixtureFilters } from '@/app/qa/marketing-performance-fixture/fixtures';
import { hubDefaults } from '@/lib/marketingPerformance/hub';
import { rowSchema } from '@/lib/marketingPerformance/contract';
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
it('normalizes saved aliases and opens the same-cohort cash evidence',()=>{
  const rows=['fb','facebook'].map((source,index)=>rowSchema.parse({...hubFixture.enquiries.rows[index],source,recordedCash:{amountCents:10000,entryCount:1,complete:true}}));
  expect(rows.map(row=>row.recordedSource)).toEqual(['fb','facebook']);
  const apply=vi.fn(),filters={...hubDefaults(fixtureFilters),view:'overview' as const};
  const rendered=renderIntoDocument(<SourceOutcomes rows={rows} filters={filters} apply={apply} compact/>);
  const cells=[...rendered.container.querySelectorAll<HTMLButtonElement>('button')];
  const facebook=cells.find(cell=>cell.getAttribute('aria-label')?.startsWith('Inspect Enquiries from Facebook:'));
  expect(facebook).toBeDefined();
  act(()=>facebook!.click());expect(apply.mock.lastCall?.[0]).toMatchObject({view:'enquiries',source:'Facebook',inspect:'all'});
  const cash=cells.find(cell=>cell.getAttribute('aria-label')?.includes('cash from Facebook'));
  expect(cash?.textContent).toContain('200.00');
  act(()=>cash!.click());expect(apply.mock.lastCall?.[0]).toMatchObject({view:'enquiries',source:'Facebook',inspect:'cash'});
  rendered.unmount();
});
