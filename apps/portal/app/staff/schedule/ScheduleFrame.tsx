'use client';

import type { ReactNode } from 'react';
import ScheduleBoardSurface from './ScheduleBoardSurface';
import ScheduleGanttSurface from './ScheduleGanttSurface';
import { PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import StaffPageHeader from '@/components/layout/StaffPageHeaderSurface';
import HeaderActions from '@/components/layout/HeaderActions';
import { DataStatePanel } from '@/components/ui/foundation/FoundationFeedback';
import type { ScheduleBoardViewProps } from './ScheduleBoardView';
import type { ScheduleGanttViewProps } from './ScheduleGanttView';
import styles from './schedule.module.css';
import ScheduleViewTabs, { type ScheduleView } from './ScheduleViewTabs';

export type ScheduleFrameProps = {
  view: 'board' | 'gantt' | 'site_visits';
  tabs: ReactNode;
  saveStatus?: ReactNode;
  notices?: ReactNode;
  pendingChanges?: ReactNode;
  issues?: ReactNode;
  diagnostics?: ReactNode;
  board: ScheduleBoardViewProps;
  gantt: ScheduleGanttViewProps;
  dialogs?: ReactNode;
};

type PendingScheduleControls = {
  unavailable?: boolean; onRetry?: () => void;
  today: string; view: ScheduleView; query: string; showCompleted: boolean; unscheduledCollapsed: boolean;
  setQuery: (value: string) => void; setShowCompleted: (value: boolean) => void;
  selectView: (view: ScheduleView) => void; toggleUnscheduled: () => void; openUnscheduled: () => void;
};

/** The existing header, toolbar and calendar keep one DOM owner as evidence arrives. */
export default function ScheduleFrame(input: ScheduleFrameProps | { pending: PendingScheduleControls }) {
  const pending = 'pending' in input ? input.pending : null;
  const supplied = 'pending' in input ? null : input;
  const view = pending?.view ?? supplied!.view;
  const tabs = supplied ? supplied.tabs : <ScheduleViewTabs view={pending!.view} onChange={pending!.selectView} onIntent={() => undefined} />;
  const saveStatus = supplied ? supplied.saveStatus : <span className={styles.saveStatus} role="status">{pending?.unavailable ? 'Unavailable' : 'Reading schedule…'}</span>;
  const notices = supplied?.notices ?? (pending?.unavailable ? <DataStatePanel state="unavailable" title="Schedule unavailable" description="Current schedule access could not be verified." onRetry={pending.onRetry} /> : null);
  const board = supplied?.board ?? { query: pending!.query, showCompleted: pending!.showCompleted, unscheduledCollapsed: pending!.unscheduledCollapsed, onQueryChange: pending!.setQuery, onShowCompletedChange: pending!.setShowCompleted, onToggleUnscheduledCollapsed: pending!.toggleUnscheduled, dataError: pending!.unavailable };
  const gantt = supplied?.gantt ?? { today: pending!.today, showCompleted: pending!.showCompleted, onShowCompletedChange: pending!.setShowCompleted, onOpenUnscheduled: pending!.openUnscheduled, dataError: pending!.unavailable };
  const { pendingChanges, issues, diagnostics, dialogs } = supplied ?? {};
  return <PageLayout width="full" density="compact" data-ui-foundation-consumer="schedule"
    className={`${styles.page} ${styles.pageLocked}`}>
    <StaffPageHeader title="Schedule" right={<HeaderActions>
      {view === 'gantt' ? saveStatus : null}
      {tabs}
    </HeaderActions>} />
    <div className={`${styles.stack} ${styles.stackLocked}`}>
      {notices}
      {pendingChanges}
      {issues}
      {diagnostics}
      {view === 'gantt' ? <div className={styles.panels}>
        <section className={styles.mainPanel} aria-label="Installer lanes">
          <ScheduleGanttSurface {...gantt} />
        </section>
      </div> : <ScheduleBoardSurface {...board} />}
      {dialogs}
    </div>
  </PageLayout>;
}
