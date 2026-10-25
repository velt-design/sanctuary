'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import styles from './ScheduleCrewFilter.module.css';

export type ScheduleCrewFilterOption = {
  id: string;
  name: string;
  color: string;
  itemCount: number;
};

export type ScheduleCrewFilterProps = {
  panel?: ReactNode;
  crews: ScheduleCrewFilterOption[];
  hiddenCrewIds: ReadonlySet<string>;
  hiddenItemCount: number;
  emptyCrewIds: string[];
  disabled?: boolean;
  readState?: 'pending' | 'unavailable';
  onToggleCrew: (crewId: string) => void;
  onHideCrews: (crewIds: readonly string[]) => void;
  onShowAllCrews: () => void;
};

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default function ScheduleCrewFilter({
  crews,
  hiddenCrewIds,
  hiddenItemCount,
  panel,
  disabled: disabledProp = false,
  readState,
}: ScheduleCrewFilterProps) {
  const disabled = disabledProp || Boolean(readState);
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const summaryRef = useRef<HTMLElement | null>(null);
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const visibleCount = crews.length - hiddenCrewIds.size;

  useEffect(() => {
    if (disabled && detailsRef.current?.open) detailsRef.current.open = false;
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !detailsRef.current?.contains(event.target)) {
        if (detailsRef.current) detailsRef.current.open = false;
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  return (
    <details
      ref={detailsRef}
      className={styles.filter}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      onKeyDown={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        if (event.key !== 'Escape' || !detailsRef.current?.open) return;
        event.preventDefault();
        detailsRef.current.open = false;
        summaryRef.current?.focus();
      }}
    >
      <summary
        ref={summaryRef}
        className={styles.trigger}
        aria-controls={panelId}
        aria-expanded={open}
        aria-disabled={disabled}
        aria-label={readState?`Crew filters ${readState==='pending'?'loading':'unavailable'}`:`Filter crews, ${visibleCount} of ${crews.length} visible`}
        onClick={(event) => {
          if (disabled) event.preventDefault();
        }}
      >
        <span>Crews</span>
        <span className={styles.triggerCount}>
          {readState?readState==='pending'?'Reading…':'Unavailable':`${visibleCount} of ${crews.length}`}
        </span>
        {!readState && hiddenItemCount > 0 ? <span className={styles.triggerAlert}>{pluralize(hiddenItemCount, 'item')} hidden</span> : null}
      </summary>

      <div id={panelId} className={styles.panel}>
        {panel??(readState?<p className={styles.summary} aria-live="polite">{readState==='pending'?'Reading crews and scheduled work…':'Crew evidence unavailable'}</p>:null)}
      </div>
    </details>
  );
}
