import { expect,it } from 'vitest';
import { visitDateEstimate,calendarVisitDateEstimate } from './visitDateEstimate';
import { visitDateRange } from './calendarModel';
import type { CalendarVisit } from './contract';
const marker='Approximate visit date: 2026-09-07 (original quote date; owner-approved).';
it('binds a single exact estimate marker to the current historical date without inventing a time',()=>{
 const visit={origin:'history',day:'2026-09-07',at:null,basis:`Assumed original purpose: reviewed.\n${marker}`};
 expect(visitDateEstimate(visit)).toBe('quote');
 expect(visitDateEstimate({...visit,basis:visit.basis.replace('\n','\r\n')+'\r\n'})).toBe('quote');
 for(const patch of [{origin:'outlook'},{day:'2026-09-08'},{day:null},{at:'2026-09-07T00:00:00Z'},{basis:'Approximate date from quote'},{basis:marker+'\n'+marker}])expect(visitDateEstimate({...visit,...patch})).toBe(null);
});
it('labels the existing calendar date and stops calling it approximate after the date or precision changes',()=>{
 const visit={origin:'history',timing:{mode:'date',date:'2026-09-07',time:null,endTime:null},correction:{basis:marker}} as CalendarVisit;
 expect(calendarVisitDateEstimate(visit)).toBe('quote');expect(visitDateRange(visit)).toContain('(approx. quote date)');
 expect(visitDateRange({...visit,timing:{...visit.timing!,date:'2026-09-08'}})).not.toContain('approx.');
 expect(calendarVisitDateEstimate({...visit,timing:{...visit.timing!,mode:'agreed',time:'09:00'}})).toBe(null);
});

it('recognizes acceptance-derived approval separately and rejects stale, duplicate or conflicting markers',()=>{
 const approved='Approximate visit date: 2026-09-07 (acceptance date; owner-approved).';
 const visit={origin:'history',day:'2026-09-07',at:null,basis:approved};
 expect(visitDateEstimate(visit)).toBe('acceptance');
 for(const basis of [approved+'\n'+marker,approved+'\n'+approved,approved+'\nApproximate visit date: 2026-09-08 (other evidence).',approved.replace('09-07','09-08')])expect(visitDateEstimate({...visit,basis})).toBeNull();
 for(const patch of [{origin:'outlook'},{at:'2026-09-07T00:00:00Z'},{day:null}])expect(visitDateEstimate({...visit,...patch})).toBeNull();
 const calendar={origin:'history',timing:{mode:'date',date:visit.day,time:null,endTime:null},correction:{basis:approved}} as CalendarVisit;
 expect(calendarVisitDateEstimate(calendar)).toBe('acceptance');expect(visitDateRange(calendar)).toContain('(approx. visit date)');expect(visitDateRange(calendar)).not.toContain('quote');
 expect(calendarVisitDateEstimate({...calendar,timing:{...calendar.timing!,date:'2026-09-08'}})).toBeNull();
});
