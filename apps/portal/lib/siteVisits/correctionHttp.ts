import 'server-only';
import { requireStaffContext } from '@/lib/api/staffApi';
import { correctionCommand,historyCommand } from './correctionContract';
import { calendarJson,calendarSameOrigin } from './http';
import { reviewedVisit } from './reviewedVisit';
import { projectOwnerOption } from '@/lib/projects/commandCentre/projectOwners';
import type { CalendarVisit } from './contract';

export async function saveVisitDetails(request:Request,history=false){
  const auth=await requireStaffContext();if(!auth.ok)return calendarJson({error:'Unauthorized'},401);
  if(!calendarSameOrigin(request)||!request.headers.get('content-type')?.startsWith('application/json'))return calendarJson({error:'Origin not allowed'},403);
  const text=await request.text();if(text.length>16000)return calendarJson({error:'Visit details are too long.'},400);
  let body:unknown;try{body=JSON.parse(text);}catch{return calendarJson({error:'Invalid visit details.'},400);}
  const parsed=(history?historyCommand:correctionCommand).safeParse(body);
  if(!parsed.success)return calendarJson({error:parsed.error.issues[0]?.message??'Check the visit details.'},400);
  const staff=parsed.data.details.staff??[];
  if(staff.some(person=>person.staffId?projectOwnerOption(person.staffId)?.displayName!==person.name||person.email!=='':!person.email))return calendarJson({error:'Choose a known staff member.'},400);
  const imported=staff.filter(person=>!person.staffId);
  if(imported.length){
    // Read the immutable source projection, never local correction details as identity authority.
    const known=await auth.supabase.rpc('outlook_site_visits_read',{p_project:parsed.data.projectId});
    if(known.error)return calendarJson({error:'Staff identities could not be checked. Your changes are kept; retry shortly.'},503);
    let sourcePeople=(known.data?.events??[]).filter((v:CalendarVisit)=>v.origin==='outlook').flatMap((v:CalendarVisit)=>v.staff);
    if(parsed.data.projectId&&imported.some(person=>!sourcePeople.some((p:typeof person)=>p.email===person.email&&p.name===person.name))){
      const broader=await auth.supabase.rpc('outlook_site_visits_read',{p_project:null});
      if(broader.error)return calendarJson({error:'Staff identities could not be checked. Your changes are kept; retry shortly.'},503);
      sourcePeople=[...sourcePeople,...(broader.data?.events??[]).filter((v:CalendarVisit)=>v.origin==='outlook').flatMap((v:CalendarVisit)=>v.staff)];
    }
    if(imported.some(person=>!sourcePeople.some((p:typeof person)=>p.email===person.email&&p.name===person.name)))return calendarJson({error:'Choose a known staff member.'},400);
  }
  const result=await auth.supabase.rpc(history?'site_visit_history_save':'site_visit_correct',{p_input:parsed.data});
  if(result.error)return calendarJson({error:result.error.code==='40001'?'This visit changed. Reload it, check your retained choices and try again.':result.error.code==='42501'?'Your access has changed.':'The visit could not be saved. Check the details and retry.'},result.error.code==='40001'?409:result.error.code==='42501'?403:400);
  return calendarJson({visit:reviewedVisit(result.data)});
}
