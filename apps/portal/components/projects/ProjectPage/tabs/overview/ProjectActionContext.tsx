import type { ReactNode } from 'react';
import styles from './ProjectWorkSection.module.css';

/** Routine explanation is optional; recovery/state/critical guidance stays visible. */
export default function ProjectActionContext({ reason, expectedResult, essential }: {
  reason: string; expectedResult: string | null; essential: boolean;
}) {
  if (!reason && !expectedResult) return null;
  const content: ReactNode = <div className={styles.actionContextBody}>
    {reason ? <p className={styles.reason} data-primary-work-reason="true">{reason}</p> : null}
    {expectedResult ? <p className={styles.reason}><strong>Expected result: </strong>{expectedResult}</p> : null}
  </div>;
  return essential ? content : <details className={styles.actionContext}>
    <summary>Why this action</summary>{content}
  </details>;
}
