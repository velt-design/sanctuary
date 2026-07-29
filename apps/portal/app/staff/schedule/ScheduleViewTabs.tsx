'use client';

import styles from './schedule.module.css';

export type ScheduleView = 'board' | 'gantt' | 'site_visits';

export default function ScheduleViewTabs({
  view,
  onChange,
  onIntent,
}: {
  view: ScheduleView;
  onChange: (next: ScheduleView, control: HTMLButtonElement) => void;
  onIntent?: (next: ScheduleView) => void;
}) {
  return (
    <>
      <button
        type="button"
        className={styles.buttonSecondary}
        aria-pressed={view === 'board'}
        onFocus={() => onIntent?.('board')}
        onPointerEnter={() => onIntent?.('board')}
        onPointerDown={() => onIntent?.('board')}
        onClick={(event) => onChange('board', event.currentTarget)}
      >
        Board
      </button>
      <button
        type="button"
        className={styles.buttonSecondary}
        aria-pressed={view === 'gantt'}
        onFocus={() => onIntent?.('gantt')}
        onPointerEnter={() => onIntent?.('gantt')}
        onPointerDown={() => onIntent?.('gantt')}
        onClick={(event) => onChange('gantt', event.currentTarget)}
      >
        Gantt
      </button>
    </>
  );
}
