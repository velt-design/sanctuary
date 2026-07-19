'use client';

import styles from './schedule.module.css';

export type ScheduleView = 'board' | 'gantt' | 'site_visits';

export default function ScheduleViewTabs({
  view,
  onChange,
}: {
  view: ScheduleView;
  onChange: (next: ScheduleView, control: HTMLButtonElement) => void;
}) {
  return (
    <>
      <button type="button" className={styles.buttonSecondary} aria-pressed={view === 'board'} onClick={(event) => onChange('board', event.currentTarget)}>
        Board
      </button>
      <button type="button" className={styles.buttonSecondary} aria-pressed={view === 'gantt'} onClick={(event) => onChange('gantt', event.currentTarget)}>
        Gantt
      </button>
      <button type="button" className={styles.buttonSecondary} aria-pressed={view === 'site_visits'} onClick={(event) => onChange('site_visits', event.currentTarget)}>
        Site visits
      </button>
    </>
  );
}
