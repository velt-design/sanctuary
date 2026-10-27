'use client';

import type { ComponentProps } from 'react';
import ReadStatus from '@/components/page-state/ReadStatus';
import styles from './ProjectReadFeedback.module.css';

/** Project read feedback stays with the existing control, outside content flow. */
export default function ProjectReadFeedback({ title, details, ...props }: ComponentProps<typeof ReadStatus>) {
  return <ReadStatus {...props} title={title} className={styles.root} triggerAriaLabel={title} data-project-read-feedback details={<><strong>{title}</strong>{details}</>}/>;
}
