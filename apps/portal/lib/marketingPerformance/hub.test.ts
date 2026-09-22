import { expect,it } from 'vitest';
import { hubFixture } from '@/app/qa/marketing-performance-fixture/hubFixtures';
import { fixtureFilters } from '@/app/qa/marketing-performance-fixture/fixtures';
import { hubDefaults,hubQuery,parseHubFilters,selectHub,hubSchema } from './hub';

it('keeps older manual/archived projects visible unless created-date filtering is requested',()=>{
  const f={...hubDefaults(fixtureFilters),view:'portfolio' as const};
  const all=selectHub(hubFixture,f);
  expect(all.projects.some(p=>p.name==='Sample legacy settled project')).toBe(true);
  expect(selectHub(hubFixture,{...f,created:true}).projects.some(p=>!p.originId)).toBe(false);
  expect(selectHub(hubFixture,{...f,evidence:'no_receipt'}).projects).toHaveLength(3);
  expect(selectHub(hubFixture,{...f,evidence:'paid_gap'}).projects).toHaveLength(2);
});
it('keeps sales dates independent of project dates, and origin attribution independent of repeat sources',()=>{
  const f={...hubDefaults(fixtureFilters),view:'sales' as const,created:true};
  expect(selectHub(hubFixture,f).events.some(e=>e.id==='payment:legacy')).toBe(true);
  const meta=selectHub(hubFixture,{...f,source:'meta'});
  expect(meta.events.some(e=>e.id==='payment:sample-1')).toBe(false);
  const rows=selectHub(hubFixture,{...f,view:'enquiries',source:'meta'}).enquiries;
  expect(rows.some(r=>!r.origin)).toBe(true);
});
it('round trips every shared filter, safely normalizes unknown views and rejects orphan/duplicate events',()=>{
  const f={...hubDefaults(fixtureFilters),view:'portfolio' as const,created:true,owner:'dave',state:'ARCHIVED',stage:'paid',evidence:'paid_gap'};
  expect(parseHubFilters(hubQuery(f),fixtureFilters)).toEqual(f);
  expect(parseHubFilters(new URLSearchParams('view=invalid&evidence=invalid'),fixtureFilters).view).toBe('enquiries');
  expect(parseHubFilters(new URLSearchParams('kind=toString&stage=bogus&state=bogus&owner=bogus'),fixtureFilters)).toMatchObject({kind:'',stage:'',state:'',owner:''});
  expect(hubSchema.safeParse(hubFixture).success).toBe(true);
  expect(hubSchema.safeParse({...hubFixture,events:[hubFixture.events[0],hubFixture.events[0]]}).success).toBe(false);
});
