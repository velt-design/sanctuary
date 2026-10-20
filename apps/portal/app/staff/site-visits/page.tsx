import SiteVisitsAgenda from '@/components/site-visits/SiteVisitsAgenda';
import { connection } from 'next/server';
export default async function SiteVisitsPage(){
  await connection();
  return <SiteVisitsAgenda />;
}
