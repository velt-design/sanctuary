import { requireStaffContext } from '@/lib/api/staffApi';
import { calendarJson } from '@/lib/siteVisits/http';
import { z } from 'zod';
import { reviewedVisit } from '@/lib/siteVisits/reviewedVisit';
export const runtime='nodejs';
export async function GET(request:Request){
  const auth=await requireStaffContext();if(!auth.ok)return calendarJson({error:'Unauthorized'},401);
  const params=new URL(request.url).searchParams;
  if([...params.keys()].some(k=>!['project','visit'].includes(k)||params.getAll(k).length>1))return calendarJson({error:'Invalid calendar query'},400);
  const project=params.get('project')?.replace(/^proj_/,'')??null;
  if(project!==null&&!z.uuid().safeParse(project).success)return calendarJson({error:'Invalid project'},400);
  const visit=params.get('visit');
  if(visit!==null&&!z.uuid().safeParse(visit).success)return calendarJson({error:'Invalid visit'},400);
  const result=visit?await auth.supabase.rpc('outlook_site_visit_detail_read',{p_visit:visit,p_project:project}):await auth.supabase.rpc('outlook_site_visits_read',{p_project:project});
  if(result.error)return calendarJson({error:'Site visits could not be loaded.'},result.error.code==='42501'?403:503);
  return calendarJson({...result.data,events:(result.data?.events??[]).map(reviewedVisit),enabled:Boolean(result.data?.enabled)&&process.env.SANCTUARY_OUTLOOK_ENABLED==='true'});
}
