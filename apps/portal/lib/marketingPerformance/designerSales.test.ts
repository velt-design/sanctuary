import { it,expect } from 'vitest';
import { designerFixture } from '@/app/qa/marketing-performance-fixture/designerFixtures';
import { designerSales,salesScopeValue,projectSalesExclusion } from './designerSales';
import { designerPerformance } from './designer';
it('counts all accepted jobs independently of visit source, deduplicating add-on scopes and retaining unassigned jobs',()=>{
  const report=designerFixture();report.visits=[];report.source.enabled=false;
  const result=designerSales(report);expect(result.total.jobs).toHaveLength(2);expect(result.total.goingAhead).toHaveLength(2);
  expect(result.total.jobs.flatMap(j=>j.scopes)).toHaveLength(3);expect(result.rows.find(r=>r.staffId==='unassigned')?.jobs).toHaveLength(1);
  expect(result.rows.find(r=>r.staffId==='jordan')?.jobs[0].scopes).toHaveLength(2);
  expect(salesScopeValue(result.total.goingAhead.flatMap(j=>j.goingAhead),true)).toBe(3950000);
  expect(designerPerformance(report).total.outcomes).toEqual([]);
});
it('keeps refunded acceptance historical while removing going-ahead and positive visit credit without rewriting visits',()=>{
  const report=designerFixture(),before=structuredClone(report.visits),projectId=report.scopes[0].projectId;
  report.salesOutcomes=[{projectId,outcome:'refunded',revision:1,updatedAt:report.asOf,basis:'Owner confirmed refund'}];
  const result=designerSales(report);expect(result.total.jobs).toHaveLength(2);expect(result.total.goingAhead).toHaveLength(1);expect(result.total.excluded[0]).toMatchObject({projectId,exclusion:'refunded'});
  const visits=designerPerformance(report);expect(visits.total.outcomes).toHaveLength(2);expect(visits.total.outcomes.find(o=>o.visit.projectId===projectId)).toMatchObject({accepted:[],paid:[]});expect(report.visits).toEqual(before);
  report.salesProjects[0].closedOutcome='CANCELLED';report.salesOutcomes[0].outcome=null;expect(projectSalesExclusion(report,projectId)).toBe('cancelled');
});
it('separates selected NZ acceptance dates, all-date history, unknown dates and later acceptance revisions',()=>{
  const report=designerFixture();report.start='2026-09-12';report.end='2026-09-22';
  report.scopes[0].lastAcceptedAt='2026-09-11T12:30:00Z'; // 12 September NZ.
  report.scopes[2].lastAcceptedAt=null;
  const selected=designerSales(report);expect(selected.total.jobs).toHaveLength(1);expect(selected.total.jobs[0].scopes).toHaveLength(1);expect(selected.total.undated).toHaveLength(1);
  const all=designerSales(report,null,'',true);expect(all.total.jobs).toHaveLength(2);expect(all.total.jobs.flatMap(j=>j.scopes)).toHaveLength(3);
  expect(designerSales(report,null,'jordan').total.jobs).toHaveLength(1);expect(designerSales(report,new Set(),'',true).total.jobs).toHaveLength(0);
});
it('retains withdrawn scopes in gross acceptance and avoids unknown value zero or project double counts',()=>{
  const report=designerFixture();report.scopes[0].accepted=false;report.scopes[0].valueCents=null;report.scopes[2].lastAcceptedValueCents=null;
  const result=designerSales(report);expect(result.total.goingAhead).toHaveLength(2); // Base withdrawn, add-on remains current.
  expect(result.total.goingAhead[0].goingAhead).toHaveLength(1);expect(salesScopeValue(result.total.jobs.flatMap(j=>j.scopes))).toBeNull();
  report.scopes[3].accepted=false;expect(designerSales(report).total.excluded[0].exclusion).toBe('acceptance_withdrawn');
});
