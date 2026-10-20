import { describe,it,expect } from 'vitest';
import type { CalendarVisit } from './contract';
import { reviewedVisit } from './reviewedVisit';
import { requiresVisitReview,isScheduledVisit,visibleVisits,visitScheduleLabel,visitHasNotEnded } from './calendarModel';
import { correctionCommand,historyCommand } from './correctionContract';
const raw:CalendarVisit={id:'00000000-0000-4000-8000-000000000001',revision:1,sourceKey:'one',subject:'Site visit',startsAt:'2026-10-20T00:00:00Z',endsAt:'2026-10-20T00:30:00Z',isAllDay:false,allDayStartDate:null,allDayEndDate:null,sourceUrl:null,address:null,staff:[],assignmentHint:null,kind:'visit',sourceKind:'visit',cancelled:false,removed:false,duplicate:false,reviewReasons:['Check Outlook for address.'],projectId:'00000000-0000-4000-8000-000000000002',projectName:'Synthetic project',contactName:null,phone:null,linkMode:'manual',kindOverride:null};
const correction={details:{staff:[{name:'Original rep',email:'',staffId:'original-rep'}],address:'12 Verified Road'},questions:[],basis:'Verified against the source statement.',referenceUrl:null,updatedAt:'2026-10-20T00:00:00Z',sourceChanged:false};
describe('Effective reviewed visit facts',()=>{
 it('orders reviewed local times together with source instants in the actual NZ day',()=>{
  const early={...raw,id:'early',startsAt:'2026-10-19T21:00:00Z',endsAt:'2026-10-19T22:00:00Z'};
  const late=reviewedVisit({...raw,id:'late',correction:{...correction,details:{...correction.details,timing:{mode:'window',date:'2026-10-20',time:'16:00',endTime:'17:30'}}}});
  expect(visibleVisits([late,raw,early],'today','','',new Date('2026-10-20T00:00:00Z')).map(v=>v.id)).toEqual(['early',raw.id,'late']);
 });
 it('uses corrections for filtering and leaves source facts separately available',()=>{
  const v=reviewedVisit({...raw,correction});expect(requiresVisitReview(v)).toBe(false);expect(v.source?.address).toBeNull();expect(v.source?.staff).toEqual([]);
  expect(visibleVisits([v],'today','staff:original-rep','Verified',new Date('2026-10-20T00:00:00Z'))).toHaveLength(1);
 });
 it('does not turn an accepted past appointment into attendance',()=>{
  const v=reviewedVisit({...raw,correction:{...correction,details:{...correction.details,status:'booked',timing:{mode:'agreed',date:'2026-10-15',time:'09:30',endTime:null}}}});
  expect(v.status).toBe('booked');expect(visitScheduleLabel(v)).toContain('Agreed 9:30 am');expect(visitScheduleLabel(v)).not.toContain(' to ');expect(visitHasNotEnded(v,new Date('2026-10-20T00:00:00Z'))).toBe(false);
 });
 it('represents access windows and intentionally unknown historical attendance honestly',()=>{
  const window=reviewedVisit({...raw,correction:{...correction,details:{...correction.details,status:'attended',timing:{mode:'window',date:'2026-09-29',time:'09:00',endTime:'10:30'}}}});
  expect(visitScheduleLabel(window)).toContain('Access 9:00 am to 10:30 am');expect(isScheduledVisit(window)).toBe(false);
  const historical=reviewedVisit({...raw,origin:'history',startsAt:null,endsAt:null,correction:{...correction,details:{staff:correction.details.staff,status:'attended',purpose:'initial',timing:{mode:'unknown',date:null,time:null,endTime:null}}}});
  expect(requiresVisitReview(historical)).toBe(false);expect(visitScheduleLabel(historical)).toBe('Date and time not recorded');expect(visibleVisits([historical],'upcoming','','')).toEqual([]);expect(visibleVisits([historical],'history','','')).toHaveLength(1);
 });
 it('retains real unanswered future booking, address and time questions without dismissing them',()=>{
  const v=reviewedVisit({...raw,correction:{...correction,details:{staff:correction.details.staff,status:'booked',timing:{mode:'date',date:'2026-10-27',time:null,endTime:null}}}});
  expect(v.reviewReasons).toEqual(['Confirm the site address.','Confirm the visit time.']);expect(requiresVisitReview(v)).toBe(true);
  const rejected=reviewedVisit({...raw,correction:{...correction,details:{status:'cancelled'},questions:['Agree a replacement date and address.']}});
  expect(requiresVisitReview(rejected)).toBe(true);expect(visibleVisits([rejected],'upcoming','','')).toEqual([]);
  const uncertainType=reviewedVisit({...raw,kindOverride:'review',kind:'review',correction:{...correction,details:{...correction.details,status:'booked'}}});expect(uncertainType.kind).toBe('review');expect(requiresVisitReview(uncertainType)).toBe(true);
 });
 it('protects source conflicts and withdrawn records from normal scheduled summaries',()=>{
  const stale=reviewedVisit({...raw,correction:{...correction,sourceChanged:true}});expect(requiresVisitReview(stale)).toBe(true);expect(isScheduledVisit(stale)).toBe(false);expect(visitHasNotEnded(stale,new Date('2026-10-19T23:00:00Z'))).toBe(false);
  const withdrawn=reviewedVisit({...raw,origin:'history',withdrawn:true,kind:'excluded',correction:{...correction,details:{status:'attended'}}});expect(withdrawn.kind).toBe('excluded');expect(requiresVisitReview(withdrawn)).toBe(false);
 });
 it('uses local calendar dates for corrected date-only visits across NZ DST boundaries',()=>{
  for(const [date,before,during,after] of [['2026-09-27','2026-09-26T11:59:59Z','2026-09-27T10:59:59Z','2026-09-27T11:00:00Z'],['2027-04-04','2027-04-03T10:59:59Z','2027-04-04T11:59:59Z','2027-04-04T12:00:00Z']]){
   const v=reviewedVisit({...raw,correction:{...correction,details:{...correction.details,timing:{mode:'date',date,time:null,endTime:null}}}});
   expect(visibleVisits([v],'today','','',new Date(before))).toHaveLength(0);expect(visibleVisits([v],'today','','',new Date(during))).toHaveLength(1);expect(visibleVisits([v],'today','','',new Date(after))).toHaveLength(0);
  }
 });
 it('rejects forged shapes and impossible timing instead of coercing historical facts',()=>{
  const evidence={details:correction.details,questions:[],basis:correction.basis,referenceUrl:null};
  const command={action:'save',id:raw.id,revision:1,projectId:raw.projectId,linkMode:'manual',kind:'visit',...evidence};
  expect(correctionCommand.safeParse(command).success).toBe(true);expect(correctionCommand.safeParse({...command,sourceChanged:false}).success).toBe(false);
  const valid={action:'save',id:raw.id,revision:0,projectId:raw.projectId,...evidence,details:{...correction.details,status:'attended',purpose:'initial',timing:{mode:'unknown',date:null,time:null,endTime:null}}};
  expect(historyCommand.safeParse(valid).success).toBe(true);expect(historyCommand.safeParse({...valid,details:{...valid.details,timing:{mode:'unknown',date:'2026-10-20',time:null,endTime:null}}}).success).toBe(false);
 });
});
