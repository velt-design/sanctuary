import DashboardClient from './DashboardClient';
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
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const queueMode = parseDashboardQueueMode(readFirst(resolvedSearchParams?.queue));
  return <DashboardClient queueMode={queueMode} />;
}
