import SiteVisitsAgenda from '@/components/site-visits/SiteVisitsAgenda';
import { connection } from 'next/server';
import { requireStaffPageAccess } from '@/lib/auth';
export default async function SiteVisitsPage(){
  await connection();
  await requireStaffPageAccess('/staff/site-visits');
  return <SiteVisitsAgenda />;
}
