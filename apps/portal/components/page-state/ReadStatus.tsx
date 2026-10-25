'use client';

import type { ReactNode } from 'react';
import { PortalPopover } from '@/components/ui/PortalFloatingPanel';
import styles from './ReadStatus.module.css';

/** A small, permanent local status line. Details never resize the work surface. */
export default function ReadStatus({ title, tone = 'neutral', action, details }: {
  title: string; tone?: 'neutral' | 'warning' | 'error'; action?: ReactNode; details?: ReactNode;
}) {
  return <div className={styles.root} data-tone={tone}>
    <span className={styles.title} role={tone === 'error' ? 'alert' : 'status'} title={title}>{title}</span>
    <div className={styles.actions}>{action}{details ? <PortalPopover label={`${title} details`} trigger="Details" triggerClassName={styles.trigger}>
      <div className={styles.details}>{details}</div>
    </PortalPopover> : null}</div>
  </div>;
}
