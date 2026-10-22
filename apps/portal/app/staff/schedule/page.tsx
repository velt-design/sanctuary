import { requireStaffPageAccess } from '@/lib/auth';
import ScheduleClient from './ScheduleClient';
import SiteVisitsScheduleClient from './SiteVisitsScheduleClient';
import { loadSchedulePageSeed } from '@/lib/scheduling/serverSchedulePageSeed';
import { headers } from 'next/headers';
import { NAVIGATION_CALLBACK_HEADER, regionalNavigationCallback } from '@/lib/regionalDocumentAccess';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function StaffSchedulePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireStaffPageAccess('/staff/schedule');
  const resolvedSearchParams = await searchParams;
  const rawView = resolvedSearchParams?.view;
  const view = Array.isArray(rawView) ? rawView[0] : rawView;

  if ((view ?? '').trim().toLowerCase() === 'site-visits') {
    return <SiteVisitsScheduleClient />;
  }

  const scheduleView = (view ?? '').trim().toLowerCase() === 'gantt' ? 'gantt' : 'board';
  // The real schedule mounts while this request-owned read is still running.
  // Failed initial reads fall back to the normal authenticated query/retry path.
  // Navigation/prefetch already has an independently guarded client query. Do
  // not start another full report alongside that query or its prefetched cache.
  const navigation = regionalNavigationCallback((await headers()).get(NAVIGATION_CALLBACK_HEADER));
  const seed = navigation?.split('?')[0] === '/staff/schedule'
    ? undefined
    : loadSchedulePageSeed({ view: scheduleView }).catch(() => null);
  return (
    <ScheduleClient
      initialSeedKind={scheduleView}
      initialSeed={seed}
    />
  );
}
