import { requireStaffContext } from '@/lib/api/staffApi';
import { calendarJson } from '@/lib/siteVisits/http';
export const runtime='nodejs';
export async function GET(request:Request){
  const auth=await requireStaffContext();if(!auth.ok)return calendarJson({error:'Unauthorized'},401);
  const params=new URL(request.url).searchParams;const query=params.get('q')?.trim()??'';
  if(query.length<2||query.length>100||[...params.keys()].some(k=>k!=='q')||params.getAll('q').length!==1)return calendarJson({error:'Enter 2 to 100 characters.'},400);
  const result=await auth.supabase.rpc('outlook_site_visit_projects',{p_query:query});
  if(result.error)return calendarJson({error:'Projects could not be searched.'},result.error.code==='42501'?403:503);
  return calendarJson(result.data);
}
