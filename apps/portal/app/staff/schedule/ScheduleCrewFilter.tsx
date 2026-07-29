'use client';

import { useEffect, useId, useRef, useState } from 'react';
import styles from './ScheduleCrewFilter.module.css';

export type ScheduleCrewFilterOption = {
  id: string;
  name: string;
  color: string;
  itemCount: number;
};

type ScheduleCrewFilterProps = {
  crews: ScheduleCrewFilterOption[];
  hiddenCrewIds: ReadonlySet<string>;
  hiddenItemCount: number;
  emptyCrewIds: string[];
  disabled?: boolean;
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
  emptyCrewIds,
  disabled = false,
  onToggleCrew,
  onHideCrews,
  onShowAllCrews,
}: ScheduleCrewFilterProps) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const summaryRef = useRef<HTMLElement | null>(null);
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const visibleCount = crews.length - hiddenCrewIds.size;
  const hiddenCount = hiddenCrewIds.size;

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
        aria-label={`Filter crews, ${visibleCount} of ${crews.length} visible`}
        onClick={(event) => {
          if (disabled) event.preventDefault();
        }}
      >
        <span>Crews</span>
        <span className={styles.triggerCount}>
          {visibleCount} of {crews.length}
        </span>
        {hiddenItemCount > 0 ? <span className={styles.triggerAlert}>{pluralize(hiddenItemCount, 'item')} hidden</span> : null}
      </summary>

      <div id={panelId} className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.title}>Crews in Schedule</div>
            <div className={styles.summary} aria-live="polite">
              {hiddenCount > 0
                ? `${pluralize(hiddenCount, 'crew', 'crews')} hidden${hiddenItemCount > 0 ? ` / ${pluralize(hiddenItemCount, 'item')} hidden` : ''}`
                : 'All crews visible'}
            </div>
          </div>
          <button
            type="button"
            className={styles.textButton}
            disabled={disabled || hiddenCount === 0}
            onClick={onShowAllCrews}
          >
            Show all
          </button>
        </div>

        <p className={styles.help}>Saved on this browser. This only changes Schedule views; it does not deactivate crews or change access.</p>

        <fieldset className={styles.crewList} disabled={disabled}>
          <legend className={styles.legend}>Choose visible crews</legend>
          {crews.map((crew) => (
            <label key={crew.id} className={styles.crewOption}>
              <input
                type="checkbox"
                data-crew-id={crew.id}
                checked={!hiddenCrewIds.has(crew.id)}
                onChange={() => onToggleCrew(crew.id)}
              />
              <span className={styles.crewDot} style={{ background: crew.color }} aria-hidden="true" />
              <span className={styles.crewName}>{crew.name}</span>
              <span className={styles.itemCount}>{pluralize(crew.itemCount, 'item')}</span>
            </label>
          ))}
        </fieldset>

        <button
          type="button"
          className={styles.secondaryButton}
          disabled={disabled || emptyCrewIds.length === 0 || emptyCrewIds.every((crewId) => hiddenCrewIds.has(crewId))}
          onClick={() => onHideCrews(emptyCrewIds)}
        >
          Hide empty crews
        </button>
      </div>
    </details>
  );
}
