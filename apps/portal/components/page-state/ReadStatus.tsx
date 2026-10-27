'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { PortalPopover } from '@/components/ui/PortalFloatingPanel';
import styles from './ReadStatus.module.css';
import {Button} from '@/components/ui/foundation/FoundationControls';

/** A small, permanent local status line. Details never resize the work surface. */
export default function ReadStatus({ title, tone = 'neutral', action, details, onRetry, className, triggerAriaLabel, ...props }: HTMLAttributes<HTMLDivElement> & {
  title: string; tone?: 'neutral' | 'warning' | 'error'; action?: ReactNode; details?: ReactNode; onRetry?: () => unknown; triggerAriaLabel?: string;
}) {
  return <div {...props} className={className ? `${styles.root} ${className}` : styles.root} data-tone={tone}>
    <span className={styles.title} role={tone === 'error' ? 'alert' : undefined} aria-live={tone === 'warning' ? 'polite' : undefined} title={title}>{title}</span>
    <div className={styles.actions}>{action}{onRetry ? <Button variant="tertiary" size="small" onClick={() => void onRetry()}>Retry</Button> : null}{details ? <PortalPopover label={`${title} details`} trigger="Details" triggerClassName={styles.trigger} triggerAriaLabel={triggerAriaLabel}>
      <div className={styles.details}>{details}</div>
    </PortalPopover> : null}</div>
  </div>;
}
