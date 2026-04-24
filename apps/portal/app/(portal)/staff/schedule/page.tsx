import ScheduleClient from './ScheduleClient';
import SiteVisitsScheduleClient from './SiteVisitsScheduleClient';
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
    return <SiteVisitsScheduleClient />;
  }

  const scheduleView = (view ?? '').trim().toLowerCase() === 'gantt' ? 'gantt' : 'board';
  const seed = await loadSchedulePageSeed({ view: scheduleView });
  return (
    <ScheduleClient
      initialScheduleMode={seed.initialScheduleMode}
      initialSeedKind={seed.initialScheduleMode === 'v2' ? seed.initialSeedKind : undefined}
      initialV2Snapshot={seed.initialV2Snapshot}
    />
  );
}
