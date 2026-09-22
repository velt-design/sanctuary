import MarketingPerformance from '@/components/marketingPerformance/MarketingPerformance';
import { notFound } from 'next/navigation';
import { requireStaffPageAccess } from '@/lib/auth';
import { isDeveloper } from '@/lib/developerAccess';

export const dynamic = 'force-dynamic';
export default async function MarketingPerformancePage() {
  const session = await requireStaffPageAccess('/staff/marketing-performance');
  if (!isDeveloper(session.user)) notFound();
  return <MarketingPerformance staging={process.env.MARKETING_PERFORMANCE_PREVIEW === 'staging'} />;
}
