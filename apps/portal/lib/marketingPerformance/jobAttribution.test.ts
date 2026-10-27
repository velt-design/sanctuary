import { describe,it,expect } from 'vitest';
import { designerFixture } from '@/app/qa/marketing-performance-fixture/designerFixtures';
import { hubFixture } from '@/app/qa/marketing-performance-fixture/hubFixtures';
import { jobAttributions,withJobAttributions,provisionalAssignmentPrefix } from './jobAttribution';
import { designerPerformance,siteVisitResults } from './designer';
import { designerSales,salesScopeValue } from './designerSales';

describe('provisional job responsibility',()=>{
 it('preserves saved sales roles even when visitors differ and labels unsaved suggestions',()=>{
  const report=designerFixture(); report.assignments[0].designerKey='steve';
  const values=jobAttributions(report,hubFixture),saved=values.get(report.assignments[0].projectId)!;
  expect(saved).toMatchObject({designerKey:'steve',persisted:true,provisional:false});
  const missing=values.get(report.scopes[2].projectId)!;
  expect(missing).toMatchObject({designerKey:'joe',persisted:false,provisional:true});
  expect(missing.basis).toContain('Linked recorded attendee'); expect(missing.saved.designerKey).toBeNull();
 });
 it('never changes sales money or visit contributions and includes lost quoted jobs, not unrelated leads',()=>{
  const report=designerFixture(); report.assignments=[]; report.salesProjects[1].closedOutcome='LOST_OTHER_SUPPLIER';
  const values=jobAttributions(report,hubFixture),attributed=withJobAttributions(report,values);
  expect(values.has(report.scopes[1].projectId)).toBe(true);
  expect([...values.values()].every(value=>value.provisional&&!value.persisted)).toBe(true);
  expect([...values.keys()].every(id=>report.scopes.some(s=>s.projectId===id)||report.visits.some(v=>v.projectId===id))).toBe(true);
  const before=designerSales(report).total,after=designerSales(attributed).total;
  expect(after.jobs.map(j=>j.projectId)).toEqual(before.jobs.map(j=>j.projectId));
  expect(salesScopeValue(after.goingAhead.flatMap(j=>j.goingAhead),true)).toBe(salesScopeValue(before.goingAhead.flatMap(j=>j.goingAhead),true));
  expect(siteVisitResults(designerPerformance(attributed).total)).toEqual(siteVisitResults(designerPerformance(report).total));
 });
 it('falls back to responsibility only when source or evidence is unusable and respects filters/tests',()=>{
  const report=designerFixture();report.assignments=[];report.source.failed=true;
  const hub=structuredClone(hubFixture);hub.projects=hub.projects.map(p=>({...p,owner:null}));
  const id=report.scopes[0].projectId,values=jobAttributions(report,hub,new Set([id]));
  expect(values.size).toBe(1);expect(values.get(id)).toMatchObject({designerKey:'jordan',persisted:false,provisional:true});
  expect(values.get(id)!.basis).toContain('review owner');
  hub.projects.find(p=>p.id===id)!.knownTest=true;expect(jobAttributions(report,hub,new Set([id])).size).toBe(0);
 });
 it('keeps saved provisional bases visible and never invents an unknown original date',()=>{
  const report=designerFixture();report.assignments[0].basis=provisionalAssignmentPrefix+' review after owner-approved recovery.';
  const undated=report.visits.find(v=>!v.day)!;undated.basis='Assumed original purpose: owner approved; date unknown.';
  const values=jobAttributions(report,hubFixture);expect(values.get(report.assignments[0].projectId)?.provisional).toBe(true);
  const result=designerPerformance(report);expect(result.retainedOriginals.some(o=>o.visit.id===undated.id)).toBe(false);expect(undated.day).toBeNull();
  report.visits[0].basis='Assumed original purpose: owner approved; review later.';
  expect(siteVisitResults(designerPerformance(report).total).assumedOriginals).toBe(1);
 });
 it('uses the current responsible owner without turning cancelled or conflicting visits into evidence',()=>{
  const report=designerFixture('conflict');report.assignments=[];
  const id=report.scopes[0].projectId,hub=structuredClone(hubFixture);
  hub.projects.find(project=>project.id===id)!.owner='ellen';
  for(const visit of report.visits.filter(visit=>visit.projectId===id&&visit.purpose!=='initial'))visit.cancelled=true;
  const value=jobAttributions(report,hub).get(id)!;
  expect(value.designerKey).toBe('ellen');expect(value.basis).toContain('responsibility only; actual visitor is not established');
  expect(siteVisitResults(designerPerformance(report).total).won).not.toBeGreaterThan(0);
 });
});
