import { expect,it } from 'vitest';
import { isQuoteDateEstimate,isCalendarQuoteDateEstimate } from './visitDateEstimate';
import { visitDateRange } from './calendarModel';
import type { CalendarVisit } from './contract';
const marker='Approximate visit date: 2026-09-07 (original quote date; owner-approved).';
it('binds a single exact estimate marker to the current historical date without inventing a time',()=>{
 const visit={origin:'history',day:'2026-09-07',at:null,basis:`Assumed original purpose: reviewed.\n${marker}`};
 expect(isQuoteDateEstimate(visit)).toBe(true);
 expect(isQuoteDateEstimate({...visit,basis:visit.basis.replace('\n','\r\n')+'\r\n'})).toBe(true);
 for(const patch of [{origin:'outlook'},{day:'2026-09-08'},{day:null},{at:'2026-09-07T00:00:00Z'},{basis:'Approximate date from quote'},{basis:marker+'\n'+marker}])expect(isQuoteDateEstimate({...visit,...patch})).toBe(false);
});
it('labels the existing calendar date and stops calling it approximate after the date or precision changes',()=>{
 const visit={origin:'history',timing:{mode:'date',date:'2026-09-07',time:null,endTime:null},correction:{basis:marker}} as CalendarVisit;
 expect(isCalendarQuoteDateEstimate(visit)).toBe(true);expect(visitDateRange(visit)).toContain('(approx. quote date)');
 expect(visitDateRange({...visit,timing:{...visit.timing!,date:'2026-09-08'}})).not.toContain('approx.');
 expect(isCalendarQuoteDateEstimate({...visit,timing:{...visit.timing!,mode:'agreed',time:'09:00'}})).toBe(false);
});
