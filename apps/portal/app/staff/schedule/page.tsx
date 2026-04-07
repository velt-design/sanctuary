import ScheduleClient from './ScheduleClient';
import { loadSchedulePageSeed } from '@/lib/scheduling/serverSchedulePageSeed';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function StaffSchedulePage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const rawView = resolvedSearchParams?.view;
  const view = Array.isArray(rawView) ? rawView[0] : rawView;

  if ((view ?? '').trim().toLowerCase() === 'site-visits') {
    return <ScheduleClient />;
  }

  const seed = await loadSchedulePageSeed();
  return <ScheduleClient initialScheduleMode={seed.initialScheduleMode} initialV2Snapshot={seed.initialV2Snapshot} />;
}
