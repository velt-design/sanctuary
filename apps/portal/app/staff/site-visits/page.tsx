import { PortalGuardedPage } from '@/components/page-state/PortalPageSource';
import SiteVisitsAgenda from '@/components/site-visits/SiteVisitsAgenda';
import { connection } from 'next/server';
import { requireStaffPageAccess } from '@/lib/auth';
import { headers } from 'next/headers';
import { DOCUMENT_CALLBACK_HEADER, regionalDocumentCallback } from '@/lib/regionalDocumentAccess';
import { loadCalendarVisitsInitialRead } from './loadCalendarVisitsInitialRead';
export default async function SiteVisitsPage({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}){
  await connection();
  const session=await requireStaffPageAccess('/staff/site-visits');
  const requestHeaders=await headers();
  const callback=regionalDocumentCallback(requestHeaders.get(DOCUMENT_CALLBACK_HEADER));
  // Transport context selects scheduling only. RSC returns/prefetch keep the API path.
  if(callback?.split('?')[0]!=='/staff/site-visits')return <PortalGuardedPage pathname="/staff/site-visits" completion={{}} publicFrame={false}><SiteVisitsAgenda /></PortalGuardedPage>;
  const search=await searchParams??{};
  const first=(value:string|string[]|undefined)=>(Array.isArray(value)?value[0]:value)||null;
  const scope={project:first(search.project),visit:first(search.visit)};
  return <PortalGuardedPage pathname="/staff/site-visits" completion={{}} publicFrame={false}><SiteVisitsAgenda initialRead={loadCalendarVisitsInitialRead(session.user.id,requestHeaders.get('host')??'',scope)} /></PortalGuardedPage>;
}
