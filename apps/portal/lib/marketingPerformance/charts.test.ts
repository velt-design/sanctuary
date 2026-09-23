import { expect,it } from 'vitest';
import { representativeFixture as hub, representativeFilters } from '@/app/qa/marketing-performance-fixture/representativeFixture';
import { enquiryWeeks, portfolioStages, sourceMeasures, sourceOutcomes } from './charts';
import { aucklandDay, UNKNOWN_SOURCE } from './contract';
import { hubDefaults, selectHub, parseHubFilters, hubQuery } from './hub';

it('weekly stacked counts reconcile to NZ dated receipt IDs, including partial weeks',()=>{
  const {weeks,sources}=enquiryWeeks(hub.enquiries.rows,hub.start,hub.end);
  expect(weeks.reduce((sum,w)=>sum+w.values.reduce((a,b)=>a+b,0),0)).toBe(hub.enquiries.rows.length);
  const dated=hub.enquiries.rows.map(r=>({day:aucklandDay(new Date(r.receivedAt)),source:r.source??UNKNOWN_SOURCE}));
  for(const w of weeks){
    expect(w.values.reduce((a,b)=>a+b,0)).toBe(w.enquiries);
    for(const [i,source] of sources.entries())expect(w.values[i]).toBe(dated.filter(r=>r.day>=w.start&&r.day<=w.end&&r.source===source).length);
  }
  expect(weeks[0].days).toBe(6);expect(weeks.at(-1)?.days).toBe(2);
  const edge={...hub.enquiries.rows[0],receivedAt:'2026-09-27T11:30:00Z'};
  expect(enquiryWeeks([edge],'2026-09-28','2026-09-28').weeks[0].enquiries).toBe(1);
});
it('source measures keep denominators explicit, missing assessments unavailable and drill-down exact',()=>{
  const f=hubDefaults(representativeFilters);
  for(const metric of ['enquiries','qualified','quote','accepted','won'] as const){
    for(const m of sourceMeasures(hub.enquiries.rows,metric,'count')){
      const inspect=metric==='enquiries'?'all':metric==='won'?'payment':metric;
      expect(selectHub(hub,{...f,source:m.source,inspect}).enquiries.length).toBe(m.count);
    }
  }
  expect(sourceMeasures(hub.enquiries.rows,'qualified','rate').every(m=>m.unavailable)).toBe(true);
  expect(sourceMeasures(hub.enquiries.rows,'enquiries','rate').reduce((n,m)=>n+m.value,0)).toBeCloseTo(100);
  const repeatOnly=hub.enquiries.rows.filter(r=>r.projectId&&!r.origin);
  expect(sourceMeasures(repeatOnly,'won','rate')[0].unavailable).toBe(true);
});
it('portfolio segments retain unknown stages and match exact intersection filters',()=>{
  const data={...hub,projects:[...hub.projects,{...hub.projects[0],id:'77777777-7777-4777-8777-000000009999',stage:null}]};
  const f={...hubDefaults(representativeFilters),view:'portfolio' as const};
  for(const row of portfolioStages(data.projects)){
    expect(selectHub(data,{...f,stage:row.key}).projects.length).toBe(row.total);
    expect(row.values.reduce((a,b)=>a+b,0)).toBe(row.total);
  }
  const saved={...f,stage:'__unknown',chartMetric:'won',chartScale:'rate'};
  expect(parseHubFilters(hubQuery(saved),representativeFilters)).toEqual(saved);
});

it('aligned outcome cells keep source order and exact record populations across columns',()=>{
  const rows=[...hub.enquiries.rows];
  rows[0]={...rows[0],qualification:'qualified'};
  rows[1]={...rows[1],qualification:'not_qualified'};
  const data={...hub,enquiries:{...hub.enquiries,rows}};
  const f=hubDefaults(representativeFilters);
  for(const group of sourceOutcomes(rows))for(const cell of group.cells){
    const inspect=cell.metric==='enquiries'?'all':cell.metric==='won'?'payment':cell.metric;
    expect(selectHub(data,{...f,source:group.source,inspect}).enquiries).toHaveLength(cell.count);
    expect(cell.width).toBeGreaterThanOrEqual(0);expect(cell.width).toBeLessThanOrEqual(100);
  }
  expect(sourceOutcomes([])).toEqual([]);
  const repeat={...rows[0],origin:false,qualification:'unreviewed' as const};
  const cells=sourceOutcomes([repeat])[0].cells;
  expect(cells.find(c=>c.metric==='enquiries')?.count).toBe(1);
  expect(cells.find(c=>c.metric==='qualified')).toMatchObject({count:0,denominator:1,unavailable:true});
  expect(cells.find(c=>c.metric==='won')).toMatchObject({count:0,denominator:0});
});
