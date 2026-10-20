import { describe,it,expect } from 'vitest';
import { allDayCalendarBounds } from './allDayCalendar';
import { normalizeCalendar,normalizeCalendarEvent } from './normalizeCalendar';
import { visibleVisits,visitDateRange,visitScheduleLabel,visitHasNotEnded,visitGroupDay } from './calendarModel';
import type { CalendarVisit } from './contract';
const boundary=(dateTime:string,timeZone='UTC')=>({dateTime,timeZone});
const bounds=(start:string,end:string,zone='UTC')=>allDayCalendarBounds(boundary(start,zone),boundary(end,zone));
const graph=(extra:Record<string,unknown>={})=>({id:'synthetic',subject:'Provisional site visit',isAllDay:true,isCancelled:false,sensitivity:'normal',attendees:[],start:boundary('2026-10-20T00:00:00.0000000'),end:boundary('2026-10-21T00:00:00.0000000'),...extra});
const normalize=(raw:unknown)=>normalizeCalendarEvent(raw,new Set(),'office@example.invalid')!;
const visit=(extra:Partial<CalendarVisit>={}):CalendarVisit=>({...normalize(graph()),id:'one',revision:1,sourceKind:'provisional',removed:false,projectId:null,projectName:null,contactName:null,phone:null,linkMode:'auto',kindOverride:null,...extra});
describe('All-day source calendar dates',()=>{
 it('keeps literal UTC and NZ midnight dates and canonicalizes the NZ range without clock labels',()=>{
   for(const zone of ['UTC','New Zealand Standard Time','Pacific/Auckland','AUS Eastern Standard Time']){
     const v=normalize(graph({start:boundary('2026-10-20T00:00:00',zone),end:boundary('2026-10-21T00:00:00',zone)}));
     expect(v).toMatchObject({isAllDay:true,allDayStartDate:'2026-10-20',allDayEndDate:'2026-10-21',startsAt:'2026-10-19T11:00:00.000Z',endsAt:'2026-10-20T11:00:00.000Z',kind:'provisional'});
   }
   expect(visitScheduleLabel(visit())).toBe('Tuesday, 20 October, All day');
 });
 it('preserves whole NZ calendar dates over both 23-hour and 25-hour DST days',()=>{
   for(const [start,end,hours,utcStart,utcEnd] of [
     ['2026-09-27','2026-09-28',23,'2026-09-26T12:00:00Z','2026-09-27T11:00:00Z'],
     ['2026-04-05','2026-04-06',25,'2026-04-04T11:00:00Z','2026-04-05T12:00:00Z'],
   ] as const){
     const literal=bounds(`${start}T00:00:00`,`${end}T00:00:00`),converted=bounds(utcStart,utcEnd);
     expect(converted).toEqual(literal);expect((Date.parse(literal.endsAt)-Date.parse(literal.startsAt))/3600000).toBe(hours);
     expect(literal).toMatchObject({allDayStartDate:start,allDayEndDate:end});
   }
 });
 it('rejects unknown, mixed, non-midnight, reversed and invalid calendar boundaries',()=>{
   for(const [start,end] of [
     [boundary('2026-10-20T00:00:00'),boundary('2026-10-21T00:00:00','New Zealand Standard Time')],
     [boundary('2026-10-20T00:00:00'),boundary('2026-10-20T11:00:00')],
     [boundary('2026-10-19T12:00:00'),boundary('2026-10-20T12:00:00')],
     [boundary('2026-10-21T00:00:00'),boundary('2026-10-20T00:00:00')],
     [boundary('2026-02-30T00:00:00'),boundary('2026-03-02T00:00:00')],
     [boundary('2026-10-20T00:00:00',''),boundary('2026-10-21T00:00:00','')],
   ])expect(()=>allDayCalendarBounds(start,end)).toThrow();
   expect(()=>normalize(graph({isAllDay:undefined}))).toThrow();
 });
 it('keeps timed instants and time labels unchanged when a source becomes timed',()=>{
   const v=normalize(graph({isAllDay:false,start:boundary('2026-10-19T21:15:00'),end:boundary('2026-10-19T21:45:00')}));
   expect(v).toMatchObject({isAllDay:false,allDayStartDate:null,allDayEndDate:null,startsAt:'2026-10-19T21:15:00.000Z'});
   expect(visitScheduleLabel(visit(v))).toMatch(/Tuesday, 20 October, 10:15 am to 10:45 am/);
 });
 it('does not suppress an all-day entry as a duplicate of a timed booking with the same canonical instants',()=>{
   const common={body:{content:'Address: 12 Example Road',contentType:'text'},attendees:[{emailAddress:{address:'customer@example.invalid'}}]};
   const placeholder=graph(common),staffBooking=graph({...common,id:'staff',isAllDay:false,start:boundary('2026-10-19T11:00:00'),end:boundary('2026-10-20T11:00:00'),attendees:[...common.attendees,{emailAddress:{address:'rep@example.invalid'}}]});
   const normalizeBoth=(other:unknown)=>normalizeCalendar([placeholder,other],new Set(['rep@example.invalid']),'office@example.invalid');
   expect(normalizeBoth(staffBooking)[0].duplicate).toBe(false);
   expect(normalizeBoth({...staffBooking,isAllDay:true,start:placeholder.start,end:placeholder.end})[0].duplicate).toBe(true);
 });
});
describe('All-day range visibility',()=>{
 const multi=visit(bounds('2026-10-18T00:00:00','2026-10-22T00:00:00'));
 it('shows every covered day once, with an inclusive range label and an exclusive final boundary',()=>{
   expect(visitDateRange(multi)).toBe('Sunday, 18 October to Wednesday, 21 October');
   for(const now of ['2026-10-17T11:00:00Z','2026-10-19T11:00:00Z','2026-10-21T10:59:59Z']){
     expect(visibleVisits([multi],'today','','',new Date(now))).toHaveLength(1);expect(visitHasNotEnded(multi,new Date(now))).toBe(true);
   }
   expect(visibleVisits([multi],'today','','',new Date('2026-10-21T11:00:00Z'))).toEqual([]);
   expect(visitHasNotEnded(multi,new Date('2026-10-21T11:00:00Z'))).toBe(false);
   expect(visibleVisits([multi],'today','','',new Date('2026-10-17T10:59:59Z'))).toEqual([]);
 });
 it('includes a range starting before this week or today and groups it under the visible range',()=>{
   const now=new Date('2026-10-20T00:00:00Z');
   expect(visibleVisits([multi],'week','','',now)).toHaveLength(1);expect(visibleVisits([multi],'upcoming','','',now)).toHaveLength(1);
   expect(visitGroupDay(multi,'today',now)).toBe('2026-10-20');expect(visitGroupDay(multi,'week',now)).toBe('2026-10-19');
   expect(visitGroupDay(multi,'upcoming',now)).toBe('2026-10-20');
   expect(visibleVisits([multi],'week','','',new Date('2026-10-26T00:00:00Z'))).toEqual([]);
 });
 it('still withholds cancelled, duplicate, removed and excluded all-day entries from scheduled views',()=>{
   const now=new Date('2026-10-20T00:00:00Z');
   for(const change of [{cancelled:true},{removed:true},{duplicate:true},{kind:'excluded' as const}])expect(visibleVisits([{...multi,...change}],'today','','',now)).toEqual([]);
 });
});
