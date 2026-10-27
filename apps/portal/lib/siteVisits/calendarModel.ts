import type { CalendarVisit } from './contract';
import { personKey,resolveVisitPersonKey } from './reviewedVisit';
import { calendarVisitDateEstimate,visitDateEstimateLabel } from './visitDateEstimate';
const VISIT_TIME_ZONE = 'Pacific/Auckland';
export const visitDay = (iso: string) => new Intl.DateTimeFormat('en-CA',{timeZone:VISIT_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
export const visitTime = (iso: string) => new Intl.DateTimeFormat('en-NZ',{timeZone:VISIT_TIME_ZONE,hour:'numeric',minute:'2-digit'}).format(new Date(iso));
export const visitDate = (iso: string) => new Intl.DateTimeFormat('en-NZ',{timeZone:VISIT_TIME_ZONE,weekday:'long',day:'numeric',month:'long'}).format(new Date(iso));
export const visitStamp = (iso: string) => new Intl.DateTimeFormat('en-NZ',{timeZone:VISIT_TIME_ZONE,dateStyle:'medium',timeStyle:'short'}).format(new Date(iso));
export const visitDateOnly = (date:string) => new Intl.DateTimeFormat('en-NZ',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long'}).format(new Date(`${date}T00:00:00Z`));
const previousDate=(date:string)=>new Date(Date.parse(`${date}T00:00:00Z`)-86400000).toISOString().slice(0,10);
export function visitDateRange(v:CalendarVisit) {
  if(v.timing)return v.timing.date?`${visitDateOnly(v.timing.date)}${visitDateEstimateLabel(calendarVisitDateEstimate(v))}`:'Date not recorded';
  if(!v.isAllDay)return v.startsAt?visitDate(v.startsAt):'Date not recorded';
  const first=v.allDayStartDate!,last=previousDate(v.allDayEndDate!);
  return first===last?visitDateOnly(first):`${visitDateOnly(first)} to ${visitDateOnly(last)}`;
}
export function visitScheduleLabel(v:CalendarVisit) {
  if(v.timing)return v.timing.mode==='unknown'?'Date and time not recorded':`${visitDateRange(v)}, ${visitClockLabel(v)}`;
  if(v.isAllDay)return `${visitDateRange(v)}, All day`;
  if(!v.startsAt)return 'Date and time not recorded';
  return `${visitDate(v.startsAt)}, ${visitTime(v.startsAt)}${v.endsAt?` to ${visitDay(v.startsAt)!==visitDay(v.endsAt)?`${visitDate(v.endsAt)}, `:''}${visitTime(v.endsAt)}`:''}`;
}
const wallClock=(value:string)=>{const [h,m]=value.split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'am':'pm'}`;};
export function visitClockLabel(v:CalendarVisit){
  const t=v.timing;if(t)return t.mode==='unknown'?'Date unknown':t.mode==='date'?'Time not recorded':t.mode==='window'?`Access ${wallClock(t.time!)} to ${wallClock(t.endTime!)}`:`Agreed ${wallClock(t.time!)}`;
  return v.isAllDay?'All day':v.startsAt?visitTime(v.startsAt):'Date unknown';
}
const visitStartDay=(v:CalendarVisit)=>v.timing?v.timing.date:v.isAllDay?v.allDayStartDate:v.startsAt?visitDay(v.startsAt):null;
const visitSortClock=(v:CalendarVisit)=>v.timing?v.timing.time??'':v.isAllDay||!v.startsAt?'':new Intl.DateTimeFormat('en-GB',{timeZone:VISIT_TIME_ZONE,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(v.startsAt));
export const compareVisitSchedule=(a:CalendarVisit,b:CalendarVisit)=>(visitStartDay(a)??'9999').localeCompare(visitStartDay(b)??'9999')||visitSortClock(a).localeCompare(visitSortClock(b))||a.subject.localeCompare(b.subject);
export function visitHasNotEnded(v:CalendarVisit,now=new Date()) {
  if(v.status==='attended'||v.status==='not_attended'||v.correction?.sourceChanged||v.withdrawn)return false;
  if(v.timing){const t=v.timing,today=visitDay(now.toISOString());if(!t.date||t.date<today)return false;if(t.date>today||t.mode==='date')return true;
    const clock=new Intl.DateTimeFormat('en-GB',{timeZone:VISIT_TIME_ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);return (t.endTime??t.time??'')>clock;}
  return v.isAllDay?v.allDayEndDate!>visitDay(now.toISOString()):Boolean(v.endsAt&&Date.parse(v.endsAt)>now.valueOf());
}
export function visitGroupDay(v:CalendarVisit,view:string,now=new Date()) {
  if(v.timing||!v.isAllDay)return visitStartDay(v)??'unknown';
  let first=v.allDayStartDate!;const today=visitDay(now.toISOString());
  if(view==='today'||view==='upcoming')first=first<today?today:first;
  if(view==='week'){const date=new Date(`${today}T00:00:00Z`);const monday=new Date(date.valueOf()-((date.getUTCDay()+6)%7)*86400000).toISOString().slice(0,10);first=first<monday?monday:first;}
  return first;
}
export function isScheduledVisit(v:CalendarVisit) { return v.kind==='visit'&&!v.cancelled&&!v.removed&&!v.duplicate&&!v.withdrawn&&!v.correction?.sourceChanged&&v.status!=='attended'&&Boolean(visitStartDay(v)); }
export function requiresVisitReview(v:CalendarVisit) {
  if(v.withdrawn)return false;if(v.correction?.sourceChanged)return true;
  if(v.correction)return v.reviewReasons.length>0||(!v.projectId&&v.kind!=='excluded'&&!v.cancelled);
  return !v.cancelled&&!v.removed&&v.kind!=='excluded'&&(v.kind==='review'||v.kind==='provisional'||v.duplicate||v.reviewReasons.length>0||!v.projectId);
}
export function visibleVisits(events:CalendarVisit[],view:string,person:string,query:string,now=new Date()) {
  person=resolveVisitPersonKey(events,person);
  const today=visitDay(now.toISOString());
  const utc=new Date(`${today}T00:00:00Z`);const weekday=(utc.getUTCDay()+6)%7;
  const monday=new Date(utc.getTime()-weekday*86400000).toISOString().slice(0,10);
  const sunday=new Date(utc.getTime()+(6-weekday)*86400000).toISOString().slice(0,10);
  const words=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return events.filter(v=>{
    const day=visitStartDay(v),last=v.isAllDay&&!v.timing?previousDate(v.allDayEndDate!):day;
    if(view==='review'){if(!requiresVisitReview(v))return false;}
    else if(view==='changes'){if(!v.cancelled&&!v.removed&&v.kind!=='excluded')return false;}
    else if(view==='history'){if(day&&day>today&&v.status!=='attended')return false;}
    else {if(v.cancelled||v.removed||v.duplicate||!['visit','provisional'].includes(v.kind))return false;
      if(!day||!last)return false;
      if(view==='today'&&(day>today||last<today))return false;
      if(view==='week'&&(last<monday||day>sunday))return false;
      if(view==='upcoming'&&last<today)return false;}
    if(person==='unassigned'&&v.staff.length)return false;
    if(person&&person!=='unassigned'&&!v.staff.some(p=>personKey(p)===person||p.email===person))return false;
    const text=[v.subject,v.address,v.contactName,v.projectName,v.assignmentHint,...v.staff.map(p=>p.name)].join(' ').toLowerCase();
    return words.every(word=>text.includes(word));
  }).sort(compareVisitSchedule);
}
