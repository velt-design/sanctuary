import { z } from 'zod';
import { mirrorEventSchema, type MirrorEvent } from './contract';

const graphEvent = z.object({
  id:z.string().min(1).max(1200),iCalUId:z.string().max(1200).nullish(),subject:z.string().max(500).nullish().transform(value=>value??''),
  start:z.object({dateTime:z.string(),timeZone:z.string()}),end:z.object({dateTime:z.string(),timeZone:z.string()}),
  sensitivity:z.enum(['normal','personal','private','confidential']),isCancelled:z.boolean(),webLink:z.string().max(3000).nullish(),
  body:z.object({content:z.string().max(200000),contentType:z.string()}).nullish(),
  location:z.object({displayName:z.string().max(500).nullish()}).nullish(),
  attendees:z.array(z.object({emailAddress:z.object({address:z.string().max(254),name:z.string().max(150).nullish()})})).max(100),
  categories:z.array(z.string().max(150)).max(50).default([]),
});
export function calendarText(html:string):string {
  return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<(?:br\s*\/?|\/p|\/div|\/tr)>/gi,'\n').replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'");
}
function bookingText(content:string) {
  // Calendar notes can contain a quoted email chain. Only the authored booking
  // fields above that chain may corroborate a project, never a reply signature.
  return calendarText(content.split(/<(?:div|hr)\b[^>]*(?:id=["']divRplyFwdMsg|class=["']gmail_quote)/i)[0]
    .replace(/<blockquote\b[^>]*>[\s\S]*?<\/blockquote>/gi,''))
    .split(/(?:^|\n)\s*(?:[-_ ]*Original Message[-_ ]*|On [^\n]+wrote:|From:[^\n]+\n\s*Sent:)/im)[0]
    .replace(/\*\*/g,'').replace(/!?\[[^\]]*\.(?:jpe?g|png|gif|webp)\]\([^)]*\)/gi,'\n')
    .replace(/\[([^\]]+)\]\([^)]*\)/g,'$1');
}
function labelledCustomerEmails(text:string) {
  const fields=text.replace(/\*\*/g,'').matchAll(/(?:^|\n)\s*email(?:\s+to\s+search(?:\s+up)?(?:\s+in)?\s+info)?\s*:\s*\[?([^\s<>\[\]()]+@[^\s<>\[\]()]+)/gi);
  return [...fields].map(match=>match[1].replace(/[.,;]+$/,'').toLowerCase()).filter(email=>z.email().safeParse(email).success);
}
function leadingCustomerEmail(text:string) {
  const first=text.trim().split(/\r?\n/)[0]?.trim().replace(/^\[([^\]]+)\]\(mailto:[^)]*\)$/i,'$1').replace(/^\[|\]$/g,'').toLowerCase();
  return first&&z.email().safeParse(first).success?[first]:[];
}
function instant(value:{dateTime:string;timeZone:string}) {
  if(!['UTC','Etc/UTC'].includes(value.timeZone))throw new Error('CALENDAR_TIME_ZONE');
  const text=value.dateTime.replace(/(\.\d{3})\d+/,'$1');
  const date=new Date(/[zZ]|[+-]\d\d:\d\d$/.test(text)?text:`${text}Z`);
  if(!Number.isFinite(date.valueOf()))throw new Error('CALENDAR_INVALID_TIME');
  return date.toISOString();
}
function outlookLink(value:string|null|undefined) {try{const u=new URL(value??'');return u.protocol==='https:'&&['outlook.office.com','outlook.office365.com'].includes(u.hostname)?u.href:null;}catch{return null;}}
const addressPattern=/^\s*(?:address\s*[:\-]\s*)?(\d+[a-z]?(?:\s*\/\s*\d+[a-z]?)?\s+[^\n]{3,160}\b(?:road|rd|street|st|avenue|ave|lane|ln|place|pl|drive|dr|way|rise|terrace|crescent|cres|close|view|parade|grove|court|circuit)\b[^\n]{0,150})/im;
export function normalizeCalendarEvent(raw:unknown,staffEmails:Set<string>,mailbox:string):MirrorEvent|null {
  const e=graphEvent.parse(raw);
  if(e.sensitivity!=='normal')return null;
  const text=bookingText(e.body?.content??'');
  const title=e.subject;const evidence=[title,...e.categories].join(' ');
  const explicit=/\bsite\s*visits?\b|\bSV\b/i.test(evidence)||/\bsite\s+visit\b/i.test(text);
  const provisional=/\bplaceholder\b|\bprovisional\b/i.test(title);
  const staff=e.attendees.filter(a=>staffEmails.has(a.emailAddress.address.toLowerCase())).map(a=>({email:a.emailAddress.address.toLowerCase(),name:a.emailAddress.name?.trim()||a.emailAddress.address}));
  const customerEmails=[...new Set([...e.attendees.map(a=>a.emailAddress.address.toLowerCase()),...labelledCustomerEmails(text),...(explicit||provisional?leadingCustomerEmail(text):[])].filter(email=>z.email().safeParse(email).success&&!staffEmails.has(email)&&email!==mailbox.toLowerCase()))];
  const startsAt=instant(e.start),endsAt=instant(e.end);if(endsAt<=startsAt)throw new Error('CALENDAR_INVALID_DURATION');
  const location=e.location?.displayName?.trim();
  const labelled=text.match(/(?:^|\n)\s*address\s*[:\-]\s*([^\r\n]{1,500})/i)?.[1]?.trim();
  const extracted=labelled||location?.match(addressPattern)?.[1]?.trim()||text.match(addressPattern)?.[1]?.trim();
  const address=extracted||(location&&!/teams|https?:|zoom|^tbc$/i.test(location)?location:null);
  const hint=!staff.length?title.match(/(?:^|[-–])\s*(Joe|JP|JR|Dave|David|Jordan)\b/i)?.[1]??null:null;
  const kind=provisional?'provisional':explicit?'visit':'review';
  const reviewReasons:string[]=[];
  if(!staff.length)reviewReasons.push(hint?`${hint} is named in the title; check attending staff.`:'No recognised staff invitation.');
  if(!address)reviewReasons.push('Address not captured. Check Outlook.');
  else if(/^(?:tbc|tbd|to be confirmed|unknown)$/i.test(address))reviewReasons.push('Address is provisional. Check Outlook.');
  if(kind==='review')reviewReasons.push('Check whether this appointment is a site visit.');
  return mirrorEventSchema.parse({sourceKey:e.iCalUId||e.id,sourceId:e.id,subject:title,startsAt,endsAt,sourceUrl:outlookLink(e.webLink),
    address,staff,assignmentHint:hint,kind,customerEmails,cancelled:e.isCancelled,duplicate:false,reviewReasons});
}
export function normalizeCalendar(events:unknown[],staff:Set<string>,mailbox:string) {
  const visits=events.map(e=>normalizeCalendarEvent(e,staff,mailbox)).filter((e):e is MirrorEvent=>Boolean(e));
  const keys=new Set<string>();for(const visit of visits){if(keys.has(visit.sourceKey))throw new Error('CALENDAR_DUPLICATE_ID');keys.add(visit.sourceKey);}
  // Only corroborated duplicate invitations are suppressed. Names alone never identify a booking.
  for(const visit of visits){if(visit.staff.length||visit.cancelled)continue;
    const duplicate=visits.find(other=>other!==visit&&other.staff.length&&other.startsAt===visit.startsAt&&other.endsAt===visit.endsAt&&
      other.customerEmails.some(email=>visit.customerEmails.includes(email))&&visit.address&&other.address?.toLowerCase()===visit.address.toLowerCase());
    if(duplicate){visit.duplicate=true;visit.reviewReasons.push('Possible duplicate invitation. Check the staff booking at this time.');}}
  return visits;
}
