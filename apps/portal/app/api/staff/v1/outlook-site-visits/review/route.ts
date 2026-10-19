import { requireStaffContext } from '@/lib/api/staffApi';
import { calendarJson,calendarSameOrigin } from '@/lib/siteVisits/http';
import { reviewCommand } from '@/lib/siteVisits/contract';
export const runtime='nodejs';
export async function POST(request:Request){
  const auth=await requireStaffContext();if(!auth.ok)return calendarJson({error:'Unauthorized'},401);
  if(!calendarSameOrigin(request)||!request.headers.get('content-type')?.startsWith('application/json'))return calendarJson({error:'Origin not allowed'},403);
  const input=reviewCommand.safeParse(await request.json().catch(()=>null));if(!input.success)return calendarJson({error:'Invalid review'},400);
  const result=await auth.supabase.rpc('outlook_site_visit_review',{p_input:input.data});
  if(result.error)return calendarJson({error:result.error.code==='40001'?'This visit changed. Reload before saving.':'Review could not be saved.'},result.error.code==='40001'?409:result.error.code==='42501'?403:400);
  return calendarJson({visit:result.data});
}
