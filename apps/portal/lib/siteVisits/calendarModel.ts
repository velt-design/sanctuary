import type { CalendarVisit } from './contract';
const VISIT_TIME_ZONE = 'Pacific/Auckland';
export const visitDay = (iso: string) => new Intl.DateTimeFormat('en-CA',{timeZone:VISIT_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
export const visitTime = (iso: string) => new Intl.DateTimeFormat('en-NZ',{timeZone:VISIT_TIME_ZONE,hour:'numeric',minute:'2-digit'}).format(new Date(iso));
export const visitDate = (iso: string) => new Intl.DateTimeFormat('en-NZ',{timeZone:VISIT_TIME_ZONE,weekday:'long',day:'numeric',month:'long'}).format(new Date(iso));
export const visitStamp = (iso: string) => new Intl.DateTimeFormat('en-NZ',{timeZone:VISIT_TIME_ZONE,dateStyle:'medium',timeStyle:'short'}).format(new Date(iso));
export const visitDateOnly = (date:string) => new Intl.DateTimeFormat('en-NZ',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long'}).format(new Date(`${date}T00:00:00Z`));
const previousDate=(date:string)=>new Date(Date.parse(`${date}T00:00:00Z`)-86400000).toISOString().slice(0,10);
export function visitDateRange(v:CalendarVisit) {
  if(!v.isAllDay)return visitDate(v.startsAt);
  const first=v.allDayStartDate!,last=previousDate(v.allDayEndDate!);
  return first===last?visitDateOnly(first):`${visitDateOnly(first)} to ${visitDateOnly(last)}`;
}
export function visitScheduleLabel(v:CalendarVisit) {
  if(v.isAllDay)return `${visitDateRange(v)}, All day`;
  return `${visitDate(v.startsAt)}, ${visitTime(v.startsAt)} to ${visitDay(v.startsAt)!==visitDay(v.endsAt)?`${visitDate(v.endsAt)}, `:''}${visitTime(v.endsAt)}`;
}
export function visitHasNotEnded(v:CalendarVisit,now=new Date()) {return v.isAllDay?v.allDayEndDate!>visitDay(now.toISOString()):Date.parse(v.endsAt)>now.valueOf();}
export function visitGroupDay(v:CalendarVisit,view:string,now=new Date()) {
  if(!v.isAllDay)return visitDay(v.startsAt);
  let first=v.allDayStartDate!;const today=visitDay(now.toISOString());
  if(view==='today'||view==='upcoming')first=first<today?today:first;
  if(view==='week'){const date=new Date(`${today}T00:00:00Z`);const monday=new Date(date.valueOf()-((date.getUTCDay()+6)%7)*86400000).toISOString().slice(0,10);first=first<monday?monday:first;}
  return first;
}
export function isScheduledVisit(v:CalendarVisit) { return v.kind==='visit'&&!v.cancelled&&!v.removed&&!v.duplicate; }
export function requiresVisitReview(v:CalendarVisit) {return !v.cancelled&&!v.removed&&v.kind!=='excluded'&&(v.kind==='review'||v.kind==='provisional'||v.duplicate||v.reviewReasons.length>0||!v.projectId);}
export function visibleVisits(events:CalendarVisit[],view:string,person:string,query:string,now=new Date()) {
  const today=visitDay(now.toISOString());
  const utc=new Date(`${today}T00:00:00Z`);const weekday=(utc.getUTCDay()+6)%7;
  const monday=new Date(utc.getTime()-weekday*86400000).toISOString().slice(0,10);
  const sunday=new Date(utc.getTime()+(6-weekday)*86400000).toISOString().slice(0,10);
  const words=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return events.filter(v=>{
    const day=v.isAllDay?v.allDayStartDate!:visitDay(v.startsAt),last=v.isAllDay?previousDate(v.allDayEndDate!):day;
    if(view==='review'){if(!requiresVisitReview(v))return false;}
    else if(view==='changes'){if(!v.cancelled&&!v.removed&&v.kind!=='excluded')return false;}
    else {if(v.cancelled||v.removed||v.duplicate||!['visit','provisional'].includes(v.kind))return false;
      if(view==='today'&&(day>today||last<today))return false;
      if(view==='week'&&(last<monday||day>sunday))return false;
      if(view==='upcoming'&&last<today)return false;}
    if(person==='unassigned'&&v.staff.length)return false;
    if(person&&person!=='unassigned'&&!v.staff.some(p=>p.email===person))return false;
    const text=[v.subject,v.address,v.contactName,v.projectName,v.assignmentHint,...v.staff.map(p=>p.name)].join(' ').toLowerCase();
    return words.every(word=>text.includes(word));
  }).sort((a,b)=>a.startsAt.localeCompare(b.startsAt)||a.subject.localeCompare(b.subject));
}
