import 'server-only';
import type { OutlookCalendarConfig } from './config';

export class CalendarSourceError extends Error {
  constructor(readonly code:'ACCESS_REQUIRED'|'SOURCE_UNAVAILABLE'|'SOURCE_LIMIT'|'SOURCE_INVALID'){super(code);}
}
async function json(response:Response) {
  if(!response.ok)throw new CalendarSourceError([401,403].includes(response.status)?'ACCESS_REQUIRED':'SOURCE_UNAVAILABLE');
  const reader=response.body?.getReader();if(!reader)throw new CalendarSourceError('SOURCE_INVALID');
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>4_000_000){await reader.cancel();throw new CalendarSourceError('SOURCE_LIMIT');}chunks.push(part.value);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string,unknown>;}catch{throw new CalendarSourceError('SOURCE_INVALID');}
}
export async function readGraphCalendar(cfg:OutlookCalendarConfig,assertion:string,from:string,to:string,signal:AbortSignal,fetcher:typeof fetch=fetch) {
  if(!assertion||assertion.length>20000)throw new CalendarSourceError('ACCESS_REQUIRED');
  const token=await json(await fetcher(`https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`,{
    method:'POST',redirect:'error',cache:'no-store',signal,headers:{'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({client_id:cfg.clientId,client_assertion:assertion,client_assertion_type:'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',grant_type:'client_credentials',scope:'https://graph.microsoft.com/.default'}),
  }));
  if(typeof token.access_token!=='string'||!token.access_token||token.token_type!=='Bearer')throw new CalendarSourceError('SOURCE_INVALID');
  const base=`https://graph.microsoft.com/v1.0/users/${cfg.mailboxId}/calendars/${encodeURIComponent(cfg.calendarId)}/calendarView`;
  const first=new URL(base);first.searchParams.set('startDateTime',from);first.searchParams.set('endDateTime',to);first.searchParams.set('$top','100');
  let next:string|null=first.href;const seen=new Set<string>();const events:unknown[]=[];
  while(next){
    const url=new URL(next);
    if(url.origin!=='https://graph.microsoft.com'||url.pathname!==new URL(base).pathname||url.username||url.password||url.hash||seen.has(next))throw new CalendarSourceError('SOURCE_INVALID');
    if(seen.size>=20)throw new CalendarSourceError('SOURCE_LIMIT');seen.add(next);
    const page=await json(await fetcher(next,{method:'GET',redirect:'error',cache:'no-store',signal,headers:{authorization:`Bearer ${token.access_token}`,Prefer:'outlook.timezone="UTC", outlook.body-content-type="text", IdType="ImmutableId"'}}));
    if(!Array.isArray(page.value)||events.length+page.value.length>2000)throw new CalendarSourceError('SOURCE_LIMIT');
    events.push(...page.value);
    if(page['@odata.nextLink']!==undefined&&typeof page['@odata.nextLink']!=='string')throw new CalendarSourceError('SOURCE_INVALID');
    next=typeof page['@odata.nextLink']==='string'?page['@odata.nextLink']:null;
  }
  return events;
}
