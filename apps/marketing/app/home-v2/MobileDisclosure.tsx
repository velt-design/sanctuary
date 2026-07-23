'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import styles from './home-v2.module.css';

const desktopQuery = '(min-width: 641px)';

export default function MobileDisclosure({
  children,
  summary,
}: {
  children: ReactNode;
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
      className={styles.mobileDisclosure}
      data-mobile-disclosure
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
