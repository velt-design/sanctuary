'use client';

import Modal from '@/components/ui/modal/Modal';
import { formatShortDate } from './ScheduleGanttModel';
import styles from './schedule.module.css';

export type ScheduleGanttTimingChange = {
  mode: 'move' | 'resize';
  scheduleItemId: string;
  itemUpdatedAt: string;
  projectName: string;
  identityDetail: string | null;
  crewName: string;
  currentStart: string;
  currentEnd: string;
  currentDurationDays: number;
  proposedStart: string;
  proposedEnd: string;
  proposedDurationDays: number;
};

function TimingValue({ label, start, end, durationDays }: {
  label: string;
  start: string;
  end: string;
  durationDays: number;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{formatShortDate(start)} to {formatShortDate(end)} · {durationDays}d</strong>
    </div>
  );
}

export default function ScheduleGanttTimingReview({
  change,
  stale,
  onCancel,
  onConfirm,
}: {
  change: ScheduleGanttTimingChange;
  stale: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open ariaLabel="Review Gantt timing change" onClose={onCancel} maxWidthPx={560}>
      <div className={styles.actionModalBody}>
        <div className={styles.actionModalHeader}>
          <h2 className={styles.actionModalTitle}>Review timing change</h2>
          <button type="button" className={styles.buttonSecondary} onClick={onCancel}>Close</button>
        </div>

        <section className={styles.actionJobContext} aria-label="Job and timing context">
          <div className={styles.actionJobIdentity}>
            <strong>{change.projectName}</strong>
            {change.identityDetail ? <span>{change.identityDetail}</span> : null}
            <span>Crew: {change.crewName}</span>
          </div>
          <div className={styles.actionTimingReview}>
            <TimingValue label="Current" start={change.currentStart} end={change.currentEnd} durationDays={change.currentDurationDays} />
            <TimingValue label="Proposed" start={change.proposedStart} end={change.proposedEnd} durationDays={change.proposedDurationDays} />
          </div>
        </section>

        <p className={`${styles.hint} ${styles.actionModalIntro}`}>
          {stale
            ? 'The schedule changed while this review was open. Close and preview the timing again.'
            : 'Applying this change will preview any affected downstream jobs before the server commits it.'}
        </p>

        <div className={styles.actionModalActions}>
          <button type="button" className={styles.buttonSecondary} onClick={onCancel}>Cancel</button>
          <button type="button" className={styles.buttonPrimary} disabled={stale} onClick={onConfirm}>Apply change</button>
        </div>
      </div>
    </Modal>
  );
}
