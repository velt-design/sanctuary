'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import styles from './product-pages.module.css';

const desktopQuery = '(min-width: 641px)';

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
  const [isDesktop, setIsDesktop] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(desktopQuery);
    const syncViewport = () => setIsDesktop(media.matches);

    syncViewport();
    media.addEventListener('change', syncViewport);
    return () => media.removeEventListener('change', syncViewport);
  }, []);

  return (
    <details
      className={cn(styles.mobileDisclosure, className)}
      data-product-mobile-disclosure={kind}
      open={isDesktop || isMobileOpen}
      onToggle={(event) => {
        if (!isDesktop) setIsMobileOpen(event.currentTarget.open);
      }}
    >
      <summary className={styles.mobileDisclosureSummary}>
        <span>{summary}</span>
        <span className={styles.mobileDisclosureIcon} aria-hidden="true" />
      </summary>
      <div className={styles.mobileDisclosureBody}>{children}</div>
    </details>
  );
}
