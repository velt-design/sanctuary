import GuardedGlobalPortalSearch from '@/components/layout/GuardedGlobalPortalSearch';
import { requireStaffPageAccess } from '@/lib/auth';
import DashboardClient from './DashboardClient';
import { parseDashboardQueueMode } from '@/lib/dashboard/queueMode';
import { PortalGuardedPage } from '@/components/page-state/PortalPageSource';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function readFirst(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === 'string' ? value : null;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireStaffPageAccess('/dashboard');
  const resolvedSearchParams = await searchParams;
  const queueMode = parseDashboardQueueMode(readFirst(resolvedSearchParams?.queue));
  return <PortalGuardedPage pathname="/dashboard" completion={{}}>
    <GuardedGlobalPortalSearch/>
    <DashboardClient queueMode={queueMode} />
  </PortalGuardedPage>;
}
