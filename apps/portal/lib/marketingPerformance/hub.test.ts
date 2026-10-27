import { expect,it } from 'vitest';
import { hubFixture } from '@/app/qa/marketing-performance-fixture/hubFixtures';
import { fixtureFilters } from '@/app/qa/marketing-performance-fixture/fixtures';
import { hubDefaults,hubQuery,parseHubFilters,selectHub,hubSchema } from './hub';
import { observedSource } from './contract';
import { sourceOutcomes } from './charts';

it.each(['constructor','__proto__','toString','hasOwnProperty','ordinary-newsletter'])('retains arbitrary source %s through parsing, grouping and saved filters',source=>{
  expect(observedSource(source)).toBe(source);
  const raw=structuredClone(hubFixture);
  raw.enquiries.rows=raw.enquiries.rows.map(row=>({...row,source}));
  raw.projects=raw.projects.map(project=>({...project,source}));
  const report=hubSchema.parse(raw);
  expect(sourceOutcomes(report.enquiries.rows)[0].source).toBe(source);
  const filters=parseHubFilters(new URLSearchParams({view:'enquiries',source}),fixtureFilters);
  expect(parseHubFilters(hubQuery(filters),fixtureFilters).source).toBe(source);
  expect(selectHub(report,filters).enquiries).toHaveLength(report.enquiries.rows.length);
});

it('retains cash evidence and normalizes saved source aliases when reopening a report URL',()=>{
  const filters=parseHubFilters(new URLSearchParams('view=enquiries&source=fb&evidence=cash'),fixtureFilters);
  expect(filters).toMatchObject({view:'enquiries',source:'Facebook',evidence:'cash'});
  expect(parseHubFilters(hubQuery(filters),fixtureFilters)).toEqual(filters);
});

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
