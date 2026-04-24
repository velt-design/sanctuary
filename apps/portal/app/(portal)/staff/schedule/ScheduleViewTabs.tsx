'use client';

import styles from './schedule.module.css';

export type ScheduleView = 'board' | 'gantt' | 'site_visits';

export default function ScheduleViewTabs({
  view,
  onChange,
}: {
  view: ScheduleView;
  onChange: (next: ScheduleView) => void;
}) {
  return (
    <>
      <button type="button" className={styles.buttonSecondary} aria-pressed={view === 'board'} onClick={() => onChange('board')}>
        Board
      </button>
      <button type="button" className={styles.buttonSecondary} aria-pressed={view === 'gantt'} onClick={() => onChange('gantt')}>
        Gantt
      </button>
      <button type="button" className={styles.buttonSecondary} aria-pressed={view === 'site_visits'} onClick={() => onChange('site_visits')}>
        Site visits
      </button>
    </>
  );
}
