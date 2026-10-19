import { requireStaffContext } from '@/lib/api/staffApi';
import { calendarJson,calendarSameOrigin } from '@/lib/siteVisits/http';
import { syncOutlookCalendar } from '@/lib/siteVisits/syncCalendar';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request){
  const auth=await requireStaffContext();if(!auth.ok)return calendarJson({error:'Unauthorized'},401);
  if(!calendarSameOrigin(request)||new URL(request.url).search||await request.text())return calendarJson({error:'Invalid refresh request'},403);
  const authority=await auth.supabase.rpc('outlook_site_visits_read',{p_project:null});
  if(authority.error)return calendarJson({error:'Calendar access unavailable'},authority.error.code==='42501'?403:503);
  if(!authority.data?.enabled)return calendarJson({error:'Calendar connection is not active.'},503);
  try{return calendarJson(await syncOutlookCalendar(request.headers.get('x-vercel-oidc-token')??''));}catch{return calendarJson({error:'Outlook could not be refreshed. The last successful calendar is retained.'},503);}
}
