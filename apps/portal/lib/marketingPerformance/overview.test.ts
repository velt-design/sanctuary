import { expect,it } from 'vitest';
import { representativeFixture as hub, representativeFilters } from '@/app/qa/marketing-performance-fixture/representativeFixture';
import { ageDistribution, monthlyActivity, projectAge } from './overview';
import { hubDefaults, selectHub, hubQuery, parseHubFilters, type HubEvent } from './hub';

it('age buckets partition active/waiting projects and drill into exactly those IDs',()=>{
  const filters={...hubDefaults(representativeFilters),view:'overview' as const,source:'google'};
  const projects=selectHub(hub,filters).projects;
  const bands=ageDistribution(projects,hub.asOf);
  expect(bands.reduce((n,b)=>n+b.count,0)).toBe(projects.filter(p=>['ACTIVE','WAITING'].includes(p.state)).length);
  for(const band of bands){
    const drill={...filters,view:'portfolio' as const,age:band.key};
    expect(selectHub(hub,drill).projects).toHaveLength(band.count);
    expect(parseHubFilters(hubQuery(drill),representativeFilters)).toEqual(drill);
  }
});
it('age uses Auckland calendar days across DST, boundaries and future creation dates',()=>{
  const p=hub.projects[0];
  expect(projectAge({...p,createdAt:'2026-09-26T12:00:00Z'},'2026-09-27T11:00:00Z')).toBe(1);
  const asOf='2026-09-22T06:48:00Z';
  const projects=[0,7,8,30,31,90,91,-1].map(n=>({...p,state:'ACTIVE',createdAt:new Date(Date.parse(asOf)-n*86400000).toISOString()}));
  expect(ageDistribution(projects,asOf).map(b=>b.count)).toEqual([2,2,2,1,1]);
});
it('months reconcile event IDs and signed cash, excluding invoice statuses and adjustments',()=>{
  const months=monthlyActivity(hub.events,hub.start,hub.end);
  expect(months[0].start).toBe(hub.start);expect(months.at(-1)?.end).toBe(hub.end);
  expect(months[0].partial).toBe(true);
  for(const m of months){
    const selected=hub.events.filter(e=>e.day>=m.start&&e.day<=m.end);
    expect(m.sent).toBe(selected.filter(e=>e.kind==='quote_sent').length);
    expect(m.accepted).toBe(selected.filter(e=>e.kind==='quote_accepted').length);
  }
  const entry:HubEvent={id:'p',projectId:hub.projects[0].id,kind:'payment',day:'2026-09-01',status:'RECORDED',amountCents:12000};
  const events=[entry,{...entry,id:'r',kind:'reversal' as const,amountCents:-18000},{...entry,id:'i',kind:'invoice_paid' as const},{...entry,id:'a',kind:'adjustment' as const}];
  expect(monthlyActivity(events,'2026-09-01','2026-09-22')[0]).toMatchObject({receipts:-60,receiptEntries:2});
  expect(monthlyActivity([...events,{...entry,id:'missing',amountCents:null}],'2026-09-01','2026-09-22')[0]).toMatchObject({receipts:null,missing:1});
  expect(monthlyActivity([],'2024-02-29','2024-03-01').map(m=>[m.start,m.end])).toEqual([['2024-02-29','2024-02-29'],['2024-03-01','2024-03-01']]);
});
