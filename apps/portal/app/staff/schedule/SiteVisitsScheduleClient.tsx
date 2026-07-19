'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import HeaderActions from '@/components/layout/HeaderActions';
import PageHeader from '@/components/layout/PageHeader';
import { usePortalRouteTransition } from '@/components/page-state/PortalRouteTransition';
import ScheduleViewTabs, { type ScheduleView } from './ScheduleViewTabs';
import styles from './schedule.module.css';

const LazySiteVisitsView = dynamic(() => import('./SiteVisitsView'), {
  ssr: false,
  loading: () => <p className={styles.note}>Loading site visits...</p>,
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
    startUiTransition(() => {
      router.replace(href);
    });
  };

  return (
    <main className={cx(styles.page, styles.pageLocked)}>
      <PageHeader
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
    </main>
  );
}
