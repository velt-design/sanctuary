import MarketingPerformance from '@/components/marketingPerformance/MarketingPerformance';
import { notFound } from 'next/navigation';
import { requireStaffPageAccess } from '@/lib/auth';
import { isDeveloper } from '@/lib/developerAccess';
import { headers } from 'next/headers';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { hubDocumentWindow } from '@/lib/marketingPerformance/hubDocumentSelection';
import { readHub, hubReadFailure } from '@/lib/marketingPerformance/readHub.server';

export const dynamic = 'force-dynamic';
export default async function MarketingPerformancePage() {
  const session = await requireStaffPageAccess('/staff/marketing-performance');
  if (!isDeveloper(session.user)) notFound();
  const snapshot=process.env.MARKETING_PERFORMANCE_PREVIEW==='production-snapshot';
  if(snapshot&&process.env.VERCEL_ENV!=='preview')notFound();
  const window = hubDocumentWindow(new Headers(await headers()));
  const initialHubSeed = window ? { ...window,
    result: getSupabaseServerAuth().then(client => readHub(client, window.start, window.end)).catch(hubReadFailure) } : undefined;
  return <MarketingPerformance staging={process.env.MARKETING_PERFORMANCE_PREVIEW === 'staging'} productionSnapshot={snapshot}
    initialHubSeed={initialHubSeed}
    previewDescription={snapshot?'Private production snapshot · Real records from 23 September 2025 through 22 September 2026; outcomes frozen at the read time below. Refresh rereads this snapshot. Project links open the live Portal; other preview pages use staging records.':undefined}/>;
}
