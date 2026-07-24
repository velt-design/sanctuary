'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import styles from './home-v2.module.css';

const desktopQuery = '(min-width: 641px)';

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
      data-mobile-disclosure
      data-homepage-item={eventItem}
      data-homepage-toggle-event={eventName}
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
