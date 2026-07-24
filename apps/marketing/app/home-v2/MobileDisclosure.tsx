'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Disclosure } from '@/components/marketing-foundation/Disclosure';
import styles from './home-v2.module.css';

export default function MobileDisclosure({
  children,
  className,
  eventItem,
  eventName,
  summary,
}: {
  children: ReactNode;
  className?: string;
  eventItem?: string;
  eventName?: string;
  summary: string;
}) {
  return (
    <Disclosure
      className={cn(styles.mobileDisclosure, className)}
      mode="desktop-expanded"
      unstyled
      data-mobile-disclosure
      data-homepage-item={eventItem}
      data-homepage-toggle-event={eventName}
      summary={<span>{summary}</span>}
      summaryClassName={styles.mobileDisclosureSummary}
      bodyClassName={styles.mobileDisclosureBody}
      icon={<span className={styles.mobileDisclosureIcon} aria-hidden="true" />}
    >
      {children}
    </Disclosure>
  );
}
