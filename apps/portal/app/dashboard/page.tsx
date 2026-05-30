import DashboardClient from './DashboardClient';
import DashboardView from './DashboardView';
import { requireStaffPageAccess } from '@/lib/auth';
import { getDashboardData } from '@/lib/dashboard/getDashboardData';
import { parseDashboardQueueMode } from '@/lib/dashboard/queueMode';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function readFirst(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === 'string' ? value : null;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const queueMode = parseDashboardQueueMode(readFirst(resolvedSearchParams?.queue));
  const session = await requireStaffPageAccess('/dashboard');
  const data = await getDashboardData({ queueMode, userId: session.user.id });

  return (
    <>
      <DashboardClient queueMode={queueMode} initialData={data} />
      <DashboardView data={data} />
    </>
  );
}
