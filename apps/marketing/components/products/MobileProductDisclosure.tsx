'use client';

import type { ReactNode } from 'react';
import { Disclosure } from '@/components/marketing-foundation/Disclosure';
import { cn } from '@/lib/cn';
import styles from './product-pages.module.css';

export default function MobileProductDisclosure({
  children,
  className,
  kind,
  summary,
}: {
  children: ReactNode;
  className?: string;
  kind: string;
  summary: string;
}) {
  return (
    <Disclosure
      bodyClassName={styles.mobileDisclosureBody}
      className={cn(styles.mobileDisclosure, className)}
      data-product-mobile-disclosure={kind}
      icon={<span className={styles.mobileDisclosureIcon} aria-hidden="true" />}
      mode="desktop-expanded"
      summary={<span>{summary}</span>}
      summaryClassName={styles.mobileDisclosureSummary}
      unstyled
    >
      {children}
    </Disclosure>
  );
}
