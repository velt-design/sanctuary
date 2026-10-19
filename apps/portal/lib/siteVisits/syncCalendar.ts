import 'server-only';
import { randomUUID } from 'node:crypto';
import { supabaseServiceRole } from '@/lib/supabaseClient';
import { outlookCalendarConfig } from './config';
import { CalendarSourceError, readGraphCalendar } from './graphCalendar';
import { normalizeCalendar } from './normalizeCalendar';

async function calendarCommand(action:string,binding:string,operation:string,payload:unknown={}) {
  const result=await supabaseServiceRole.rpc('outlook_calendar_sync',{p_action:action,p_binding:binding,p_operation:operation,p_input:payload});
  if(result.error)throw new Error('CALENDAR_STORE_UNAVAILABLE');return result.data as {claimed?:boolean;reason?:string;published?:boolean};
}
export async function syncOutlookCalendar(assertion:string) {
  const cfg=outlookCalendarConfig(),operation=randomUUID();
  const claim=await calendarCommand('claim',cfg.binding,operation);
  if(!claim.claimed)return {updated:false,reason:claim.reason??'busy'};
  try{
    const now=Date.now();const from=new Date(now-30*86400000).toISOString(),to=new Date(now+90*86400000).toISOString();
    const raw=await readGraphCalendar(cfg,assertion,from,to,AbortSignal.timeout(45000));
    const events=normalizeCalendar(raw,cfg.staffEmails,cfg.mailbox);
    const hiddenKeys=raw.flatMap(value=>{const e=value as {sensitivity?:string;iCalUId?:string;id?:string};return e.sensitivity&&e.sensitivity!=='normal'?[e.iCalUId||e.id].filter(Boolean):[];});
    const result=await calendarCommand('publish',cfg.binding,operation,{from,to,events,hiddenKeys,sourceCount:raw.length});
    if(!result.published)throw new Error('CALENDAR_PUBLICATION_LOST');
    return {updated:true,count:events.length};
  }catch(error){
    const code=error instanceof CalendarSourceError?error.code:'SYNC_FAILED';
    await calendarCommand('fail',cfg.binding,operation,{code}).catch(()=>undefined);
    throw new CalendarSourceError(code==='SYNC_FAILED'?'SOURCE_INVALID':code);
  }
}
