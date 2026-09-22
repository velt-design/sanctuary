import MarketingPerformance from '@/components/marketingPerformance/MarketingPerformance';
import { notFound } from 'next/navigation';
import { requireStaffPageAccess } from '@/lib/auth';
import { isDeveloper } from '@/lib/developerAccess';

export const dynamic = 'force-dynamic';
export default async function MarketingPerformancePage() {
  const session = await requireStaffPageAccess('/staff/marketing-performance');
  if (!isDeveloper(session.user)) notFound();
  const snapshot=process.env.MARKETING_PERFORMANCE_PREVIEW==='production-snapshot';
  if(snapshot&&process.env.VERCEL_ENV!=='preview')notFound();
  return <MarketingPerformance staging={process.env.MARKETING_PERFORMANCE_PREVIEW === 'staging'} productionSnapshot={snapshot}
    previewDescription={snapshot?'Private production snapshot · Real records from 23 September 2025 through 22 September 2026; outcomes frozen at the read time below. Refresh rereads this snapshot. Project links open the live Portal; other preview pages use staging records.':undefined}/>;
}
