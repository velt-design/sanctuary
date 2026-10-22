import { requireStaffContext } from '@/lib/api/staffApi';
import { calendarJson } from '@/lib/siteVisits/http';
import { readSavedVisits } from '@/lib/siteVisits/readSavedVisits.server';
export const runtime='nodejs';
export async function GET(request:Request){
  const auth=await requireStaffContext();if(!auth.ok)return calendarJson({error:'Unauthorized'},401);
  const result=await readSavedVisits(auth.supabase,new URL(request.url).searchParams);
  return result.ok?calendarJson(result.data):calendarJson({error:result.message},result.status);
}
