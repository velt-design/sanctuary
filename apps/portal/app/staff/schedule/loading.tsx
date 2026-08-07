'use client';

import { useSearchParams } from 'next/navigation';
import SchedulePendingFrame from './SchedulePendingFrame';
import SiteVisitsPendingFrame from './SiteVisitsPendingFrame';

export default function Loading() {
  const view = useSearchParams().get('view')?.trim().toLowerCase();
  if (view === 'site-visits') return <SiteVisitsPendingFrame />;
  return <SchedulePendingFrame view={view === 'gantt' ? 'gantt' : 'board'} />;
}
