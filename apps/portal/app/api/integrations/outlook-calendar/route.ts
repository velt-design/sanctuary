import { equalSecret } from '@/lib/xero/security';
import { calendarJson } from '@/lib/siteVisits/http';
import { syncOutlookCalendar } from '@/lib/siteVisits/syncCalendar';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request:Request){
  const secret=process.env.CRON_SECRET;
  if(!secret||secret.length<32||!equalSecret(request.headers.get('authorization')??'',`Bearer ${secret}`))return calendarJson({error:'Unauthorized'},401);
  if(new URL(request.url).search)return calendarJson({error:'Invalid request'},400);
  if(process.env.SANCTUARY_OUTLOOK_ENABLED!=='true')return calendarJson({enabled:false});
  try{return calendarJson(await syncOutlookCalendar(request.headers.get('x-vercel-oidc-token')??''));}catch{return calendarJson({error:'Calendar refresh failed'},503);}
}
