'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import HeaderActions from '@/components/layout/HeaderActions';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import { usePortalRouteTransition } from '@/components/page-state/PortalRouteTransition';
import { PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import ScheduleViewTabs, { type ScheduleView } from './ScheduleViewTabs';
import { SiteVisitsChunkPendingFrame } from './SiteVisitsPendingFrame';
import styles from './schedule.module.css';

const LazySiteVisitsView = dynamic(() => import('./SiteVisitsView'), {
  ssr: false,
  loading: SiteVisitsChunkPendingFrame,
});

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function scheduleViewLabel(view: ScheduleView): string {
  if (view === 'site_visits') return 'Site visits';
  if (view === 'gantt') return 'Gantt';
  return 'Board';
}

function scheduleViewParam(view: ScheduleView): string {
  return view === 'site_visits' ? 'site-visits' : view;
}

export default function SiteVisitsScheduleClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { beginRouteTransition } = usePortalRouteTransition();
  const [, startUiTransition] = useTransition();

  const setScheduleView = (next: ScheduleView, control: HTMLButtonElement) => {
    if (next === 'site_visits') return;
    const qs = new URLSearchParams(searchParams.toString());
    qs.set('view', scheduleViewParam(next));
    const href = `/staff/schedule?${qs.toString()}`;
    beginRouteTransition({ href, label: scheduleViewLabel(next), source: 'schedule-view', control });
    if (navigator.onLine === false) return;
    startUiTransition(() => {
      router.replace(href);
    });
  };

  return (
    <PageLayout width="full" density="compact" data-ui-foundation-consumer="schedule" className={cx(styles.page, styles.pageLocked)}>
      <StaffPageHeader
        title="Schedule"
        right={
          <HeaderActions>
            <ScheduleViewTabs view="site_visits" onChange={setScheduleView} />
          </HeaderActions>
        }
      />
      <div className={cx(styles.stack, styles.stackLocked)}>
        <LazySiteVisitsView />
      </div>
    </PageLayout>
  );
}
