import { describe,expect,it } from 'vitest';
import { designerFixture } from '@/app/qa/marketing-performance-fixture/designerFixtures';
import { afterVisit,designerPerformance,siteVisitResults } from './designer';
describe.each(['original quote date','acceptance date'])('%s estimate',basisKind=>{
function fixture(){
 const report=designerFixture(),visit=report.visits[0];
 Object.assign(visit,{origin:'history',day:'2026-09-07',at:null,basis:`Assumed original purpose: owner-approved.\nApproximate visit date: 2026-09-07 (${basisKind}; owner-approved).`});
 Object.assign(report.scopes[0],{firstSentAt:'2026-09-07T00:00:00Z',acceptedAt:'2026-09-07T01:00:00Z',paidAt:'2026-09-07T02:00:00Z'});
 return report;
}
it('includes same-day quote, accepted and paid evidence with joint credit but no estimated timing medians',()=>{
 const report=fixture(),result=designerPerformance(report),outcome=result.total.outcomes.find(o=>o.visit.id===report.visits[0].id)!;
 expect(outcome).toMatchObject({quoteDays:null,depositDays:null});expect(outcome.quoted).toHaveLength(1);expect(outcome.accepted).toHaveLength(1);expect(outcome.paid).toHaveLength(1);
 expect(siteVisitResults(result.total)).toMatchObject({won:1,eligible:2,approximateVisits:1,approximateOriginals:1,assumedOriginals:1,closeRate:50,averageOrderValueCents:1850000});
 for(const person of ['jordan','jp'])expect(siteVisitResults(designerPerformance(report,null,person).total)).toMatchObject({won:1,approximateOriginals:1});
 report.start='2026-09-08';expect(siteVisitResults(designerPerformance(report).total)).toMatchObject({won:0,approximateOriginals:0});
});
it('retains ordinary date-only, precise-time, future and genuine earlier-outcome guards',()=>{
 const report=fixture(),visit=report.visits[0];
 expect(afterVisit('2026-09-06T00:00:00Z',visit,report.asOf)).toBe(false);
 expect(afterVisit('2026-10-01T00:00:00Z',visit,report.asOf)).toBe(false);
 expect(afterVisit(report.scopes[0].acceptedAt,{...visit,basis:null},report.asOf)).toBe(false);
 expect(afterVisit(report.scopes[0].acceptedAt,{...visit,origin:'outlook'},report.asOf)).toBe(false);
 expect(afterVisit(report.scopes[0].acceptedAt,{...visit,at:'2026-09-07T02:00:00Z'},report.asOf)).toBe(false);
 report.scopes[0].paidAt='2026-09-06T00:00:00Z';expect(designerPerformance(report).issues.get(visit.id)).toContain('chronology');
 expect(designerPerformance(report).retainedOriginals.some(o=>o.visit.id===visit.id)).toBe(false);
});
it('keeps unresolved evidence, conflicting originals, refunds and tests outside positive acquisition credit',()=>{
 for(const scenario of ['question','conflict','refund','test','unknown-payment','disabled']){
  const report=fixture(),visit=report.visits[0];
  if(scenario==='question')visit.questions=1;
  if(scenario==='conflict')report.visits.push({...visit,id:'99999999-9999-4999-8999-999999999999',staff:['joe']});
  if(scenario==='refund'||scenario==='test')report.salesOutcomes.push({projectId:visit.projectId!,outcome:scenario==='refund'?'refunded':'test',revision:1,updatedAt:report.asOf,basis:'Synthetic outcome'});
  if(scenario==='unknown-payment')report.scopes[0].paidAt=null;
  if(scenario==='disabled')report.source.enabled=false;
  expect(siteVisitResults(designerPerformance(report).total).won,scenario).toBe(0);
 }
 const report=fixture();report.scopes[0].acceptedAt=null;
 expect(siteVisitResults(designerPerformance(report).total)).toMatchObject({dateIncomplete:true,closeRate:null,averageOrderValueCents:null});
});

it('keeps undated wins pending while exposing the confirmed minimum for the same eligible cohort',()=>{
 const report=fixture();report.scopes[1].accepted=true;report.scopes[1].acceptedAt=null;
 report.scopes.push({...report.scopes[1],id:'88888888-8888-4888-8888-888888888888'});
 expect(siteVisitResults(designerPerformance(report).total)).toMatchObject({won:1,eligible:2,pendingAcceptanceDates:1,dateIncomplete:true,confirmedCloseRate:50,closeRate:null,averageOrderValueCents:null});
 report.scopes[0].acceptedAt=null;
 expect(siteVisitResults(designerPerformance(report).total)).toMatchObject({won:0,pendingAcceptanceDates:2,confirmedCloseRate:0,closeRate:null});
 report.visits=[];
 expect(siteVisitResults(designerPerformance(report).total)).toMatchObject({eligible:0,pendingAcceptanceDates:0,confirmedCloseRate:null,closeRate:null});
});

});
